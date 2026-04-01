import type { IPty } from "node-pty";
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
    let started = false;
    let lastLine = "";

    return new Promise<void>((resolve) => {
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

            if (lastLine.startsWith(prompt)) {
                handleLine(lastLine);
                lastLine = "";
            }
        });

        pty.write(`echo ${start}\r`);
    });
}
