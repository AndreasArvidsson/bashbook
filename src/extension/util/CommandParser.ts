import * as vscode from "vscode";
import { Tree } from "web-tree-sitter";
import Parser = require("web-tree-sitter");
import { toPosition } from "./treeSitter";

export default class CommandParser {
  constructor(private getTree: (document: vscode.TextDocument) => Tree) {}

  getCommandLines(document: vscode.TextDocument) {
    return this.getTree(document)
      .rootNode.children.filter(this.nodeIsCode)
      .map((node) => node.text);
  }

  getCommandTextWithPrefix(document: vscode.TextDocument) {
    let result = "";
    let lastPos = new vscode.Position(0, 0);
    let lastCodePos = new vscode.Position(0, 0);
    const nodes = this.getTree(document).rootNode.children;
    nodes.forEach((node, i) => {
      const startPos = toPosition(node.startPosition);
      const endPos = toPosition(node.endPosition);
      result += document.getText(new vscode.Range(lastPos, startPos));
      if (this.nodeIsCode(node)) {
        if (startPos.line === 0 || startPos.line !== lastCodePos.line) {
          result += "$ ";
        }
        lastCodePos = endPos;
      }
      result += node.text;
      if (i === nodes.length - 1) {
        result += document.getText(
          new vscode.Range(
            endPos,
            document.lineAt(document.lineCount - 1).range.end
          )
        );
      }
      lastPos = endPos;
    });
    return result;
  }

  private nodeIsCode(node: Parser.SyntaxNode) {
    switch (node.type) {
      case "command":
      case "declaration_command":
      case "list":
      case "pipeline":
        return true;
    }
    return false;
  }
}
