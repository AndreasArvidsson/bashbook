import * as vscode from "vscode";
import { LANGUAGE, MIME_PLAINTEXT, NOTEBOOK_TYPE } from "./Constants";

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

const openAllOutputsInNewFile = async (editor: NotebookEditor) => {
  const document = vscode.workspace.notebookDocuments.find(
    (notebook) =>
      notebook.uri.toString() ===
      editor?.notebookEditor?.notebookUri?.toString()
  );
  if (!document) {
    return;
  }
  const content = document
    .getCells()
    .map(cellToString)
    .filter(Boolean)
    .join("\n----------\n");
  const newDocument = await vscode.workspace.openTextDocument({
    content,
    language: MIME_PLAINTEXT,
  });
  await vscode.commands.executeCommand("vscode.open", newDocument.uri);
};

const openCellOutputInNewFile = async (cell: vscode.NotebookCell) => {
  const newDocument = await vscode.workspace.openTextDocument({
    content: cellToString(cell),
    language: MIME_PLAINTEXT,
  });
  await vscode.commands.executeCommand("vscode.open", newDocument.uri);
};

export const registerCommands = () =>
  vscode.Disposable.from(
    registerCommand("cell.executeAndClear", executeAndClear),
    registerCommand("cell.clearAndEdit", clearAndEdit),
    registerCommand("newNotebook", newNotebook),
    registerCommand("openAllOutputsInNewFile", openAllOutputsInNewFile),
    registerCommand("openCellOutputInNewFile", openCellOutputInNewFile)
  );

function registerCommand(command: string, callback: (...args: any[]) => any) {
  return vscode.commands.registerCommand(
    `${NOTEBOOK_TYPE}.${command}`,
    callback
  );
}

function cellToString(cell: vscode.NotebookCell) {
  const data: string[] = [];
  cell.outputs.forEach((output) =>
    output.items.forEach((item) => {
      if (item.mime === MIME_PLAINTEXT) {
        data.push(String.fromCharCode(...item.data));
      }
    })
  );
  return data.join("\n");
}

interface NotebookEditor {
  notebookEditor?: {
    notebookUri?: vscode.Uri;
  };
}
