import type { ActivationFunction } from "vscode-notebook-renderer";
import { Terminal } from "xterm";
import "xterm/css/xterm.css";
import "./renderer.css";

export const activate: ActivationFunction = (context) => {
  const map = new Map();

  const getTerminal = (uri: string, element: HTMLElement) => {
    if (!map.has(uri)) {
      const term = new Terminal({
        rendererType: "dom",
      });
      term.open(element);
      map.set(uri, term);
    }
    return map.get(uri);
  };

  return {
    renderOutputItem(outputItem, element) {
      const { uri, data } = outputItem.json();
      const term = getTerminal(uri, element);
      term.write(data);
      // element.innerText = data.text();
    },
  };
};
