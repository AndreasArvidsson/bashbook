import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { errorIsENOENT } from "../util/errorIsENOENT";
import type { Profile } from "./Profile";

export class ProfileCsh implements Profile {
    getShell(): string {
        return "csh";
    }

    getPromtp1(prompt: string): string {
        return `set prompt="${prompt}"`;
    }

    getPrompt2(prompt: string): string {
        return `set prompt2="${prompt}"`;
    }

    getResultCommand(token: string): string {
        return `echo "|${token}|exit:$status|cwd:\`pwd\`|"`;
    }

    updateRootPath(rootPath: string): string {
        return rootPath;
    }

    nodeToShellPath(shellPath: string): string {
        return shellPath;
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
