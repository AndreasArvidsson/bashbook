import type { ActivationFunction, OutputItem } from "vscode-notebook-renderer";
import clipboard from "clipboardy";
import {
  OutputMessage,
  OutputMessageData,
  OutputMessageFinished,
} from "../common/OutputMessage";
import { ExtensionMessage } from "../common/ExtensionMessage";
import Terminal from "./Terminal";

export const activate: ActivationFunction = (context) => {
  const uriMap = new Map<string, Terminal>();

  const postMessage = (message: ExtensionMessage) => {
    context.postMessage!(message);
  };

  const createTerminal = (
    notebookUri: string,
    cellUri: string,
    cols: number,
    element: HTMLElement
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
      // TODO
      // const text = await vscode.env.clipboard.getText();
      const text = await clipboard.read();
      term.paste(text);
    });

    term.open(element);

    return term;
  };

  const onDataMessage = (
    { notebookUri, cellUri, data, cols, firstCommand }: OutputMessageData,
    element: HTMLElement
  ) => {
    if (firstCommand) {
      if (uriMap.has(cellUri)) {
        uriMap.get(cellUri)!.dispose();
      }
      uriMap.set(cellUri, createTerminal(notebookUri, cellUri, cols, element));
    }
    const term = uriMap.get(cellUri)!;

    term.write(data);
  };

  const onFinishedMessage = (
    { notebookUri, cellUri, data, cols }: OutputMessageFinished,
    element: HTMLElement
  ) => {
    let term = uriMap.get(cellUri);

    if (!term) {
      term = new Terminal({ cols });
      uriMap.set(cellUri, term);
      term.write(data);
    }

    term.open(element);

    // Stop listening for keyboard inputs
    term.disableInput();

    // Resize number of columns (for next command) based on output element size
    const newCols = term.calcTermCols();
    if (newCols && term.cols !== newCols) {
      postMessage({
        type: "setCols",
        notebookUri,
        cols: newCols,
      });
    }
  };

  const renderOutputItem = (outputItem: OutputItem, element: HTMLElement) => {
    const message: OutputMessage = outputItem.json();
    switch (message.type) {
      case "data":
        onDataMessage(message, element);
        break;
      case "finished":
        onFinishedMessage(message, element);
        break;
    }
  };

  return {
    renderOutputItem,
  };
};
