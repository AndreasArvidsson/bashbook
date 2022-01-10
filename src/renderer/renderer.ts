import type { ActivationFunction, OutputItem } from "vscode-notebook-renderer";
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

  const createTerminal = (uri: string, cols: number, element: HTMLElement) => {
    const term = new Terminal({
      cols,
    });

    term.onInput((data) => {
      postMessage({
        type: "data",
        uri,
        data,
      });
    });

    term.open(element);

    return term;
  };

  const onDataMessage = (
    { uri, data, cols, firstCommand }: OutputMessageData,
    element: HTMLElement
  ) => {
    if (firstCommand) {
      if (uriMap.has(uri)) {
        uriMap.get(uri)!.dispose();
      }
      uriMap.set(uri, createTerminal(uri, cols, element));
    }
    const term = uriMap.get(uri)!;

    term.writeData(data);
  };

  const onFinishedMessage = (
    { uri }: OutputMessageFinished,
    element: HTMLElement
  ) => {
    const term = uriMap.get(uri)!;

    term.open(element);

    // Stop listening for keyboard inputs
    term.disableInput();

    // Resize number of columns (for next command) based on output element size
    const cols = term.calcTermCols();
    if (cols && term.cols !== cols) {
      postMessage({
        type: "setCols",
        cols,
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
