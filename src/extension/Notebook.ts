import * as vscode from "vscode";
import type {
    OutputMessageCompleted,
    OutputMessageExecuting,
} from "../common/OutputMessage";
import { MIME_BASHBOOK, MIME_PLAINTEXT } from "./Constants";
import { Pty } from "./Pty";
import type { CommandExecution, ExecutionOptions, Graph } from "./types";
import { cleanAnsi } from "./util/ansiRegex";
import { getNotebookDirectory } from "./util/getNotebookDirectory";
import { getShell } from "./util/Options";
import { sanitizeRendererData } from "./util/sanitizeRendererData";
import { updateCommandForVariables } from "./util/updateCommandForVariables";

export class Notebook {
    public cwd: string;

    private readonly executionQueue: CommandExecution[] = [];
    private readonly notebookUri;
    private readonly pty;
    private isExecuting?: CommandExecution;
    private nextExecutionOrder = 1;

    constructor(
        private readonly graph: Graph,
        notebookUri: vscode.Uri,
    ) {
        this.notebookUri = notebookUri.toString();
        const shell = getShell() ?? graph.profile.getShell();
        this.cwd = getNotebookDirectory(notebookUri);

        console.debug(`Spawning shell: '${shell}' @ '${this.cwd}'`);

        graph.setCWD(this.cwd);
        this.pty = new Pty(shell, this.cwd, graph.profile);
    }

    dispose(): void {
        this.pty.dispose();
    }

    async doExecution(
        execution: vscode.NotebookCellExecution,
        executionOptions: ExecutionOptions = {},
        resolve?: (value: string) => void,
        reject?: (reason: string) => void,
    ): Promise<void> {
        execution.executionOrder = this.nextExecutionOrder++;
        execution.start(Date.now());

        await execution.clearOutput();

        const commands = this.graph.parser.getCommandLines(
            execution.cell.document,
        );

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

        const command = commands.join(" && ");

        this.executionQueue.push({
            command,
            execution,
            cellUri,
            options: executionOptions,
            resolve,
            reject,
        });

        this.graph.historyPush(command);
        this.runExecutionQueue();
    }

    private runExecutionQueue(): void {
        if (this.isExecuting != null) {
            return;
        }
        const commandExecution = this.executionQueue.shift();
        if (commandExecution == null) {
            return;
        }
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
            updatedCommand = updateCommandForVariables(command, execution);
        } catch (error: unknown) {
            const err =
                error instanceof Error ? error : new Error(String(error));
            execution.replaceOutput(
                new vscode.NotebookCellOutput([
                    vscode.NotebookCellOutputItem.error(err),
                ]),
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

            const renderedData = sanitizeRendererData(data);

            if (renderedData.length === 0) {
                return;
            }

            dataChunks.push(renderedData);

            const json: OutputMessageExecuting = {
                type: "executing",
                notebookUri: this.notebookUri,
                cellUri,
                data: renderedData,
                cols,
                firstCommand,
            };

            firstCommand = false;

            execution.appendOutput(
                new vscode.NotebookCellOutput([
                    vscode.NotebookCellOutputItem.json(json, MIME_BASHBOOK),
                ]),
            );
        };

        const end = (success: boolean, cwd?: string) => {
            const finishedData = dataChunks.join("");
            const plaintext = cleanAnsi(finishedData).trimEnd();

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
                        vscode.NotebookCellOutputItem.text(
                            plaintext,
                            MIME_PLAINTEXT,
                        ),
                    ]),
                );
            }

            execution.end(success, Date.now());

            if (cwd != null) {
                this.cwd = cwd;
                this.graph.setCWD(cwd);
            }

            this.isExecuting = undefined;

            if (success) {
                resolve?.(plaintext);
            } else {
                reject?.(plaintext);
            }

            this.runExecutionQueue();
        };

        execution.token.onCancellationRequested(() => {
            this.pty.terminate();
            setTimeout(() => {
                if (this.isExecuting?.cellUri === cellUri) {
                    console.debug(
                        "Execution is still running. Retry termination and end execution anyway.",
                    );
                    this.pty.terminate();
                    end(false);
                }
            }, 1000);
        });

        void (async () => {
            const result = await this.pty.writeCommand(updatedCommand, onData);
            end(result.exitCode === 0, result.cwd);
        })();
    }

    onData(cellUri: string, data: string): void {
        if (this.isExecuting?.cellUri === cellUri) {
            this.pty.write(data);
        }
    }

    setCols(cols: number): void {
        this.pty.setCols(cols);
    }
}
