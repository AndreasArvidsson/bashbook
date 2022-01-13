import * as vscode from "vscode";
import { Point, SyntaxNode, Tree } from "web-tree-sitter";

export interface ParseTreeApi {
  getNodeAtLocation(location: vscode.Location): SyntaxNode;
  getTree(document: vscode.TextDocument): Tree;
  loadLanguage: (languageId: string) => Promise<boolean>;
}

export const getTreeSitterApi = async () => {
  const extension = vscode.extensions.getExtension("pokey.parse-tree");
  if (!extension) {
    throw new Error("Can't get extension 'pokey.parse-tree'");
  }
  return <Promise<ParseTreeApi>>extension.activate();
};

export const toRange = (start: Point, end: Point) =>
  new vscode.Range(start.row, start.column, end.row, end.column);

export const toPosition = (point: Point) =>
  new vscode.Position(point.row, point.column);
