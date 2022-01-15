import * as vscode from "vscode";
import { Tree } from "web-tree-sitter";
import { toPosition } from "./treeSitter";

export default class CommandParser {
  constructor(private getTree: (document: vscode.TextDocument) => Tree) {}

  getCommandLines(document: vscode.TextDocument) {
    return this.getTree(document)
      .rootNode.children.filter(
        (node) => node.type === "command" || node.type === "list"
      )
      .map((node) => node.text);
  }

  getCommandTextWithPrefix(document: vscode.TextDocument) {
    let result = "";
    let lastPos = new vscode.Position(0, 0);
    const nodes = this.getTree(document).rootNode.children;
    nodes.forEach((node, i) => {
      result += document.getText(
        new vscode.Range(lastPos, toPosition(node.startPosition))
      );
      if (lastPos.line !== node.startPosition.row) {
        result += "$ ";
      }
      result += node.text;
      if (i === nodes.length - 1) {
        result += document.getText(
          new vscode.Range(
            toPosition(node.endPosition),
            document.lineAt(document.lineCount - 1).range.end
          )
        );
      }
      lastPos = toPosition(node.endPosition);
    });
    return result;
  }
}
