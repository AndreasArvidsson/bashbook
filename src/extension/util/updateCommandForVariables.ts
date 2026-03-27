import type { NotebookCell, NotebookCellExecution } from "vscode";
import { MIME_PLAINTEXT } from "../Constants";

const regex = /(\$:\d*)/g;

export function updateCommandForVariables(
    command: string,
    execution: NotebookCellExecution,
): string {
    return command
        .split(regex)
        .map((value) =>
            regex.test(value) ? parseVariable(value, execution).text : value,
        )
        .join("");
}

function parseVariable(
    variable: string,
    execution: NotebookCellExecution,
): { order: number; text: string } {
    if (execution.executionOrder == null) {
        throw new Error("Execution order is null");
    }
    const order =
        variable.length === 2
            ? execution.executionOrder - 1
            : Number.parseInt(variable.slice(2), 10);
    const cell = execution.cell.notebook
        .getCells()
        .find((c) => c.executionSummary?.executionOrder === order);
    if (!cell) {
        throw new Error(`Can't find execution [${order}]`);
    }
    return {
        order,
        text: cellToString(cell),
    };
}

function cellToString(cell: NotebookCell): string {
    if (cell.executionSummary?.success == null) {
        throw new Error(
            `Can't use output from failed execution [${cell.executionSummary?.executionOrder}]`,
        );
    }

    const data: string[] = [];
    cell.outputs.forEach((output) => {
        output.items.forEach((item) => {
            if (item.mime === MIME_PLAINTEXT) {
                data.push(String.fromCodePoint(...item.data));
            }
        });
    });

    if (data.length === 0) {
        throw new Error(
            `No output available on execution [${cell.executionSummary.executionOrder}]`,
        );
    }
    return data.join("\n").replaceAll("\r", "");
}
