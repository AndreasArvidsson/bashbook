import { commands, Disposable, window, Range } from "vscode";

const executeAndClear = async () => {
  await commands.executeCommand("notebook.cell.executeAndFocusContainer");
  await clearAndEdit();
};

const clearAndEdit = async () => {
  await commands.executeCommand("notebook.cell.edit");
  const editor = window.activeTextEditor;
  await editor?.edit((editBuilder) => {
    const firstLine = editor.document.lineAt(0);
    const lastLine = editor.document.lineAt(editor.document.lineCount - 1);
    editBuilder.delete(new Range(firstLine.range.start, lastLine.range.end));
  });
};

export function registerCommands() {
  return Disposable.from(
    commands.registerCommand("bashbook.cell.executeAndClear", executeAndClear),
    commands.registerCommand("bashbook.cell.clearAndEdit", clearAndEdit)
  );
}
