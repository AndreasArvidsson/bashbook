import * as vscode from "vscode";
import { SyntaxNode, Tree } from "web-tree-sitter";

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
