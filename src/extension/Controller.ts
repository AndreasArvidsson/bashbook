import {
  NotebookCell,
  NotebookCellOutput,
  NotebookCellOutputItem,
  NotebookController,
  NotebookDocument,
  notebooks,
} from "vscode";
import { spawn } from "node-pty";
// import { createShell } from "./Shell";

const shell = "C:\\Program Files\\Git\\bin\\bash.exe"; // TODO
// const shell = "powershell.exe";

export default class Controller {
  readonly controllerId = "bash-notebook-controller-id";
  readonly notebookType = "bash-notebook";
  readonly label = "Bash notebook";
  readonly supportedLanguages = ["shellscript"];
  readonly mime = "x-application/bash-notebook";

  private readonly controller: NotebookController;
  private executionOrder = 0;
  private pty;

  constructor() {
    this.controller = notebooks.createNotebookController(
      this.controllerId,
      this.notebookType,
      this.label
    );

    this.controller.supportedLanguages = this.supportedLanguages;
    this.controller.supportsExecutionOrder = true;
    this.controller.executeHandler = this.execute.bind(this);

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
  }

  private execute(
    cells: NotebookCell[],
    _notebook: NotebookDocument,
    _controller: NotebookController
  ) {
    for (const cell of cells) {
      this.doExecution(cell);
    }
  }

  // private getShell(cell: NotebookCell) {
  //   if (!this.shells.has(cell)) {
  //     this.shells.set(cell, createShell());
  //   }
  //   return this.shells.get(cell);
  // }

  private async doExecution(cell: NotebookCell): Promise<void> {
    const execution = this.controller.createNotebookCellExecution(cell);
    execution.executionOrder = ++this.executionOrder;
    execution.start(Date.now());

    // const output = new NotebookCellOutput([]);
    execution.clearOutput();

    // const shell = this.getShell(cell);
    const text = cell.document.getText();

    this.pty.on("data", (data: any) => {
      // process.stdout.write(data);
      console.log(`1 "${data}"`);
      // execution.appendOutputItems(
      //   [NotebookCellOutputItem.text(data, this.mime)],
      //   output
      // );
      // execution.replaceOutput(output);
      execution.appendOutput(
        new NotebookCellOutput([NotebookCellOutputItem.text(data, this.mime)])
      );
      // execution.end(true, Date.now());
    });

    // this.pty.write("ls\r");
    // this.pty.resize(100, 40);
    // this.pty.write("ls\r");
    this.pty.write(`${text}\r`);
  }
}
