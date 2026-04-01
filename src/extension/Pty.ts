import type { IPty } from "node-pty";
import { spawn } from "node-pty";
import { commands } from "vscode";
import { logger } from "./logger";
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
            logger.error(`Failed to launch: ${shell}`, error);
            throw error;
        }

        this.pty.onExit(() => {
            logger.debug("Exit shell");
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

    setCols(cols: number): void {
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
        logger.debug(`Executing command: ${command}`);

        await this.ready;

        logger.debug("Shell is ready");

        return new Promise<Result>((resolve) => {
            const token = generateToken();
            const start = generateStart(token);
            const resultCommand = this.profile.getResultCommand(token);
            const resultRegex = new RegExp(
                String.raw`\|${token}\|exit:(\d+)\|cwd:(.*)\|`,
            );
            // 0: wait for start signal
            // 1: wait for prompt
            // 2: wait for result command completion
            let state = 0;
            let addedNewLine = false;
            let result = "";
            let lastLine = "";

            const disposable = this.pty.onData((data) => {
                logger.debug(`data: ${JSON.stringify(data)}`);

                const lines = (lastLine + data).split(SPLIT_REGEX);
                // Pop of non-empty last line, because it can be incomplete.
                lastLine = isNotEmpty(lines[lines.length - 1])
                    ? (lines.pop() ?? "")
                    : "";

                const handleLine = (line: string): void => {
                    const cleanedLine = cleanAnsi(line);

                    logger.debug(`${state} | ${JSON.stringify(cleanedLine)}`);

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
                            } else if (cleanedLine !== resultCommand) {
                                result += cleanedLine;
                            }
                            break;
                        default:
                            logger.warn(`Invalid state: ${state}`);
                    }
                };

                for (const line of lines) {
                    handleLine(line);
                }

                if (lastLine.startsWith(PROMPT)) {
                    handleLine(lastLine);
                    lastLine = "";
                } else if (
                    state === 1 &&
                    lastLine.length > 0 &&
                    !hasPartialPromptTail(lastLine)
                ) {
                    onData(lastLine);
                    lastLine = "";
                }
            });

            this.pty.write(`echo ${start}; ${command}\r`);
        });
    }

    private waitForStartSignal(): Promise<void> {
        logger.debug("Waiting for start signal");

        const token = generateToken();
        const start = generateStart(token);
        let started = false;
        let lastLine = "";

        return new Promise<void>((resolve) => {
            const disposable = this.pty.onData((data) => {
                logger.debug(`data: ${JSON.stringify(data)}`);

                const lines = (lastLine + data).split(SPLIT_REGEX);
                lastLine = lines.pop() ?? "";

                const handleLine = (line: string): void => {
                    const cleanedLine = cleanAnsi(line);

                    logger.debug(
                        `${started ? 1 : 0} | ${JSON.stringify(cleanedLine)}`,
                    );

                    if (started) {
                        if (cleanedLine === PROMPT) {
                            logger.debug("Received start signal");
                            disposable.dispose();
                            resolve();
                        }
                    } else if (cleanedLine === start) {
                        started = true;
                    }
                };

                for (const line of lines) {
                    handleLine(line);
                }

                if (lastLine.startsWith(PROMPT)) {
                    handleLine(lastLine);
                    lastLine = "";
                }
            });

            this.pty.write(`echo ${start}\r`);
        });
    }
}

function hasPartialPromptTail(value: string): boolean {
    const cleaned = cleanAnsi(value);
    const length = Math.min(cleaned.length, PROMPT.length - 1);

    for (let i = 1; i <= length; i++) {
        if (cleaned.endsWith(PROMPT.slice(0, i))) {
            return true;
        }
    }

    return false;
}

function isNotEmpty(input: string): boolean {
    return cleanAnsi(input).length > 0;
}
