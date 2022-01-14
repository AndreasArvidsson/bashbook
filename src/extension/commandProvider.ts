import * as vscode from "vscode";
import Parser = require("web-tree-sitter");
import { LANGUAGE, MIME_PLAINTEXT, NOTEBOOK_TYPE } from "./Constants";
import { Graph } from "./typings/types";

const cellExecuteAndClear = async () => {
  await vscode.commands.executeCommand(
    "notebook.cell.executeAndFocusContainer"
  );
  await cellClearAndEdit();
};

const cellClearAndEdit = async () => {
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
    .map(getCellPlainTextOutput)
    .filter(Boolean)
    .join("\n\n----------\n\n");
  const newDocument = await vscode.workspace.openTextDocument({
    content,
    language: "plaintext",
  });
  await vscode.commands.executeCommand("vscode.open", newDocument.uri);
};

const openNotebookAsMarkdown = async (editor: NotebookEditor, graph: Graph) => {
  const document = vscode.workspace.notebookDocuments.find(
    (notebook) =>
      notebook.uri.toString() ===
      editor?.notebookEditor?.notebookUri?.toString()
  );
  if (!document) {
    return;
  }

  const parseCodeCell = (cell: vscode.NotebookCell) => {
    const commands = graph.getCommandLines(cell.document);
    const output = getCellPlainTextOutput(cell);
    let content = "```bash\n";
    if (commands.length) {
      content += commands.map((command) => "$ " + command).join("");
    } else {
      content += "$";
    }
    if (output) {
      content += `\n\n${output}`;
    }
    content += "\n```\n";
    return content;
  };

  const content = document
    .getCells()
    .map((cell) => {
      const content = [];
      if (cell.kind === vscode.NotebookCellKind.Markup) {
        content.push(cell.document.getText().trim() + "\n");
      } else {
        content.push(parseCodeCell(cell));
      }
      return content.join("\n");
    })
    .join("\n");

  const newDocument = await vscode.workspace.openTextDocument({
    content,
    language: "markdown",
  });
  await vscode.commands.executeCommand("vscode.open", newDocument.uri);
};

const cellOpenOutputInNewFile = async (cell: vscode.NotebookCell) => {
  const newDocument = await vscode.workspace.openTextDocument({
    content: getCellPlainTextOutput(cell),
    language: "plaintext",
  });
  await vscode.commands.executeCommand("vscode.open", newDocument.uri);
};

export default (graph: Graph) =>
  vscode.Disposable.from(
    registerCommand("newNotebook", newNotebook),
    registerCommand("openAllOutputsInNewFile", openAllOutputsInNewFile),
    registerCommand("openNotebookAsMarkdown", (editor) =>
      openNotebookAsMarkdown(editor, graph)
    ),
    registerCommand("cell.executeAndClear", cellExecuteAndClear),
    registerCommand("cell.clearAndEdit", cellClearAndEdit),
    registerCommand("cell.openOutputInNewFile", cellOpenOutputInNewFile)
  );

function registerCommand(command: string, callback: (...args: any[]) => any) {
  return vscode.commands.registerCommand(
    `${NOTEBOOK_TYPE}.${command}`,
    callback
  );
}

function getCellPlainTextOutput(cell: vscode.NotebookCell) {
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