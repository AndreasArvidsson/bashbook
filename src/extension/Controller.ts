import {
  NotebookCell,
  NotebookCellExecution,
  NotebookCellOutput,
  NotebookCellOutputItem,
  NotebookController,
  NotebookDocument,
  notebooks,
} from "vscode";
import { IPty, spawn } from "node-pty";
import { getChildrenForPPID } from "./ps";
import { getShell } from "./Options";

const CTRL_C = "\x03";
const errorCode = "ERRORCODE=";
const mime = "x-application/bashbook";
const controllerId = "bashbook-controller-id";
const notebookType = "bashbook";
const label = "BashBook";
const supportedLanguages = ["shellscript"];

interface CommandExecution {
  command: string;
  execution: NotebookCellExecution;
  uri: string;
  cancelPromise: Promise<void>;
}

export default class Controller {
  private readonly controller: NotebookController;
  private executionQueue: CommandExecution[] = [];
  private executionOrder = 0;
  private isExecuting?: CommandExecution;
  private pty: IPty;

  constructor() {
    this.controller = notebooks.createNotebookController(
      controllerId,
      notebookType,
      label
    );

    this.controller.supportedLanguages = supportedLanguages;
    this.controller.supportsExecutionOrder = true;
    this.controller.executeHandler = this.executeHandler.bind(this);

    const shell = getShell();
    console.debug(`Spawning shell '${shell}'`);

    this.pty = spawn(shell, [], {
      name: "xterm-color",
      cols: 80,
      rows: 30,
      cwd: process.env.HOME,
      env: <{ [key: string]: string }>process.env,
    });

    console.debug("pty pid", this.pty.pid);
    getChildrenForPPID(this.pty.pid).then(console.debug);
  }

  dispose() {
    this.controller.dispose();
    this.pty.kill();
  }

  onData(uri: string, data: string) {
    if (this.isExecuting?.uri === uri) {
      this.pty.write(data);
    }
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
      this.isExecuting = undefined;
      return;
    }

    const cancelPromise = new Promise<void>((resolve) => {
      execution.token.onCancellationRequested(resolve);
    });

    cancelPromise.then(() => {
      execution.end(false, Date.now());
    });

    this.executionQueue.push({
      command: commands.join("; "),
      execution,
      uri: cell.document.uri.toString(),
      cancelPromise,
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
    if (this.executionQueue.length === 0 || this.isExecuting != null) {
      return;
    }

    const commandExecution = this.executionQueue.shift()!;
    const { command, execution, uri, cancelPromise } = commandExecution;

    if (execution.token.isCancellationRequested) {
      this.runExecutionQueue();
      return;
    }

    this.isExecuting = commandExecution;
    let waitingForCommand = true;

    const disposable = this.pty.onData((data) => {
      getChildrenForPPID(this.pty.pid).then(console.debug);

      // Execution is already canceled
      if (execution.token.isCancellationRequested) {
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
        this.isExecuting = undefined;
        this.runExecutionQueue();
        return;
      }

      execution.appendOutput(this.getOutput(uri, data));
    });

    cancelPromise.then(() => {
      disposable.dispose();
      this.pty.write(CTRL_C);
      this.isExecuting = undefined;
      this.runExecutionQueue();
    });

    this.pty.write(`${command}; echo ${errorCode}$?\r`);
  }
}
