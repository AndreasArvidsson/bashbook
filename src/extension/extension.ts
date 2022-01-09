import * as vscode from "vscode";
import { ExtensionMessage } from "../common/ExtensionMessage";
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
    const message: ExtensionMessage = e.message;
    switch (message.type) {
      case "data":
        controller.onData(message.uri, message.data);
        break;
      case "setCols":
        controller.setCols(message.cols);
        break;
    }
  });
}

export function deactivate() {}
