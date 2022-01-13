import { NotebookCell, NotebookCellExecution } from "vscode";
import { MIME_PLAINTEXT } from "./Constants";

const regex = /(\$:\d*)/g;

export default (command: string, execution: NotebookCellExecution) => {
  return command
    .split(regex)
    .map((value) =>
      regex.test(value) ? parseVariable(value, execution).text : value
    )
    .join("");
};

function parseVariable(variable: string, execution: NotebookCellExecution) {
  const order =
    variable.length === 2
      ? execution.executionOrder! - 1
      : parseInt(variable.substring(2));
  const cell = execution.cell.notebook
    .getCells()
    .find((cell) => cell.executionSummary?.executionOrder === order);
  if (!cell) {
    throw Error(`Can't find execution [${order}]`);
  }
  return {
    order,
    text: cellToString(cell),
  };
}

function cellToString(cell: NotebookCell) {
  if (!cell.executionSummary?.success) {
    throw Error(
      `Can't use output from failed execution [${cell.executionSummary?.executionOrder}]`
    );
  }

  const data: string[] = [];
  cell.outputs.forEach((output) =>
    output.items.forEach((item) => {
      if (item.mime === MIME_PLAINTEXT) {
        data.push(String.fromCharCode(...item.data));
      }
    })
  );
  if (!data.length) {
    throw Error(
      `No output available on execution [${cell.executionSummary?.executionOrder}]`
    );
  }
  return data.join("\n").replace(/\r/g, "");
}
