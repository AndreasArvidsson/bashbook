import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { errorIsENOENT } from "../util/errorIsENOENT";
import type { Profile } from "./Profile";

export class ProfileCsh implements Profile {
    getShell(): string {
        return "csh";
    }

    updateRootPath(rootPath: string): string {
        return rootPath;
    }

    nodeToShellPath(shellPath: string): string {
        return shellPath;
    }

    getPS1(uuid: string): string {
        return `set prompt="${uuid}|echo $status|pwd|"\r`;
    }

    getPS2(ps2: string): string {
        return `set prompt2="${ps2}"\r`;
    }

    async readHistory(): Promise<string[]> {
        try {
            const historyFile = path.resolve(os.homedir(), ".history");
            const content = await fs.readFile(historyFile, "utf8");
            return content
                .split(/\r?\n/)
                .map((l) => l.trim())
                .filter((l) => l.length > 0 && !l.startsWith("#"));
        } catch (error) {
            if (!errorIsENOENT(error)) {
                console.error(error);
            }
            return [];
        }
    }
}
