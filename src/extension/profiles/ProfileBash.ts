import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { errorIsENOENT } from "../util/errorIsENOENT";
import type { Profile } from "./Profile";

export class ProfileBash implements Profile {
    getShell(): string {
        return os.platform() === "win32" ? "bash.exe" : "bash";
    }

    getPrompts(prompt: string): string {
        return [`export PS1='${prompt}'`, `export PS2='${prompt}'`, ""].join(
            "\r",
        );
    }

    getResultCommand(uuid: string): string {
        return `echo "|${uuid}|$?|$(pwd)|"`;
    }

    updateRootPath(rootPath: string): string {
        return rootPath;
    }

    nodeToShellPath(shellPath: string): string {
        return shellPath;
    }

    wrapCommand(command: string): string {
        return command;
    }

    async readHistory(): Promise<string[]> {
        try {
            const historyFile = path.resolve(os.homedir(), ".bash_history");
            const content = await fs.readFile(historyFile, "utf8");
            return content
                .split(/\r?\n/)
                .map((l) => l.trim())
                .filter((l) => l.length > 0);
        } catch (error) {
            if (!errorIsENOENT(error)) {
                console.error(error);
            }
            return [];
        }
    }
}
