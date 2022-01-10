import * as vscode from "vscode";
import { LANGUAGE, NOTEBOOK_TYPE } from "./Constants";

const executeAndClear = async () => {
  await vscode.commands.executeCommand(
    "notebook.cell.executeAndFocusContainer"
  );
  await clearAndEdit();
};

const clearAndEdit = async () => {
  await vscode.commands.executeCommand("notebook.cell.edit");
  const editor = vscode.window.activeTextEditor;
  await editor?.edit((editBuilder) => {
    const firstLine = editor.document.lineAt(0);
    const lastLine = editor.document.lineAt(editor.document.lineCount - 1);
    editBuilder.delete(
      new vscode.Range(firstLine.range.start, lastLine.range.end)
    );
  });
};

const newNotebook = async () => {
  const newNotebook = await vscode.workspace.openNotebookDocument(
    NOTEBOOK_TYPE,
    new vscode.NotebookData([
      new vscode.NotebookCellData(vscode.NotebookCellKind.Code, "", LANGUAGE),
    ])
  );
  await vscode.commands.executeCommand("vscode.open", newNotebook.uri);
};

export function registerCommands() {
  return vscode.Disposable.from(
    vscode.commands.registerCommand(
      "bashbook.cell.executeAndClear",
      executeAndClear
    ),
    vscode.commands.registerCommand("bashbook.cell.clearAndEdit", clearAndEdit),
    vscode.commands.registerCommand("bashbook.newNotebook", newNotebook)
  );
}
