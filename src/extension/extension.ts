import * as vscode from "vscode";
import Controller from "./Controller";
import Serializer from "./Serializer";

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.workspace.registerNotebookSerializer("bashbook", new Serializer(), {
      transientOutputs: true,
    })
  );

  const controller = new Controller();
  context.subscriptions.push(controller);

  const messageChannel =
    vscode.notebooks.createRendererMessaging("bashbook-renderer");

  messageChannel.onDidReceiveMessage((e) => {
    const { uri, data } = e.message;
    controller.onData(uri, data);
  });
}

export function deactivate() {}
