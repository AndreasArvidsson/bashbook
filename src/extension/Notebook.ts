import * as vscode from "vscode";
import * as options from "./util/Options";
import Pty from "./Pty";
import {
  OutputMessageExecuting,
  OutputMessageCompleted,
} from "../common/OutputMessage";
import { ansiRegex } from "./util/ansiRegex";
import { MIME_BASHBOOK, MIME_PLAINTEXT } from "./Constants";
import updateCommand from "./util/updateCommandForVariables";
import { Graph } from "./typings/types";
import notebookDirectory from "./util/getNotebookDirectory";

export interface ExecutionOptions {
  noOutput?: boolean;
}

interface CommandExecution {
  command: string;
  execution: vscode.NotebookCellExecution;
  cellUri: string;
  options: ExecutionOptions;
  resolve?: (value: string) => void;
  reject?: (value: string) => void;
}

export default class Notebook {
  private readonly executionQueue: CommandExecution[] = [];
  private readonly notebookUri;
  private readonly pty;
  private isExecuting?: CommandExecution;
  private executionOrder = 0;

  constructor(private graph: Graph, notebookUri: vscode.Uri) {
    this.notebookUri = notebookUri.toString();
    const shell = options.getShell() || graph.profile.getShell();
    const cwd = notebookDirectory(notebookUri);

    console.debug(`Spawning shell: '${shell}' @ '${cwd}'`);

    this.graph.setCWD(cwd);
    this.pty = new Pty(shell, cwd, graph);
  }

  dispose() {
    this.pty.dispose();
  }

  async doExecution(
    execution: vscode.NotebookCellExecution,
    options: ExecutionOptions = {},
    resolve?: (value: string) => void,
    reject?: (value: string) => void
  ) {
    execution.executionOrder = ++this.executionOrder;
    execution.start(Date.now());
    await execution.clearOutput();

    const commands = this.graph.parser.getCommandLines(execution.cell.document);

    if (commands.length === 0) {
      execution.end(true, Date.now());
      this.isExecuting = undefined;
      return;
    }

    const cellUri = execution.cell.document.uri.toString();

    execution.token.onCancellationRequested(() => {
      // This is not the executing cell. Just end execution in queue.
      if (this.isExecuting?.cellUri !== cellUri) {
        execution.end(false, Date.now());
      }
    });

    const command = commands.join("; ");

    this.executionQueue.push({
      command,
      execution,
      cellUri,
      options,
      resolve,
      reject,
    });

    this.graph.historyPush(command);
    this.runExecutionQueue();
  }

  private runExecutionQueue() {
    if (this.executionQueue.length === 0 || this.isExecuting != null) {
      return;
    }

    const commandExecution = this.executionQueue.shift()!;
    const { command, execution, cellUri, options, resolve, reject } =
      commandExecution;
    const { noOutput } = options;

    // Execution is already canceled
    if (execution.token.isCancellationRequested) {
      this.runExecutionQueue();
      return;
    }

    this.isExecuting = commandExecution;

    // Update command with variables
    let updatedCommand;
    try {
      updatedCommand = updateCommand(command, execution);
    } catch (e) {
      execution.replaceOutput(
        new vscode.NotebookCellOutput([
          vscode.NotebookCellOutputItem.error(<Error>e),
        ])
      );
      execution.end(false, Date.now());
      this.isExecuting = undefined;
      return;
    }

    const dataChunks: string[] = [];
    const cols = this.pty.getCols();
    let firstCommand = true;

    const onData = (data: string) => {
      if (execution.token.isCancellationRequested) {
        return;
      }

      dataChunks.push(data);

      const json: OutputMessageExecuting = {
        type: "executing",
        notebookUri: this.notebookUri,
        cellUri,
        data,
        cols,
        firstCommand,
      };

      firstCommand = false;

      execution.appendOutput(
        new vscode.NotebookCellOutput([
          vscode.NotebookCellOutputItem.json(json, MIME_BASHBOOK),
        ])
      );
    };

    const end = (success: boolean, cwd?: string) => {
      const finishedData = dataChunks.join("");
      const plaintext = finishedData.replace(ansiRegex, "").trimEnd();

      if (noOutput) {
        execution.clearOutput();
      } else if (!firstCommand) {
        const json: OutputMessageCompleted = {
          type: "completed",
          notebookUri: this.notebookUri,
          cellUri,
          data: finishedData,
          cols,
        };
        execution.replaceOutput(
          new vscode.NotebookCellOutput([
            vscode.NotebookCellOutputItem.json(json, MIME_BASHBOOK),
            vscode.NotebookCellOutputItem.text(plaintext, MIME_PLAINTEXT),
          ])
        );
      }

      execution.end(success, Date.now());

      if (cwd) {
        this.graph.setCWD(cwd);
      }

      this.isExecuting = undefined;

      if (success) {
        if (resolve) {
          resolve(plaintext);
        }
      } else if (reject) {
        reject(plaintext);
      }

      this.runExecutionQueue();
    };

    execution.token.onCancellationRequested(() => {
      this.pty.terminate();
      setTimeout(() => {
        if (this.isExecuting?.cellUri === cellUri) {
          console.debug(
            "Execution is still running. Retry termination and end execution anyway."
          );
          this.pty.terminate();
          end(false);
        }
      }, 1000);
    });

    this.pty
      .writeCommand(updatedCommand, onData)
      .then((result) => {
        end(true, result.cwd);
      })
      .catch((result) => {
        end(false, result.cwd);
      });
  }

  onData(cellUri: string, data: string) {
    if (this.isExecuting?.cellUri === cellUri) {
      this.pty.write(data);
    }
  }

  setCols(cols: number) {
    this.pty.setCols(cols);
  }
}
