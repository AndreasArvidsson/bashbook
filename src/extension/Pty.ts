import type { IPty } from "node-pty";
import { spawn } from "node-pty";
import { commands } from "vscode";
import type { Graph, Result } from "./types";
import { cleanAnsi } from "./util/ansiRegex";

const CTRL_C = "\u0003";
const UUID = "b83a4057-8ba5-4546-92c6-3b189d7c1ce9";
const START = "b83a4057-START-3b189d7c1ce9";
const ROWS = 30;
const PROMPT1 = ">";
const PROMPT2 = "> ";
const SPLIT_REGEX = new RegExp(String.raw`\r?\n|(?=\|${UUID}\|)`);
const RESULT_REGEX = new RegExp(String.raw`^\|${UUID}\|(\d+)\|(.+)\|`);

export class Pty {
    public pid: number;
    private readonly pty: IPty;
    private readonly ready: Promise<void>;

    constructor(
        shell: string,
        cwd: string,
        private readonly graph: Graph,
    ) {
        try {
            this.pty = spawn(shell, [], {
                name: "xterm-color",
                cols: 80,
                rows: ROWS,
                cwd,
                // oxlint-disable-next-line node/no-process-env
                env: process.env,
                useConpty: graph.profile.useConpty,
            });
        } catch (error: unknown) {
            console.error(`failed to launch: ${shell}`);
            console.error(error);
            throw error;
        }

        this.pty.onExit(() => {
            console.debug("Exit");
            commands.executeCommand("workbench.action.closeActiveEditor");
        });

        this.pid = this.pty.pid;
        this.pty.write(graph.profile.getPrompts(PROMPT1, PROMPT2));
        this.ready = this.waitForStartSignal();
    }

    dispose(): void {
        this.pty.kill();
    }

    getCols(): number {
        return this.pty.cols;
    }

    setCols(colsSource: number): void {
        const cols = Math.max(UUID.length, colsSource);
        if (cols !== this.pty.cols) {
            this.pty.resize(cols, ROWS);
            this.pty.write("\r");
        }
    }

    write(data: string): void {
        this.pty.write(data);
    }

    terminate(): void {
        this.pty.write(CTRL_C);
    }

    async writeCommand(
        command: string,
        onData: (data: string) => void,
    ): Promise<Result> {
        await this.ready;

        return new Promise<Result>((resolve) => {
            // 0: wait for start signal
            // 1: wait for post-command result
            // 2: wait for prompt match
            let state = 0;
            let result: Result = { exitCode: -1, cwd: "" };
            let pending = "";
            let addedNewLine = false;
            const disposable = this.pty.onData((data) => {
                const parts = `${pending}${data}`.split(SPLIT_REGEX);
                pending = parts.pop() ?? "";

                const handlePart = (part: string) => {
                    const cleanedLine = cleanAnsi(part);

                    switch (state) {
                        case 0:
                            if (cleanedLine === START) {
                                state = 1;
                            }
                            break;
                        case 1: {
                            const match = RESULT_REGEX.exec(cleanedLine);
                            if (match != null) {
                                result = {
                                    exitCode: Number.parseInt(match[1], 10),
                                    cwd: match[2],
                                };
                                state = 2;
                            } else {
                                onData(addedNewLine ? `\r\n${part}` : part);
                                addedNewLine = true;
                            }
                            break;
                        }
                        case 2:
                            if (cleanedLine === PROMPT1) {
                                disposable.dispose();
                                state = 3;
                                resolve(result);
                            }
                            break;
                        default:
                            console.warn(`invalid state: ${state}`);
                    }
                };

                for (const part of parts) {
                    handlePart(part);
                }

                if (state === 2 && pending.length > 0) {
                    handlePart(pending);
                    pending = "";
                }
            });

            const resultCommand = this.graph.profile.getResultCommand(UUID);
            this.pty.write(`echo ${START}; ${command}; ${resultCommand}\r`);
        });
    }

    private waitForStartSignal(): Promise<void> {
        let started = false;
        return new Promise<void>((resolve) => {
            const disposable = this.pty.onData((data) => {
                const lines = data.split(/\r?\n/);

                for (const line of lines) {
                    const cleanedLine = cleanAnsi(line);

                    if (started) {
                        if (cleanedLine === PROMPT1) {
                            disposable.dispose();
                            resolve();
                            break;
                        }
                    } else if (cleanedLine === START) {
                        started = true;
                    }
                }
            });

            this.pty.write(`echo ${START}\r`);
        });
    }
}
