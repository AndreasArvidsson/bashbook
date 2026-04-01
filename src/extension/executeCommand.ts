import type { IPty } from "node-pty";
import type { Logger } from "./logger";
import type { Profile } from "./profiles/Profile";
import type { Result } from "./types";
import { cleanAnsi } from "./util/ansiRegex";
import { calculateSplitRegExp } from "./util/calculateSplitRegExp";
import { generateStart } from "./util/generatePrompts";

export function executeCommand(
    logger: Logger,
    pty: Pick<IPty, "onData" | "write">,
    profile: Profile,
    command: string,
    token: string,
    prompt: string,
    onData: (data: string) => void,
): Promise<Result> {
    logger.debug(`Executing command: ${command}`);

    const start = generateStart(token);
    const resultCommand = profile.getResultCommand(token);
    const splitRegex = calculateSplitRegExp(prompt);

    // 0: wait for start signal
    // 1: wait for prompt
    // 2: wait for result command completion
    let state = 0;
    let addedNewLine = false;
    let result = "";
    let lastLine = "";
    let lastTailCleaned = "";
    let bufferedTailSawOnlyAnsi = false;

    return new Promise<Result>((resolve) => {
        const disposable = pty.onData((data) => {
            logger.debug(`data: ${JSON.stringify(data)}`);

            const lines = (lastLine + data).split(splitRegex);
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
                        if (cleanedLine === prompt) {
                            state = 2;
                            pty.write(`${resultCommand}\r`);
                        } else {
                            if (line.length === 0 && !addedNewLine) {
                                break;
                            }

                            if (lastTailCleaned.length > 0) {
                                if (cleanedLine.length === 0) {
                                    bufferedTailSawOnlyAnsi = true;
                                    break;
                                }

                                const doBreak =
                                    cleanedLine === lastTailCleaned &&
                                    bufferedTailSawOnlyAnsi;

                                lastTailCleaned = "";
                                bufferedTailSawOnlyAnsi = false;

                                if (doBreak) {
                                    break;
                                }
                            }

                            onData(addedNewLine ? `\r\n${line}` : line);
                            addedNewLine = true;
                        }
                        lastTailCleaned = "";
                        bufferedTailSawOnlyAnsi = false;
                        break;
                    }
                    case 2:
                        if (cleanedLine === prompt) {
                            const match = parseResultOutput(result, token);

                            if (match == null) {
                                break;
                            }

                            const [, exitCode, cwd] = match;
                            disposable.dispose();
                            state = 3;

                            logger.debug(
                                `Command execution completed with exit code ${exitCode} and cwd ${cwd}`,
                            );

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

            if (cleanAnsi(lastLine).startsWith(prompt)) {
                handleLine(lastLine);
                lastLine = "";
            } else if (
                state === 1 &&
                lastLine.length > 0 &&
                !hasPartialPromptTail(prompt, lastLine)
            ) {
                onData(lastLine);
                lastTailCleaned = cleanAnsi(lastLine);
                bufferedTailSawOnlyAnsi = false;
                lastLine = "";
            }
        });

        pty.write(`echo ${start}; ${command}\r`);
    });
}

function hasPartialPromptTail(prompt: string, value: string): boolean {
    const cleaned = cleanAnsi(value);
    const length = Math.min(cleaned.length, prompt.length - 1);

    for (let i = 1; i <= length; i++) {
        if (cleaned.endsWith(prompt.slice(0, i))) {
            return true;
        }
    }

    return false;
}

function isNotEmpty(input: string): boolean {
    return cleanAnsi(input).length > 0;
}

function parseResultOutput(
    result: string,
    token: string,
): RegExpExecArray | null {
    const marker = `|${token}|exit:`;
    const index = result.lastIndexOf(marker);

    if (index === -1) {
        return null;
    }

    return new RegExp(String.raw`^\|${token}\|exit:(\d+)\|cwd:(.*)\|$`).exec(
        result.slice(index),
    );
}
