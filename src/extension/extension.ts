import * as vscode from "vscode";
import { ExtensionMessage } from "../common/ExtensionMessage";
import { registerCommands } from "./commands";
import { registerLanguageProvider } from "./languageProvider";
import Controller from "./Controller";
import { registerSerializer } from "./Serializer";
import { RENDERER_ID } from "./Constants";
import { Graph } from "./types";

export function activate(context: vscode.ExtensionContext) {
  const {
    disposable: languageDisposable,
    historyPush,
    setCWD,
  } = registerLanguageProvider();

  const graph: Graph = {
    historyPush,
    setCWD,
  };

  const controller = new Controller(graph);

  context.subscriptions.push(
    languageDisposable,
    controller,
    registerSerializer(),
    registerCommands(),
    vscode.workspace.onDidOpenNotebookDocument(
      controller.onDidOpenNotebookDocument
    ),
    vscode.workspace.onDidCloseNotebookDocument(
      controller.onDidCloseNotebookDocument
    )
  );

  const messageChannel = vscode.notebooks.createRendererMessaging(RENDERER_ID);

  context.subscriptions.push(
    messageChannel.onDidReceiveMessage((e) => {
      const message: ExtensionMessage = e.message;
      switch (message.type) {
        case "data":
          controller.onData(message.notebookUri, message.cellUri, message.data);
          break;
        case "setCols":
          controller.setCols(message.notebookUri, message.cols);
          break;
      }
    })
  );
}

export function deactivate() {}
