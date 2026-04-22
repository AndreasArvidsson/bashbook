import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { errorIsENOENT } from "../util/errorIsENOENT";
import type { Profile } from "./Profile";

export class ProfileBash implements Profile {
    public getShell(): string {
        return os.platform() === "win32" ? "bash.exe" : "bash";
    }

    public getPromtp1(prompt: string): string {
        return `export PS1='${prompt}'`;
    }

    public getPrompt2(prompt: string): string {
        return `export PS2='${prompt}'`;
    }

    public getResultCommand(token: string): string {
        return `echo "|${token}|exit:$?|cwd:$(pwd)|"`;
    }

    public updateRootPath(rootPath: string): string {
        return rootPath;
    }

    public nodeToShellPath(shellPath: string): string {
        return shellPath;
    }

    public async readHistory(): Promise<string[]> {
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
