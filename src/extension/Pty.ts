import type { IPty } from "node-pty";
import { spawn } from "node-pty";
import { commands } from "vscode";
import type { Graph } from "./types";
import { ParserBuffer } from "./util/ParserBuffer";

const CTRL_C = "\u0003";
const UUID = "b83a4057-8ba5-4546-92c6-3b189d7c1ce9";
const ROWS = 30;
const UUID_REGEXP = new RegExp(UUID.split("").join(String.raw`\s*\r?\n?`));
const PS2 = "> ";

interface Result {
    exitCode: number;
    cwd: string;
}

export class Pty {
    public pid: number;
    private readonly pty: IPty;

    constructor(shell: string, cwd: string, graph: Graph) {
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

        // Set prompt
        this.pty.write(graph.profile.getPS1(UUID));
        this.pty.write(graph.profile.getPS2(PS2));
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

    writeCommand(
        command: string,
        onData: (data: string) => void,
    ): Promise<Result> {
        return new Promise<Result>((resolve) => {
            const parser = new ParserBuffer();
            let waitingForNl = command.split("\n").length;
            let firstData = true;
            let ps1State = 0;
            // oxlint-disable-next-line unicorn/consistent-function-scoping, no-empty-function
            let ps1NextCallback = () => {};
            let exitCode: number;
            let cwd: string;

            // Don't print command when it's echoed back
            const parseCommand = () => {
                let indexNl = parser.indexOfNl();
                const indexUUID = parser.indexOf(UUID);
                if (
                    indexUUID !== -1 &&
                    (indexNl == null || indexUUID < indexNl.index)
                ) {
                    parseCallback = parsePS1;
                    ps1NextCallback = parseCommand;
                    parsePS1();
                }

                if (indexNl != null) {
                    parser.trimLeadingAnsiAndNl();
                    indexNl = parser.indexOfNl() ?? indexNl;
                    const nlForCol = indexNl.index === this.pty.cols;
                    parser.advance(indexNl.indexAfter);

                    // Only decrease waiting if the new line was because of the input and not because of the column width
                    if (!nlForCol) {
                        --waitingForNl;
                    }
                } else {
                    return;
                }

                if (!waitingForNl) {
                    parseCallback = parseData;
                }

                if (!parser.isEmpty()) {
                    parseCallback();
                }
            };

            const parseData = () => {
                if (firstData) {
                    firstData = false;
                    parser.trimLeadingAnsiAndNl();
                }

                // const [bufferI, dataI] = parser.lookahead(UUID);TODO

                const uuidMatch = parser.get().match(UUID_REGEXP);
                const data =
                    uuidMatch?.index != null
                        ? parser.read(uuidMatch.index)
                        : parser.readAll();

                if (data.length > 0) {
                    onData(data);
                }

                if (uuidMatch != null) {
                    parseCallback = parsePS1;
                    ps1State = 0;
                    ps1NextCallback = parseFinished;
                    parseCallback();
                }
            };

            const parsePS1 = () => {
                // Each part of the PS1 ends with '|'
                let index = parser.indexOf("|");
                if (index < 1) {
                    return;
                }
                parser.trimNl();
                index = parser.indexOf("|");
                if (ps1State === 0) {
                    parser.advance(index);
                } else if (ps1State === 1) {
                    exitCode = Number.parseInt(parser.read(index), 10);
                } else {
                    cwd = parser.read(index);
                    parseCallback = ps1NextCallback;
                }
                parser.match("|");
                ++ps1State;
                parseCallback();
            };

            const parseFinished = () => {
                const result = { exitCode, cwd };
                disposable.dispose();
                resolve(result);
            };

            let parseCallback = parseCommand;

            const disposable = this.pty.onData((data) => {
                parser.append(data);
                parseCallback();
            });

            parser.clear();
            this.pty.write(`${command}\r`);
        });
    }
}
