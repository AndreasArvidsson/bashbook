import * as vscode from "vscode";
import * as os from "os";
import { getShell } from "./Options";
import Pty from "./Pty";
import {
  OutputMessageData,
  OutputMessageFinished,
} from "../common/OutputMessage";
import ansiRegex from "./ansiRegex";
import { MIME_BASHBOOK, MIME_PLAINTEXT } from "./Constants";
import updateCommand from "./updateCommand";
import { Graph } from "./types";

interface CommandExecution {
  command: string;
  execution: vscode.NotebookCellExecution;
  cellUri: string;
}

export default class Notebook {
  private executionQueue: CommandExecution[] = [];
  private isExecuting?: CommandExecution;
  private executionOrder = 0;
  private pty;

  constructor(private graph: Graph, private notebookUri: string) {
    const cwd = process.env.HOME ?? os.homedir();
    const shell = getShell();

    console.debug(`Spawning shell '${shell}'`);

    this.graph.setCWD(cwd);
    this.pty = new Pty(shell, cwd);
  }

  dispose() {
    this.pty.dispose();
  }

  doExecution(execution: vscode.NotebookCellExecution) {
    execution.executionOrder = ++this.executionOrder;
    execution.start(Date.now());
    execution.clearOutput();

    const commands = execution.cell.document
      .getText()
      .split("\n")
      .map((command) => command.trim())
      .filter(Boolean);

    if (commands.length === 0) {
      execution.end(true, Date.now());
      this.isExecuting = undefined;
      return;
    }

    const cellUri = execution.cell.document.uri.toString();

    execution.token.onCancellationRequested(() => {
      if (this.isExecuting?.cellUri === cellUri) {
        this.pty.terminate();
      } else {
        execution.end(false, Date.now());
      }
    });

    const command = commands.join("; ");

    this.executionQueue.push({
      command,
      execution,
      cellUri,
    });

    this.graph.historyPush(command);
    this.runExecutionQueue();
  }

  private runExecutionQueue() {
    if (this.executionQueue.length === 0 || this.isExecuting != null) {
      return;
    }

    const commandExecution = this.executionQueue.shift()!;
    const { command, execution, cellUri } = commandExecution;

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

    const plainTextData: string[] = [];
    let firstCommand = true;

    const onData = (data: string) => {
      if (execution.token.isCancellationRequested) {
        return;
      }

      const json: OutputMessageData = {
        type: "data",
        notebookUri: this.notebookUri,
        cellUri,
        data,
        firstCommand,
        cols: this.pty.getCols(),
      };

      firstCommand = false;

      plainTextData.push(data.replace(ansiRegex, ""));
      execution.appendOutput(
        new vscode.NotebookCellOutput([
          vscode.NotebookCellOutputItem.json(json, MIME_BASHBOOK),
        ])
      );
    };

    const end = (success: boolean, cwd: string) => {
      if (!firstCommand) {
        const json: OutputMessageFinished = {
          type: "finished",
          notebookUri: this.notebookUri,
          cellUri,
        };
        execution.replaceOutput(
          new vscode.NotebookCellOutput([
            vscode.NotebookCellOutputItem.json(json, MIME_BASHBOOK),
            vscode.NotebookCellOutputItem.text(
              plainTextData.join("\n"),
              MIME_PLAINTEXT
            ),
          ])
        );
      }

      execution.end(success, Date.now());
      this.graph.setCWD(cwd);
      this.isExecuting = undefined;
      this.runExecutionQueue();
    };

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
