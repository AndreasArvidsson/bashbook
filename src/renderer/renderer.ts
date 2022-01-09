import type { ActivationFunction, OutputItem } from "vscode-notebook-renderer";
import { Terminal } from "xterm";
import "xterm/css/xterm.css";
import {
  OutputMessage,
  OutputMessageData,
  OutputMessageFinished,
} from "../common/OutputMessage";
import { ExtensionMessage } from "../common/ExtensionMessage";
import calcTermCols from "./calcTermCols";
import "./renderer.css";

interface TerminalState {
  term: Terminal;
  content: string;
  disableStdin: () => void;
}

const ROWS_MAX = 30;

export const activate: ActivationFunction = (context) => {
  const uriMap = new Map<string, TerminalState>();

  const postMessage = (message: ExtensionMessage) => {
    context.postMessage!(message);
  };

  const createTerminal = (uri: string, cols: number, element: HTMLElement) => {
    const term = new Terminal({
      rendererType: "dom",
      cols: cols,
      rows: 1,
      cursorStyle: "bar",
    });

    const onDataDisposable = term.onData((data) => {
      postMessage({
        type: "data",
        uri,
        data,
      });
    });

    const disableStdin = () => {
      term.options.disableStdin = true;
      onDataDisposable.dispose();
      // Hide cursor
      term.options.cursorStyle = "underline";
    };

    const content = "";

    term.open(element);

    return { term, content, disableStdin };
  };

  const getTerminal = (
    uri: string,
    cols: number,
    create: boolean,
    element: HTMLElement
  ) => {
    if (create) {
      if (uriMap.has(uri)) {
        uriMap.get(uri)!.term.dispose();
      }

      uriMap.set(uri, createTerminal(uri, cols, element));
    }
    return uriMap.get(uri)!;
  };

  const onDataMessage = (
    { uri, data, cols, firstCommand }: OutputMessageData,
    element: HTMLElement
  ) => {
    const state = getTerminal(uri, cols, firstCommand, element);

    state.term.write(data);
    state.content += data;

    // Resize number of rows based on actual data content
    const lines = state.content.split("\n");
    const rows = Math.min(ROWS_MAX, lines.length);
    if (state.term.rows !== rows) {
      state.term.resize(state.term.cols, rows);
    }
  };

  const onFinishedMessage = ({ uri }: OutputMessageFinished) => {
    const state = uriMap.get(uri)!;

    // Stop listening for keyboard inputs
    state.disableStdin();

    // Resize number of columns (for next command) based on output element size
    const cols = calcTermCols(state.term);
    if (cols && state.term.cols !== cols) {
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
        onFinishedMessage(message);
        break;
    }
  };

  return {
    renderOutputItem,
  };
};
