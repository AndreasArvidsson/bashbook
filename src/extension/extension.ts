import * as vscode from "vscode";
import { ExtensionMessage } from "../common/ExtensionMessage";
import { registerCommands } from "./commands";
import { registerLanguageProvider } from "./languageProvider";
import Controller from "./Controller";
import { registerSerializer } from "./Serializer";
import { RENDERER_ID } from "./Constants";
import { Graph } from "./typings/types";
import { createProfile } from "./profiles/Profile";
import { getTreeSitterApi } from "./treeSitter";

export async function activate(context: vscode.ExtensionContext) {
  const { getTree } = await getTreeSitterApi();
  const profile = createProfile();

  const {
    disposable: languageDisposable,
    historyPush,
    setCWD,
  } = registerLanguageProvider(profile);

  const graph: Graph = {
    profile,
    historyPush,
    setCWD,
    getTree,
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
