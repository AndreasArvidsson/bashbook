import * as vscode from "vscode";
import Profile from "../profiles/Profile";

export interface Graph {
  profile: Profile;
  historyPush: (value: string) => void;
  setCWD: (cwd: string) => void;
  getCommandLines: (document: vscode.TextDocument) => string[];
}
