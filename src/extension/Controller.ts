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

export default class Controller {
  readonly controllerId = "bash-notebook-controller-id";
  readonly notebookType = "bash-notebook";
  readonly label = "Bash notebook";
  readonly supportedLanguages = ["shellscript"];
  readonly mime = "x-application/bash-notebook";

  private readonly controller: NotebookController;
  private executionOrder = 0;
  private isExecuting = false;
  private pty;

  constructor() {
    this.controller = notebooks.createNotebookController(
      this.controllerId,
      this.notebookType,
      this.label
    );

    this.controller.supportedLanguages = this.supportedLanguages;
    this.controller.supportsExecutionOrder = true;
    this.controller.executeHandler = this.executeHandler.bind(this);

    this.pty = spawn(shell, [], {
      name: "xterm-color",
      cols: 80,
      rows: 30,
      cwd: process.env.HOME,
      env: <{ [key: string]: string }>process.env,
    });

    console.log(this.pty.process, this.pty.pid);
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
    if (this.isExecuting) {
      return;
    }

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

      const json = {
        uri: cell.document.uri.toString(),
        data,
      };

      execution.appendOutput(
        new NotebookCellOutput([NotebookCellOutputItem.json(json, this.mime)])
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
      this.pty.write(`${command}\r`);
    });
  }
}
