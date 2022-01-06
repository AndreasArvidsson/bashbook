import type { ActivationFunction } from "vscode-notebook-renderer";

export const activate: ActivationFunction = (context) => ({
  renderOutputItem(data, element) {
    // element.innerText = JSON.stringify(data.json());
    element.innerText = data.text();
  },
});
