import * as vscode from "vscode";
import { ExtensionMessage } from "../common/ExtensionMessage";
import { getTreeSitterApi } from "./util/treeSitter";
import { Graph } from "./typings/types";
import { createProfile } from "./profiles/Profile";
import { RENDERER_ID } from "./Constants";
import registerCommands from "./commandProvider";
import registerLanguageProvider from "./languageProvider";
import Controller from "./Controller";
import { registerSerializer } from "./Serializer";
import CommandParser from "./util/CommandParser";

export async function activate(context: vscode.ExtensionContext) {
  const { getTree } = await getTreeSitterApi();
  const profile = createProfile();
  const parser = new CommandParser(getTree);

  const {
    disposable: languageDisposable,
    historyPush,
    setCWD,
  } = registerLanguageProvider(profile);

  const graph: Graph = {
    profile,
    historyPush,
    setCWD,
    parser,
  };

  const controller = new Controller(graph);

  context.subscriptions.push(
    languageDisposable,
    controller,
    registerSerializer(),
    registerCommands(parser, controller.doExecution),
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
