import {
  NotebookCell,
  NotebookCellExecution,
  NotebookCellOutput,
  NotebookCellOutputItem,
  NotebookController,
  NotebookDocument,
  notebooks,
} from "vscode";
import { getChildrenForPPID } from "./ps";
import { getShell } from "./Options";
import Pty from "./Pty";

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

    const shell = getShell();
    console.debug(`Spawning shell '${shell}'`);

    this.pty = new Pty(shell);

    console.debug("pty pid", this.pty.pid);
    getChildrenForPPID(this.pty.pid).then(console.debug);
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

    const onData = (data: string) => {
      execution.appendOutput(this.getOutput(uri, data));
    };

    const { promise, terminate } = this.pty.writeCommand(command, onData);

    cancelPromise.then(terminate);

    promise
      .then(() => {
        execution.end(true, Date.now());
      })
      .catch(() => {
        execution.end(false, Date.now());
      })
      .finally(() => {
        this.isExecuting = undefined;
        this.runExecutionQueue();
      });
  }
}
