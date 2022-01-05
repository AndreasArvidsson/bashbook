import * as vscode from "vscode";
import Controller from "./Controller";
import Serializer from "./Serializer";

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.workspace.registerNotebookSerializer(
      "bash-notebook",
      new Serializer()
    )
  );
  context.subscriptions.push(new Controller());
}

export function deactivate() {}
