import type { IPty } from "node-pty";
import { spawn } from "node-pty";
import { commands } from "vscode";
import type { Graph } from "./types";
import { cleanAnsi } from "./util/ansiRegex";

const CTRL_C = "\u0003";
const UUID = "b83a4057-8ba5-4546-92c6-3b189d7c1ce9";
const START = "b83a4057-START-3b189d7c1ce9";
const ROWS = 30;
const PROMPT = "> ";
const PROMPT_MATCH = PROMPT.trimEnd();

interface Result {
    exitCode: number;
    cwd: string;
}

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
            this.pty = spawn(shell, graph.profile.getShellArgs(), {
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
        this.pty.write(graph.profile.getPrompts(PROMPT));
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
            let lastLine = "";
            let addedNewLine = false;
            const disposable = this.pty.onData((data) => {
                const lines = data.split(/\r?\n/);
                lines[0] = lastLine + lines[0];
                lastLine = lines.pop() ?? "";

                const handleLine = (line: string) => {
                    const cleanedLine = cleanAnsi(line);

                    switch (state) {
                        case 0:
                            if (cleanedLine === START) {
                                state = 1;
                            }
                            break;
                        case 1: {
                            const match = /^\|(\d+)\|(.+)\|/.exec(cleanedLine);
                            if (match != null) {
                                result = {
                                    exitCode: Number.parseInt(match[1], 10),
                                    cwd: match[2],
                                };
                                state = 2;
                            } else {
                                onData(addedNewLine ? `\r\n${line}` : line);
                                addedNewLine = true;
                            }
                            break;
                        }
                        case 2:
                            if (cleanedLine === PROMPT_MATCH) {
                                disposable.dispose();
                                resolve(result);
                            }
                            break;
                        default:
                            throw new Error(`invalid state: ${state}`);
                    }
                };

                for (const line of lines) {
                    handleLine(line);
                }

                if (state === 2) {
                    handleLine(lastLine);
                }
            });

            this.pty.write(
                `echo ${START}; ${command}; ${this.graph.profile.getResultCommand()}\r`,
            );
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
                        if (cleanedLine === PROMPT_MATCH) {
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

    private readPrompt(
        buffer: string,
        promptIndex: number,
    ): { exitCode: number; cwd: string; endOfLine: number } | null {
        const promptPrefixEnd = promptIndex + UUID.length;
        if (buffer[promptPrefixEnd] !== "|") {
            return null;
        }

        const exitCodeEnd = buffer.indexOf("|", promptPrefixEnd + 1);
        if (exitCodeEnd === -1) {
            return null;
        }

        const cwdEnd = buffer.indexOf("|", exitCodeEnd + 1);
        if (cwdEnd === -1) {
            return null;
        }

        const lineEnd = buffer.indexOf("\n", cwdEnd + 1);

        return {
            exitCode: Number.parseInt(
                buffer.slice(promptPrefixEnd + 1, exitCodeEnd),
                10,
            ),
            cwd: buffer.slice(exitCodeEnd + 1, cwdEnd),
            endOfLine: lineEnd === -1 ? cwdEnd + 1 : lineEnd + 1,
        };
    }
}
