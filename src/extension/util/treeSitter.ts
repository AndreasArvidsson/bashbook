import * as vscode from "vscode";
import type { Point, Node, Tree } from "web-tree-sitter";

export interface ParseTreeApi {
    getNodeAtLocation(location: vscode.Location): Node;
    getTree(document: vscode.TextDocument): Tree;
    loadLanguage: (languageId: string) => Promise<boolean>;
}

export function getTreeSitterApi(): Promise<ParseTreeApi> {
    const extension = vscode.extensions.getExtension("pokey.parse-tree");
    if (extension == null) {
        throw new Error("Can't get extension 'pokey.parse-tree'");
    }
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return extension.activate() as Promise<ParseTreeApi>;
}

export function toRange(start: Point, end: Point): vscode.Range {
    return new vscode.Range(start.row, start.column, end.row, end.column);
}

export function toPosition(point: Point): vscode.Position {
    return new vscode.Position(point.row, point.column);
}
