import * as vscode from "vscode";
import Controller from "./Controller";
import Serializer from "./Serializer";

export async function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.workspace.registerNotebookSerializer(
      "bash-notebook",
      new Serializer(),
      {
        transientOutputs: true,
      }
    )
  );

  context.subscriptions.push(await Controller.create());
}

export function deactivate() {}
