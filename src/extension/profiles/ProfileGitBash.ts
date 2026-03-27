import * as path from "node:path";
import { ProfileBash } from "./ProfileBash";

export class ProfileGitBash extends ProfileBash {
    useConpty = false;

    getShell(): string {
        return "C:/Program Files/Git/bin/bash.exe";
    }

    nodeToShellPath(shellPathSource: string): string {
        let shellPath = shellPathSource;
        // c: => /c/
        if (/^[a-zA-Z]:/.test(shellPath)) {
            shellPath = `/${shellPath[0]}/${shellPath.slice(2)}`;
        }
        return shellPath.replace(/\\/, "/");
    }

    updateRootPath(rootPath: string): string {
        // /c/ => c:
        if (/^\/[a-zA-Z]\//.test(rootPath)) {
            return `${rootPath[1]}:${rootPath.slice(2)}`;
        }
        if (rootPath.startsWith("/")) {
            return path.join("C:/Program Files/Git", rootPath);
        }
        return rootPath;
    }
}
