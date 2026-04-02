import type { IPty } from "node-pty";
import { START_SIGNAL_TIMEOUT_MS } from "./constants";
import type { Logger } from "./logger";
import { cleanAnsi } from "./util/ansiRegex";
import { calculateSplitRegExp } from "./util/calculateSplitRegExp";
import { generateStart } from "./util/generatePrompts";

export function waitForStartSignal(
    logger: Logger,
    pty: Pick<IPty, "onData" | "write">,
    token: string,
    prompt: string,
): Promise<void> {
    logger.debug("Waiting for start signal");

    const start = generateStart(token);
    const splitRegex = calculateSplitRegExp(prompt);
    let timeout: NodeJS.Timeout;
    let started = false;
    let lastLine = "";

    return new Promise<void>((resolve, reject) => {
        const disposable = pty.onData((data) => {
            logger.debug(`data: ${JSON.stringify(data)}`);

            const lines = (lastLine + data).split(splitRegex);
            lastLine = lines.pop() ?? "";

            const handleLine = (line: string): void => {
                const cleanedLine = cleanAnsi(line);

                logger.debug(
                    `${started ? 1 : 0} | ${JSON.stringify(cleanedLine)}`,
                );

                if (started) {
                    if (cleanedLine === prompt) {
                        globalThis.clearTimeout(timeout);
                        disposable.dispose();
                        logger.debug("Received start signal and custom prompt");
                        resolve();
                    }
                } else if (cleanedLine === start) {
                    started = true;
                }
            };

            for (const line of lines) {
                handleLine(line);
            }

            if (lastLine.startsWith(prompt)) {
                handleLine(lastLine);
                lastLine = "";
            }
        });

        pty.write(`echo ${start}\r`);

        timeout = globalThis.setTimeout(() => {
            disposable.dispose();
            const waitingFor = started ? "custom prompt" : "start signal";
            const message = `Timeout waiting for ${waitingFor}`;
            logger.debug(message);
            reject(new Error(message));
        }, START_SIGNAL_TIMEOUT_MS);
    });
}
