import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { errorIsENOENT } from "../util/errorIsENOENT";
import type { Profile } from "./Profile";

export class ProfileBash implements Profile {
    getShell(): string {
        return os.platform() === "win32" ? "bash.exe" : "bash";
    }

    updateRootPath(rootPath: string): string {
        return rootPath;
    }

    nodeToShellPath(shellPath: string): string {
        return shellPath;
    }

    getPS1(uuid: string): string {
        return `export PS1='${uuid}|$?|$(pwd)|'\r`;
    }

    getPS2(ps2: string): string {
        return `export PS2='${ps2}'\r`;
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
