import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";

export function getNotebookDirectory(notebookUri: vscode.Uri): string {
    if (notebookUri.scheme === "file") {
        return path.dirname(notebookUri.fsPath);
    }
    const { workspaceFolders } = vscode.workspace;
    if (workspaceFolders != null && workspaceFolders.length > 0) {
        return path.resolve(workspaceFolders[0].uri.fsPath);
    }
    return os.homedir();
}
