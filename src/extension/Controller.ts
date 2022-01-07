import {
  NotebookCell,
  NotebookCellExecution,
  NotebookCellOutput,
  NotebookCellOutputItem,
  NotebookController,
  NotebookDocument,
  notebooks,
} from "vscode";
import { spawn } from "node-pty";

const shell = "C:\\Program Files\\Git\\bin\\bash.exe"; // TODO
// const shell = "powershell.exe";
// const shell = "bash.exe";

const errorCode = "ERRORCODE=";
const mime = "x-application/bash-notebook";
const controllerId = "bash-notebook-controller-id";
const notebookType = "bash-notebook";
const label = "Bash notebook";
const supportedLanguages = ["shellscript"];

interface CommandExecution {
  command: string;
  execution: NotebookCellExecution;
  uri: string;
}

export default class Controller {
  private readonly controller: NotebookController;
  private executionQueue: CommandExecution[] = [];
  private executionOrder = 0;
  private isExecuting = false;
  private pty;

  constructor() {
    this.controller = notebooks.createNotebookController(
      controllerId,
      notebookType,
      label
    );

    this.controller.supportedLanguages = supportedLanguages;
    this.controller.supportsExecutionOrder = true;
    this.controller.executeHandler = this.executeHandler.bind(this);

    this.pty = spawn(shell, [], {
      name: "xterm-color",
      cols: 80,
      rows: 30,
      cwd: process.env.HOME,
      env: <{ [key: string]: string }>process.env,
    });
  }

  dispose() {
    this.controller.dispose();
    this.pty.kill();
  }

  private executeHandler(
    cells: NotebookCell[],
    _notebook: NotebookDocument,
    _controller: NotebookController
  ) {
    for (const cell of cells) {
      this.doExecution(cell);
    }
  }

  private async doExecution(cell: NotebookCell): Promise<void> {
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
      this.isExecuting = false;
      return;
    }

    this.executionQueue.push({
      command: commands.join("; "),
      execution,
      uri: cell.document.uri.toString(),
    });

    execution.token.onCancellationRequested(() => {
      execution.end(false, Date.now());
      this.isExecuting = false;
      // TODO kill actual process?
      this.runExecutionQueue();
    });

    this.runExecutionQueue();
  }

  private getOutput(uri: string, data: string) {
    const json = { uri, data };

    return new NotebookCellOutput([
      NotebookCellOutputItem.json(json, mime),
      // NotebookCellOutputItem.text(data),
    ]);
  }

  private runExecutionQueue() {
    if (this.executionQueue.length === 0 || this.isExecuting) {
      return;
    }

    const { command, execution, uri } = this.executionQueue.shift()!;
    this.isExecuting = true;
    let waitingForCommand = true;

    const disposable = this.pty.onData((data) => {
      // Execution is already canceled
      if (execution.token.isCancellationRequested) {
        disposable.dispose();
        return;
      }

      // Don't print command
      if (waitingForCommand) {
        waitingForCommand = false;
        return;
      }

      const errorCodeIndex = data.indexOf(errorCode);
      if (errorCodeIndex > -1) {
        const code = data[errorCodeIndex + errorCode.length];
        const success = code === "0";
        if (errorCodeIndex > 0) {
          execution.appendOutput(
            this.getOutput(uri, data.substring(0, errorCodeIndex))
          );
        }
        execution.end(success, Date.now());
        disposable.dispose();
        this.isExecuting = false;

        this.runExecutionQueue();
        return;
      }

      execution.appendOutput(this.getOutput(uri, data));
    });

    this.pty.write(`${command}; echo ${errorCode}$?\r`);
  }
}
