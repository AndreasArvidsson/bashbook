import {
  NotebookCell,
  NotebookCellExecution,
  NotebookCellOutput,
  NotebookCellOutputItem,
  NotebookController,
  NotebookDocument,
  notebooks,
} from "vscode";
import { getShell } from "./Options";
import Pty from "./Pty";
import RenderCommand from "../common/RenderCommand";

const mime = "x-application/bashbook";
const controllerId = "bashbook-controller";
const notebookType = "bashbook";
const label = "BashBook";
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

    const uri = cell.document.uri.toString();

    execution.token.onCancellationRequested(() => {
      if (this.isExecuting?.uri === uri) {
        this.pty.terminate();
      } else {
        execution.end(false, Date.now());
      }
    });

    this.executionQueue.push({
      command: commands.join("; "),
      execution,
      uri,
    });

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
    let firstCommand = true;

    const onData = (data: string) => {
      if (execution.token.isCancellationRequested) {
        return;
      }

      const json: RenderCommand = {
        uri,
        data,
        firstCommand,
        lastCommand: false,
      };
      firstCommand = false;

      execution.appendOutput(
        new NotebookCellOutput([
          NotebookCellOutputItem.json(json, mime),
          // NotebookCellOutputItem.text(data), TODO
        ])
      );
    };

    const end = (success: boolean) => {
      if (!firstCommand) {
        const json: RenderCommand = {
          uri,
          firstCommand: false,
          lastCommand: true,
        };
        execution.appendOutput(
          new NotebookCellOutput([NotebookCellOutputItem.json(json, mime)])
        );
      }

      execution.end(success, Date.now());
    };

    this.pty
      .writeCommand(command, onData)
      .then((result) => {
        console.log(result.cwd); // TODO
        end(true);
        return result;
      })
      .catch((result) => {
        console.log(result.cwd); // TODO
        end(false);
      })
      .finally(() => {
        this.isExecuting = undefined;
        this.runExecutionQueue();
      });
  }
}
