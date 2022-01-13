import * as vscode from "vscode";
import { Tree } from "web-tree-sitter";
import Profile from "../profiles/Profile";

export interface Graph {
  profile: Profile;
  historyPush: (value: string) => void;
  setCWD: (cwd: string) => void;
  getTree(document: vscode.TextDocument): Tree;
}
