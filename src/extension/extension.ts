import { ExtensionContext, notebooks, workspace } from "vscode";
import { ExtensionMessage } from "../common/ExtensionMessage";
import { registerCommands } from "./commands";
import { registerLanguageProvider } from "./languageProvider";
import Controller from "./Controller";
import Serializer from "./Serializer";

export function activate(context: ExtensionContext) {
  context.subscriptions.push(registerCommands());

  context.subscriptions.push(
    workspace.registerNotebookSerializer("bashbook", new Serializer(), {
      transientOutputs: true,
    })
  );

  const { disposable: languageDisposable, historyPush } =
    registerLanguageProvider();
  context.subscriptions.push(languageDisposable);

  const controller = new Controller(historyPush);
  context.subscriptions.push(controller);

  const messageChannel = notebooks.createRendererMessaging("bashbook-renderer");

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
