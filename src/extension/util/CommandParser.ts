import * as vscode from "vscode";
import type { Node } from "web-tree-sitter";
import { toPosition } from "./treeSitter";
import type { ParseTreeApi } from "./treeSitter";

export class CommandParser {
    public constructor(private readonly parseTree: ParseTreeApi) {}

    public getCommandLines(document: vscode.TextDocument): string[] {
        return this.parseTree
            .getTree(document)
            .rootNode.children.filter((n) => this.nodeIsCode(n))
            .map((node) => node.text);
    }

    public getCommandTextWithPrefix(document: vscode.TextDocument): string {
        let result = "";
        let lastPos = new vscode.Position(0, 0);
        let lastCodePos = new vscode.Position(0, 0);
        const nodes = this.parseTree.getTree(document).rootNode.children;
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
                        document.lineAt(document.lineCount - 1).range.end,
                    ),
                );
            }
            lastPos = endPos;
        });
        return result;
    }

    private nodeIsCode(node: Node): boolean {
        switch (node.type) {
            case "comment":
            case "ERROR":
                return false;
            default:
                return node.text.trim().length > 0;
        }
    }
}
