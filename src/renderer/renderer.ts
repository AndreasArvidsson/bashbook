import type { ActivationFunction } from "vscode-notebook-renderer";
import { Terminal } from "xterm";
import "xterm/css/xterm.css";

export const activate: ActivationFunction = (context) => {
  const term = new Terminal({ convertEol: true });
  return {
    renderOutputItem(data, element) {
      term.open(element);
      term.write(data.data());
    },
  };
};
