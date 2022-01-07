import {
  NotebookCell,
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

export default class Controller {
  private readonly controller: NotebookController;
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
    // Can only execute one cell at the time
    // if (this.isExecuting) {
    //   return;
    // }

    const execution = this.controller.createNotebookCellExecution(cell);
    execution.executionOrder = ++this.executionOrder;
    execution.start(Date.now());
    execution.clearOutput();

    execution.token.onCancellationRequested(() => {
      execution.end(false, Date.now());
      this.isExecuting = false;
    });

    this.pty.onData((data) => {
      // Execution is already canceled
      if (execution.token.isCancellationRequested) {
        return;
      }

      // ➜

      const json = {
        uri: cell.document.uri.toString(),
        data,
      };

      execution.appendOutput(
        new NotebookCellOutput([NotebookCellOutputItem.json(json, mime)])
      );

      console.log(`'${data}'`);
      // execution.end(true, Date.now());
      // this.isExecuting = false;
    });

    // this.pty.resize(100, 40);

    const commands = cell.document.getText().split("\n");

    this.isExecuting = commands.length > 0;
    if (!this.isExecuting) {
      execution.end(true, Date.now());
    }

    commands.forEach((command) => {
      this.pty.write(`${command}; echo ${errorCode}$?\r`);
      // this.pty.write(`${command}\r`);
    });
  }
}
