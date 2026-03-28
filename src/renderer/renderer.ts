import clipboard from "clipboardy";
import type { ActivationFunction, OutputItem } from "vscode-notebook-renderer";
import type { ExtensionMessage } from "../common/ExtensionMessage";
import type {
    OutputMessage,
    OutputMessageExecuting,
    OutputMessageCompleted,
} from "../common/OutputMessage";
import { Terminal } from "./Terminal";
import terminalCss from "./Terminal.css?inline";
import xtermCss from "@xterm/xterm/css/xterm.css?inline";

export const activate: ActivationFunction = (context) => {
    const uriMap = new Map<string, Terminal>();
    let stylesInjected = false;

    const ensureStyles = () => {
        if (stylesInjected) {
            return;
        }

        const style = document.createElement("style");
        style.textContent = `${xtermCss}\n${terminalCss}`;
        document.head.append(style);
        stylesInjected = true;
    };

    const postMessage = (message: ExtensionMessage) => {
        context.postMessage?.(message);
    };

    const createTerminal = (
        notebookUri: string,
        cellUri: string,
        cols: number,
        element: HTMLElement,
    ) => {
        const term = new Terminal({ cols });

        term.onInput((data) => {
            postMessage({
                type: "data",
                notebookUri,
                cellUri,
                data,
            });
        });

        element.addEventListener("contextmenu", async () => {
            // TODO: Use vscode API to write to clipboard instead of clipboardy
            // const text = await vscode.env.clipboard.getText();
            const text = await clipboard.read();
            term.paste(text);
        });

        term.open(element);

        return term;
    };

    const onExecutingMessage = (
        {
            notebookUri,
            cellUri,
            data,
            cols,
            firstCommand,
        }: OutputMessageExecuting,
        element: HTMLElement,
    ) => {
        if (firstCommand) {
            if (uriMap.has(cellUri)) {
                uriMap.get(cellUri)?.dispose();
            }
            uriMap.set(
                cellUri,
                createTerminal(notebookUri, cellUri, cols, element),
            );
        }

        uriMap.get(cellUri)?.write(data);
    };

    const onCompletedMessage = (
        { notebookUri, cellUri, data, cols }: OutputMessageCompleted,
        element: HTMLElement,
    ) => {
        uriMap.get(cellUri)?.dispose();

        const term = createTerminal(notebookUri, cellUri, cols, element);
        uriMap.set(cellUri, term);
        term.write(data);

        // Stop listening for keyboard inputs
        term.disableInput();

        // Resize number of columns (for next command) based on output element size
        const newCols = term.calcTermCols();
        if (newCols > 0 && term.cols !== newCols) {
            postMessage({
                type: "setCols",
                notebookUri,
                cols: newCols,
            });
        }
    };

    const renderOutputItem = (outputItem: OutputItem, element: HTMLElement) => {
        ensureStyles();

        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        const message = outputItem.json() as OutputMessage;
        switch (message.type) {
            case "executing":
                onExecutingMessage(message, element);
                break;
            case "completed":
                onCompletedMessage(message, element);
                break;
            default:
                throw new Error("Unknown message type");
        }
    };

    return {
        renderOutputItem,
    };
};
