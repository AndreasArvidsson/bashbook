import type { IPty } from "node-pty";
import { spawn } from "node-pty";
import { commands } from "vscode";
import { executeCommand } from "./executeCommand";
import { logger } from "./logger";
import type { Profile } from "./profiles/Profile";
import type { Result } from "./types";
import { generatePrompt, generateToken } from "./util/generatePrompts";
import { waitForStartSignal } from "./waitForStartSignal";

const CTRL_C = "\u0003";
const ROWS = 30;
const PROMPT = generatePrompt();
const PROMPT2 = "> ";

export class Pty {
    public pid: number;
    private readonly pty: IPty;
    private ready?: Promise<void>;

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
        logger.debug(`Write command: ${command}`);

        this.ready ??= this.waitForStartSignal();

        try {
            await this.ready;
        } catch (error) {
            this.ready = undefined;
            throw error;
        }

        logger.debug("Shell is ready");

        return executeCommand(
            logger,
            this.pty,
            this.profile,
            command,
            generateToken(),
            PROMPT,
            onData,
        );
    }

    private waitForStartSignal(): Promise<void> {
        return waitForStartSignal(logger, this.pty, generateToken(), PROMPT);
    }
}
