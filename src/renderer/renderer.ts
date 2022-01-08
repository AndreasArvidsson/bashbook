import type { ActivationFunction } from "vscode-notebook-renderer";
import { Terminal } from "xterm";
import "xterm/css/xterm.css";
import "./renderer.css";

export const activate: ActivationFunction = (context) => {
  const map = new Map<string, Terminal>();

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

  const getTerminal = (uri: string, create: boolean, element: HTMLElement) => {
    const has = map.has(uri);
    if (create || !has) {
      if (has) {
        const term = map.get(uri)!;
        term.clear();
        term.open(element);
      } else {
        map.set(uri, createTerminal(uri, element));
      }
    }
    return map.get(uri)!;
  };

  return {
    renderOutputItem(outputItem, element) {
      const { uri, data, create } = outputItem.json();
      const term = getTerminal(uri, create, element);
      term.write(data);
    },
  };
};
