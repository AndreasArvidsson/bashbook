import type { IPty } from "node-pty";
import { spawn } from "node-pty";
import { commands } from "vscode";
import type { Profile } from "./profiles/Profile";
import type { Result } from "./types";
import { cleanAnsi } from "./util/ansiRegex";
import {
    generatePrompt,
    generateStart,
    generateToken,
} from "./util/generatePrompts";

const CTRL_C = "\u0003";
const ROWS = 30;
const PROMPT = generatePrompt();
const PROMPT2 = "> ";
const SPLIT_REGEX = new RegExp(String.raw`\r?\n|(?=${PROMPT})`);

export class Pty {
    public pid: number;
    private readonly pty: IPty;
    private readonly ready: Promise<void>;

    constructor(
        shell: string,
        cwd: string,
        private readonly profile: Profile,
    ) {
        try {
            this.pty = spawn(shell, [], {
                name: "xterm-color",
                cols: 80,
                rows: ROWS,
                cwd,
                // oxlint-disable-next-line node/no-process-env
                env: process.env,
                useConpty: profile.useConpty,
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
        this.pty.write(`${profile.getPromtp1(PROMPT)}\r`);
        this.pty.write(`${profile.getPrompt2(PROMPT2)}\r`);
        this.ready = this.waitForStartSignal();
    }

    dispose(): void {
        this.pty.kill();
    }

    getCols(): number {
        return this.pty.cols;
    }

    setCols(colsSource: number): void {
        // Make sure there is enough space for the prompt and the exit code without wrapping
        const cols = Math.max(PROMPT.length, colsSource);
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
            // 1: wait for prompt
            // 2: wait for result command completion
            let state = 0;
            let addedNewLine = false;
            let result = "";
            const token = generateToken();
            const start = generateStart(token);
            const resultCommand = this.profile.getResultCommand(token);
            const resultRegex = new RegExp(
                String.raw`\|${token}\|exit:(\d+)\|cwd:(.*)\|`,
            );
            const disposable = this.pty.onData((data) => {
                const lines = data.split(SPLIT_REGEX);

                for (const line of lines) {
                    const cleanedLine = cleanAnsi(line);

                    switch (state) {
                        case 0:
                            if (cleanedLine === start) {
                                state = 1;
                            }
                            break;
                        case 1: {
                            // Needs startsWith because the shell can print the
                            // prompt together with the command input.
                            if (cleanedLine.startsWith(PROMPT)) {
                                state = 2;
                                this.pty.write(`${resultCommand}\r`);
                            } else {
                                onData(addedNewLine ? `\r\n${line}` : line);
                                addedNewLine = true;
                            }
                            break;
                        }
                        case 2:
                            // Here we want to match exactly for the prompt,
                            // because we only want the end of the execution
                            // and not echoed back commands.
                            if (cleanedLine === PROMPT) {
                                const match = resultRegex.exec(result);

                                if (match == null) {
                                    break;
                                }

                                const [, exitCode, cwd] = match;
                                disposable.dispose();
                                state = 3;

                                resolve({
                                    exitCode: Number.parseInt(exitCode, 10),
                                    cwd,
                                });
                                return;
                            } else if (cleanedLine !== resultCommand) {
                                result += cleanedLine;
                            }
                            break;
                        default:
                            console.warn(`invalid state: ${state}`);
                    }
                }
            });

            this.pty.write(`echo ${start}; ${command}\r`);
        });
    }

    private waitForStartSignal(): Promise<void> {
        const token = generateToken();
        const start = generateStart(token);
        let started = false;
        return new Promise<void>((resolve) => {
            const disposable = this.pty.onData((data) => {
                const lines = data.split(/\r?\n/);

                for (const line of lines) {
                    const cleanedLine = cleanAnsi(line);

                    if (started) {
                        if (cleanedLine === PROMPT) {
                            disposable.dispose();
                            resolve();
                            break;
                        }
                    } else if (cleanedLine === start) {
                        started = true;
                    }
                }
            });

            this.pty.write(`echo ${start}\r`);
        });
    }
}
