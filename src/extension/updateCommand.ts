import { NotebookCell, NotebookCellExecution } from "vscode";
import { MIME_PLAINTEXT } from "./Constants";

const regex = /(\$:\d*)/g;

export default (command: string, execution: NotebookCellExecution) => {
  return command
    .split(regex)
    .map((value) =>
      regex.test(value) ? parseVariable(value, execution) : value
    )
    .join("");
};

function parseVariable(variable: string, execution: NotebookCellExecution) {
  const cells = execution.cell.notebook
    .getCells()
    .filter((cell) => cell.executionSummary?.executionOrder != null);
  if (variable.length === 2) {
    return findLastExecution(cells);
  }
  const order = parseInt(variable.substring(2));
  return findExecution(cells, order);
}

function findLastExecution(cells: NotebookCell[]) {
  let lastCell;
  if (cells.length) {
    lastCell = cells.reduce((lastCell, cell) =>
      !lastCell ||
      cell.executionSummary!.executionOrder! >
        lastCell.executionSummary!.executionOrder!
        ? cell
        : lastCell
    );
  }
  if (!lastCell) {
    throw Error(`Can't find last execution`);
  }
  return cellToString(lastCell);
}

function findExecution(cells: NotebookCell[], order: number) {
  const cell = cells.find(
    (cell) => cell.executionSummary?.executionOrder === order
  );
  if (!cell) {
    throw Error(`Can't find execution [${order}]`);
  }
  return cellToString(cell);
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
  return data.join("\n").trim();
}
