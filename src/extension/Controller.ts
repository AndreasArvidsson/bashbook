import {
  NotebookCell,
  NotebookCellExecution,
  NotebookCellOutput,
  NotebookCellOutputItem,
  NotebookController,
  notebooks,
} from "vscode";
import {
  OutputMessageData,
  OutputMessageFinished,
} from "../common/OutputMessage";
import { getShell } from "./Options";
import Pty from "./Pty";
import ansiRegex from "./ansiRegex";
import updateCommand from "./updateCommand";
import {
  CONTROLLER_ID,
  LANGUAGE,
  MIME_BASHBOOK,
  MIME_PLAINTEXT,
  NOTEBOOK_LABEL,
  NOTEBOOK_TYPE,
} from "./Constants";

const supportedLanguages = [LANGUAGE];

interface CommandExecution {
  command: string;
  execution: NotebookCellExecution;
  uri: string;
}

export default class Controller {
  private readonly controller: NotebookController;
  private executionQueue: CommandExecution[] = [];
  private isExecuting?: CommandExecution;
  private executionOrder = 0;
  private pty;

  constructor(private historyPush: (value: string) => void) {
    this.controller = notebooks.createNotebookController(
      CONTROLLER_ID,
      NOTEBOOK_TYPE,
      NOTEBOOK_LABEL
    );
    this.controller.supportedLanguages = supportedLanguages;
    this.controller.supportsExecutionOrder = true;
    this.controller.executeHandler = this.executeHandler.bind(this);

    const shell = getShell();
    console.debug(`Spawning shell '${shell}'`);

    this.pty = new Pty(shell);
  }

  dispose() {
    this.controller.dispose();
    this.pty.dispose();
  }

  onData(uri: string, data: string) {
    if (this.isExecuting?.uri === uri) {
      this.pty.write(data);
    }
  }

  setCols(cols: number) {
    this.pty.setCols(cols);
  }

  private executeHandler(cells: NotebookCell[]) {
    for (const cell of cells) {
      this.doExecution(cell);
    }
  }

  private doExecution(cell: NotebookCell) {
    const execution = this.controller.createNotebookCellExecution(cell);
    execution.executionOrder = ++this.executionOrder;
    execution.start(Date.now());
    execution.clearOutput();

    const commands = cell.document
      .getText()
      .split("\n")
      .map((command) => command.trim())
      .filter(Boolean);

    if (commands.length === 0) {
      execution.end(true, Date.now());
      this.isExecuting = undefined;
      return;
    }

    const uri = cell.document.uri.toString();

    execution.token.onCancellationRequested(() => {
      if (this.isExecuting?.uri === uri) {
        this.pty.terminate();
      } else {
        execution.end(false, Date.now());
      }
    });

    const command = commands.join("; ");

    this.executionQueue.push({
      command,
      execution,
      uri,
    });

    this.historyPush(command);
    this.runExecutionQueue();
  }

  private runExecutionQueue() {
    if (this.executionQueue.length === 0 || this.isExecuting != null) {
      return;
    }

    const commandExecution = this.executionQueue.shift()!;
    const { command, execution, uri } = commandExecution;

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
        new NotebookCellOutput([NotebookCellOutputItem.error(<Error>e)])
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
        uri,
        data,
        firstCommand,
        cols: this.pty.getCols(),
      };

      firstCommand = false;

      plainTextData.push(data.replace(ansiRegex, ""));
      execution.appendOutput(
        new NotebookCellOutput([
          NotebookCellOutputItem.json(json, MIME_BASHBOOK),
        ])
      );
    };

    const end = (success: boolean) => {
      if (!firstCommand) {
        const json: OutputMessageFinished = {
          type: "finished",
          uri,
        };
        execution.replaceOutput(
          new NotebookCellOutput([
            NotebookCellOutputItem.json(json, MIME_BASHBOOK),
            NotebookCellOutputItem.text(
              plainTextData.join("\n"),
              MIME_PLAINTEXT
            ),
          ])
        );
      }

      execution.end(success, Date.now());
      this.isExecuting = undefined;
      this.runExecutionQueue();
    };

    this.pty
      .writeCommand(updatedCommand, onData)
      .then((result) => {
        console.log(result.cwd); // TODO
        end(true);
      })
      .catch((result) => {
        console.log(result.cwd); // TODO
        end(false);
      });
  }
}
