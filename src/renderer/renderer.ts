import type { ActivationFunction } from "vscode-notebook-renderer";
import { Terminal } from "xterm";
import "xterm/css/xterm.css";
import RenderCommand from "../common/RenderCommand";
import "./renderer.css";

interface TerminalState {
  term: Terminal;
  content: string;
  disableStdin: () => void;
}

const COLS = 80;
const ROWS_MAX = 30;

export const activate: ActivationFunction = (context) => {
  const map = new Map<string, TerminalState>();

  const createTerminal = (uri: string, element: HTMLElement) => {
    const term = new Terminal({
      rendererType: "dom",
      cols: COLS,
      rows: 1,
      cursorStyle: "bar",
    });

    const onDataDisposable = term.onData((data) => {
      context.postMessage!({
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

  const getTerminal = (uri: string, create: boolean, element: HTMLElement) => {
    if (create) {
      if (map.has(uri)) {
        map.get(uri)!.term.dispose();
      }

      map.set(uri, createTerminal(uri, element));
    }
    return map.get(uri)!;
  };

  return {
    renderOutputItem(outputItem, element) {
      const { uri, data, firstCommand, lastCommand }: RenderCommand =
        outputItem.json();

      const state = getTerminal(uri, firstCommand, element);

      if (data != null) {
        state.term.write(data);
        state.content += data;
        const lines = state.content.split("\n");
        const rows = Math.min(ROWS_MAX, lines.length);
        if (state.term.rows !== rows) {
          state.term.resize(COLS, rows);
        }
      }

      // Execution is over. Stop listening for keyboard inputs.
      if (lastCommand) {
        state.disableStdin();
      }
    },
  };
};
