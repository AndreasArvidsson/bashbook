import * as vscode from "vscode";
import { Tree } from "web-tree-sitter";
import { toPosition } from "./treeSitter";

export default (
  getTree: (document: vscode.TextDocument) => Tree,
  document: vscode.TextDocument
) => {
  const result: string[] = [];
  const nodes = getTree(document).rootNode.children.filter(
    (child) => child.type === "command"
  );
  let i = 0;

  while (i < nodes.length) {
    const node = nodes[i];
    const start = toPosition(node.startPosition);
    let end;

    if (i === nodes.length - 1) {
      end = toPosition(node.endPosition);
      i = nodes.length;
    } else {
      const index = nodes.findIndex(
        (n) => n.startPosition.row > node.endPosition.row
      );
      if (index > -1) {
        end = toPosition(nodes[index].startPosition);
        i = index;
      } else {
        end = toPosition(nodes[nodes.length - 1].endPosition);
        i = nodes.length;
      }
    }

    result.push(document.getText(new vscode.Range(start, end)));
  }

  return result;
};
