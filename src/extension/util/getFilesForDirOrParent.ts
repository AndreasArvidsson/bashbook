import * as fs from "node:fs";
import * as path from "node:path";

export function getFilesForDirOrParent(absPath: string): {
    files: string[];
    name: string;
} {
    try {
        const stat = fs.statSync(absPath);
        if (stat.isDirectory()) {
            return {
                files: fs.readdirSync(absPath),
                name: "",
            };
        }
    } catch {
        // If the path does not exist, we want to try the parent directory
    }

    const parentPath = path.dirname(absPath);
    if (absPath !== parentPath) {
        try {
            return {
                files: fs.readdirSync(parentPath),
                name: path.basename(absPath),
            };
        } catch {
            // If the parent path does not exist, we return an empty list
        }
    }

    return {
        files: [],
        name: "",
    };
}
