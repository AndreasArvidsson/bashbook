import * as vscode from "vscode";
import type { ExtensionMessage } from "../common/ExtensionMessage";
import { registerCommands } from "./commandProvider";
import { RENDERER_ID } from "./constants";
import { Controller } from "./Controller";
import { registerLanguageProvider } from "./languageProvider";
import { initLogger } from "./logger";
import { createProfile } from "./profiles/createProfile";
import { registerSerializer } from "./Serializer";
import type { Graph } from "./types";
import { CommandParser } from "./util/CommandParser";
import { getTreeSitterApi } from "./util/treeSitter";

export async function activate(
    context: vscode.ExtensionContext,
): Promise<void> {
    const parseTree = await getTreeSitterApi();
    const profile = createProfile();
    const parser = new CommandParser(parseTree);

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
        initLogger(context.extensionMode),
        languageDisposable,
        controller,
        registerSerializer(),
        registerCommands(parser, controller),
        vscode.workspace.onDidOpenNotebookDocument((document) => {
            controller.onDidOpenNotebookDocument(document);
        }),
        vscode.workspace.onDidCloseNotebookDocument((document) => {
            controller.onDidCloseNotebookDocument(document);
        }),
        vscode.window.onDidChangeActiveNotebookEditor((editor) => {
            if (editor != null) {
                controller.syncNotebookDirectory(editor.notebook.uri);
            }
        }),
    );

    const messageChannel =
        vscode.notebooks.createRendererMessaging(RENDERER_ID);

    context.subscriptions.push(
        messageChannel.onDidReceiveMessage((e) => {
            if (!isExtensionMessage(e.message)) {
                throw new Error(
                    `Invalid message received: ${JSON.stringify(e.message)}`,
                );
            }
            switch (e.message.type) {
                case "data":
                    controller.onData(
                        e.message.notebookUri,
                        e.message.cellUri,
                        e.message.data,
                    );
                    break;
                case "setCols":
                    controller.setCols(e.message.notebookUri, e.message.cols);
                    break;
                default:
                    throw new Error("Unknown message type");
            }
        }),
    );
}

function isExtensionMessage(message: unknown): message is ExtensionMessage {
    return typeof message === "object" && message != null && "type" in message;
}
