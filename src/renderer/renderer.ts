import type { ActivationFunction } from "vscode-notebook-renderer";
import { Terminal } from "xterm";
import "xterm/css/xterm.css";
import "./renderer.css";

export const activate: ActivationFunction = (context) => {
  const map = new Map();

  const createTerminal = (uri: string, element: HTMLElement) => {
    const term = new Terminal({
      rendererType: "dom",
    });

    if (context.postMessage) {
      term.onData((data) => {
        context.postMessage!({
          uri,
          data,
        });
      });
    }

    term.open(element);

    return term;
  };

  const getTerminal = (uri: string, element: HTMLElement) => {
    if (!map.has(uri)) {
      map.set(uri, createTerminal(uri, element));
    }
    return map.get(uri);
  };

  return {
    renderOutputItem(outputItem, element) {
      const { uri, data } = outputItem.json();
      const term = getTerminal(uri, element);
      term.write(data);
    },
  };
};
