import * as vscode from "vscode";
import { LANGUAGE, MIME_PLAINTEXT, NOTEBOOK_TYPE } from "./Constants";
import { Graph } from "./typings/types";

const cellExecuteAndSelect = async () => {
  await vscode.commands.executeCommand(
    "notebook.cell.executeAndFocusContainer"
  );
  await cellSelect(false);
};

const cellExecuteAndClear = async () => {
  await vscode.commands.executeCommand(
    "notebook.cell.executeAndFocusContainer"
  );
  await cellSelect(true);
};

const cellClearAndEdit = () => cellSelect(true);

const cellSelect = async (remove: boolean) => {
  await vscode.commands.executeCommand("notebook.cell.edit");
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  const firstLine = editor.document.lineAt(0);
  const lastLine = editor.document.lineAt(editor.document.lineCount - 1);
  const selection = new vscode.Selection(
    firstLine.range.start,
    lastLine.range.end
  );
  if (remove) {
    await editor.edit((editBuilder) => {
      editBuilder.delete(selection);
    });
  } else {
    editor.selections = [selection];
  }
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
    const commands = graph.parser.getCommandTextWithPrefix(cell.document);
    const output = getCellPlainTextOutput(cell);
    let content = "```bash\n";
    content += commands || "$";
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

const cellCopyOutput = async (cell: vscode.NotebookCell) => {
  await vscode.env.clipboard.writeText(getCellPlainTextOutput(cell));
};

export default (graph: Graph) =>
  vscode.Disposable.from(
    registerCommand("newNotebook", newNotebook),
    registerCommand("openAllOutputsInNewFile", openAllOutputsInNewFile),
    registerCommand("openNotebookAsMarkdown", (editor) =>
      openNotebookAsMarkdown(editor, graph)
    ),
    registerCommand("cell.executeAndSelect", cellExecuteAndSelect),
    registerCommand("cell.executeAndClear", cellExecuteAndClear),
    registerCommand("cell.clearAndEdit", cellClearAndEdit),
    registerCommand("cell.copyOutput", cellCopyOutput),
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
