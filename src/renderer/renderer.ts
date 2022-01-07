import type { ActivationFunction } from "vscode-notebook-renderer";
import { Terminal } from "xterm";
import "xterm/css/xterm.css";

export const activate: ActivationFunction = (context) => {
  // const term = new Terminal({ convertEol: true });
  let term: Terminal;
  return {
    renderOutputItem(data, element) {
      if (term == null) {
        term = new Terminal({});
        term.open(element);
      }
      console.log(`2 "${data.text()}"`);
      term.write(data.text());
      // element.innerText = data.text();
    },
  };
};
