import * as vscode from "vscode";
import * as os from "os";
import * as path from "path";

export default (notebookUri: vscode.Uri) => {
  if (notebookUri.scheme === "file") {
    return path.dirname(notebookUri.fsPath);
  }
  if (vscode.workspace.workspaceFolders?.length) {
    return path.resolve(vscode.workspace.workspaceFolders[0].uri.fsPath);
  }
  return os.homedir();
};
