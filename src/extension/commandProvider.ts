import * as vscode from "vscode";
import { LANGUAGE, MIME_PLAINTEXT, NOTEBOOK_TYPE } from "./Constants";
import type { Controller } from "./Controller";
import type { CommandParser } from "./util/CommandParser";

async function createNewNotebook() {
    const newNotebook = await vscode.workspace.openNotebookDocument(
        NOTEBOOK_TYPE,
        new vscode.NotebookData([
            new vscode.NotebookCellData(
                vscode.NotebookCellKind.Code,
                "",
                LANGUAGE,
            ),
        ]),
    );
    await vscode.commands.executeCommand("vscode.open", newNotebook.uri);
}

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
            const lines: string[] = [];
            if (cell.kind === vscode.NotebookCellKind.Markup) {
                lines.push(cell.document.getText().trim());
                lines.push("");
            } else {
                lines.push(parseCodeCell(cell));
            }
            return lines.join("\n");
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
        await editor.edit((editBuilder) => {
            editBuilder.delete(selection);
        });
    } else {
        editor.selections = [selection];
    }
};

async function executeWithMarkdownOutput(
    controller: Controller,
): Promise<void> {
    const editorInput = vscode.window.activeTextEditor;
    const cellInput = getActiveCell();

    if (editorInput == null || cellInput == null) {
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

    if (cellOutput != null) {
        const editor = getEditorForCell(cellOutput);
        if (editor != null) {
            await editor.edit((editBuilder) => {
                editBuilder.delete(getRangeForDocument(editor));
            });
        }
    }

    const plaintext = await controller.doExecution(cellInput, {
        noOutput: true,
    });
    editorInput.selections = [getRangeForDocument(editorInput)];

    if (cellOutput == null) {
        await vscode.commands.executeCommand(
            "notebook.cell.insertMarkdownCellBelow",
        );
        cellOutput = cellInput.notebook.cellAt(cellInput.index + 1);
    }

    const editor = getEditorForCell(cellOutput);
    if (editor != null) {
        await editor.edit((editBuilder) => {
            editBuilder.insert(new vscode.Position(0, 0), plaintext);
        });
    }
}

async function cellOpenOutputInNewFile(): Promise<void> {
    const cell = getActiveCell();
    if (cell != null) {
        const newDocument = await vscode.workspace.openTextDocument({
            content: getCellPlainTextOutput(cell),
            language: "plaintext",
        });
        await vscode.commands.executeCommand("vscode.open", newDocument.uri);
    }
}

async function cellCopyOutput(): Promise<void> {
    const cell = getActiveCell();
    if (cell != null) {
        await vscode.env.clipboard.writeText(getCellPlainTextOutput(cell));
    }
}

export function registerCommands(
    parser: CommandParser,
    controller: Controller,
): vscode.Disposable {
    return vscode.Disposable.from(
        registerCommand("newNotebook", createNewNotebook),
        registerCommand("openNotebookAsMarkdown", () =>
            openNotebookAsMarkdown(parser),
        ),
        registerCommand("openAllOutputsInNewFile", openAllOutputsInNewFile),
        registerCommand("cell.executeAndSelect", cellExecuteAndSelect),
        registerCommand("cell.executeAndClear", cellExecuteAndClear),
        registerCommand("cell.executeWithMarkdownOutput", () =>
            executeWithMarkdownOutput(controller),
        ),
        registerCommand("cell.clearAndEdit", cellClearAndEdit),
        registerCommand("cell.copyOutput", cellCopyOutput),
        registerCommand("cell.openOutputInNewFile", cellOpenOutputInNewFile),
    );
}

function registerCommand(
    command: string,
    callback: (...args: unknown[]) => unknown,
): vscode.Disposable {
    return vscode.commands.registerCommand(
        `${NOTEBOOK_TYPE}.${command}`,
        callback,
    );
}

function getCellPlainTextOutput(cell: vscode.NotebookCell): string {
    const data: string[] = [];
    cell.outputs.forEach((output) => {
        output.items.forEach((item) => {
            if (item.mime === MIME_PLAINTEXT) {
                data.push(String.fromCodePoint(...item.data));
            }
        });
    });
    return data.join("\n");
}

function getNotebookFromCellDocument(
    document: vscode.TextDocument,
): vscode.NotebookDocument | undefined {
    return vscode.window.visibleNotebookEditors.find((editor) =>
        editor.notebook.getCells().some((cell) => cell.document === document),
    )?.notebook;
}

function getActiveNotebookDocument(): vscode.NotebookDocument | undefined {
    const editor = vscode.window.activeTextEditor;
    return editor ? getNotebookFromCellDocument(editor.document) : undefined;
}

function getActiveCell(): vscode.NotebookCell | undefined {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return undefined;
    }
    return getNotebookFromCellDocument(editor.document)
        ?.getCells()
        .find((cell) => cell.document === editor.document);
}

function getEditorForCell(
    cell: vscode.NotebookCell,
): vscode.TextEditor | undefined {
    return vscode.window.visibleTextEditors.find(
        (editor) => editor.document === cell.document,
    );
}

function getRangeForDocument(editor: vscode.TextEditor): vscode.Selection {
    return new vscode.Selection(
        new vscode.Position(0, 0),
        editor.document.lineAt(editor.document.lineCount - 1).range.end,
    );
}
