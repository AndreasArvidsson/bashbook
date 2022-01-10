import { ExtensionContext, notebooks, workspace } from "vscode";
import { ExtensionMessage } from "../common/ExtensionMessage";
import { registerCommands } from "./commands";
import { registerLanguageProvider } from "./languageProvider";
import Controller from "./Controller";
import Serializer from "./Serializer";
import { NOTEBOOK_TYPE, RENDERER_ID } from "./Constants";

export function activate(context: ExtensionContext) {
  context.subscriptions.push(registerCommands());

  context.subscriptions.push(
    workspace.registerNotebookSerializer(NOTEBOOK_TYPE, new Serializer(), {
      transientOutputs: true,
    })
  );

  const {
    disposable: languageDisposable,
    historyPush,
    setCWD,
  } = registerLanguageProvider();
  context.subscriptions.push(languageDisposable);

  const controller = new Controller(historyPush, setCWD);
  context.subscriptions.push(controller);

  const messageChannel = notebooks.createRendererMessaging(RENDERER_ID);

  context.subscriptions.push(
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
    })
  );
}

export function deactivate() {}
