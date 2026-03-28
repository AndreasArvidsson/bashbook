import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { errorIsENOENT } from "../util/errorIsENOENT";
import type { Profile } from "./Profile";

export class ProfileCsh implements Profile {
    getShell(): string {
        return "csh";
    }

    getPrompts(prompt1: string, prompt2: string): string {
        return [`set prompt="${prompt1}"`, `set prompt2="${prompt2}"`, ""].join(
            "\r",
        );
    }

    getResultCommand(uuid: string): string {
        return `echo "|${uuid}|$status|\`pwd\`|"`;
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
