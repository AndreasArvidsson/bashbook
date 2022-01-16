import * as vscode from "vscode";
import { LANGUAGE, MIME_PLAINTEXT, NOTEBOOK_TYPE } from "./Constants";
import { ExecutionOptions } from "./Notebook";
import CommandParser from "./util/CommandParser";

const newNotebook = async () => {
  const newNotebook = await vscode.workspace.openNotebookDocument(
    NOTEBOOK_TYPE,
    new vscode.NotebookData([
      new vscode.NotebookCellData(vscode.NotebookCellKind.Code, "", LANGUAGE),
    ])
  );
  await vscode.commands.executeCommand("vscode.open", newNotebook.uri);
};

const openNotebookAsMarkdown = async (parser: CommandParser) => {
  const document = getActiveNotebookDocument();
  if (!document) {
    return;
  }

  const parseCodeCell = (cell: vscode.NotebookCell) => {
    const commands = parser.getCommandTextWithPrefix(cell.document);
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

const openAllOutputsInNewFile = async () => {
  const document = getActiveNotebookDocument();
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

const cellExecuteAndSelect = async () => {
  await vscode.commands.executeCommand("notebook.cell.execute");
  await cellSelect(false);
};

const cellExecuteAndClear = async () => {
  await vscode.commands.executeCommand("notebook.cell.execute");
  await cellSelect(true);
};

const cellClearAndEdit = () => cellSelect(true);

const cellSelect = async (remove: boolean) => {
  await vscode.commands.executeCommand("notebook.cell.edit");
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  const selection = getRangeForDocument(editor);
  if (remove) {
    await editor.edit((editBuilder) => editBuilder.delete(selection));
  } else {
    editor.selections = [selection];
  }
};

const executeWithMarkdownOutput = async (
  doExecution: (
    cell: vscode.NotebookCell,
    options?: ExecutionOptions
  ) => Promise<string>
) => {
  const editorInput = vscode.window.activeTextEditor;
  const cellInput = getActiveCell();
  if (!editorInput || !cellInput) {
    return;
  }

  const cellBelow =
    cellInput.index + 1 < cellInput.notebook.cellCount
      ? cellInput.notebook.cellAt(cellInput.index + 1)
      : null;
  let cellOutput =
    cellBelow && cellBelow.kind === vscode.NotebookCellKind.Markup
      ? cellBelow
      : null;

  if (cellOutput) {
    const editor = getEditorForCell(cellOutput);
    if (editor) {
      await editor.edit((editBuilder) => {
        editBuilder.delete(getRangeForDocument(editor));
      });
    }
  }

  const plaintext = await doExecution(cellInput, { noOutput: true });
  editorInput.selections = [getRangeForDocument(editorInput)];

  if (!cellOutput) {
    await vscode.commands.executeCommand(
      "notebook.cell.insertMarkdownCellBelow"
    );
    cellOutput = cellInput.notebook.cellAt(cellInput.index + 1);
  }

  const editor = getEditorForCell(cellOutput);
  if (editor) {
    await editor.edit((editBuilder) => {
      editBuilder.insert(new vscode.Position(0, 0), plaintext);
    });
  }
};

const cellOpenOutputInNewFile = async () => {
  const cell = getActiveCell();
  if (cell) {
    const newDocument = await vscode.workspace.openTextDocument({
      content: getCellPlainTextOutput(cell),
      language: "plaintext",
    });
    await vscode.commands.executeCommand("vscode.open", newDocument.uri);
  }
};

const cellCopyOutput = async () => {
  const cell = getActiveCell();
  if (cell) {
    await vscode.env.clipboard.writeText(getCellPlainTextOutput(cell));
  }
};

export default (
  parser: CommandParser,
  doExecution: (
    cell: vscode.NotebookCell,
    options?: ExecutionOptions
  ) => Promise<string>
) => {
  return vscode.Disposable.from(
    registerCommand("newNotebook", newNotebook),
    registerCommand("openNotebookAsMarkdown", () =>
      openNotebookAsMarkdown(parser)
    ),
    registerCommand("openAllOutputsInNewFile", openAllOutputsInNewFile),
    registerCommand("cell.executeAndSelect", cellExecuteAndSelect),
    registerCommand("cell.executeAndClear", cellExecuteAndClear),
    registerCommand("cell.executeWithMarkdownOutput", () =>
      executeWithMarkdownOutput(doExecution)
    ),
    registerCommand("cell.clearAndEdit", cellClearAndEdit),
    registerCommand("cell.copyOutput", cellCopyOutput),
    registerCommand("cell.openOutputInNewFile", cellOpenOutputInNewFile)
  );
};

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

function getNotebookFromCellDocument(document: vscode.TextDocument) {
  return (document as any).notebook as vscode.NotebookDocument | undefined;
}

function getActiveNotebookDocument() {
  const editor = vscode.window.activeTextEditor;
  return editor ? getNotebookFromCellDocument(editor.document) : undefined;
}

function getActiveCell() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  return getNotebookFromCellDocument(editor.document)
    ?.getCells()
    .find((cell) => cell.document === editor.document);
}

function getEditorForCell(cell: vscode.NotebookCell) {
  return vscode.window.visibleTextEditors.find(
    (editor) => editor.document === cell.document
  );
}

function getRangeForDocument(editor: vscode.TextEditor) {
  return new vscode.Selection(
    new vscode.Position(0, 0),
    editor.document.lineAt(editor.document.lineCount - 1).range.end
  );
}
