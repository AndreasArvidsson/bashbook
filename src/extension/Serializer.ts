import { TextDecoder, TextEncoder } from "node:util";
import * as vscode from "vscode";
import { NOTEBOOK_TYPE } from "./Constants";

type Metadata = Record<string, unknown>;

interface RawNotebook {
    metadata?: Metadata;
    cells: {
        kind: vscode.NotebookCellKind;
        value: string;
        languageId: string;
        metadata?: Metadata;
        executionSummary?: vscode.NotebookCellExecutionSummary;
        outputs?: {
            metadata?: Metadata;
            items: {
                mime: string;
                data: string;
            }[];
        }[];
    }[];
}

class Serializer implements vscode.NotebookSerializer {
    deserializeNotebook(content: Uint8Array): vscode.NotebookData {
        let raw: RawNotebook;
        try {
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion
            raw = JSON.parse(new TextDecoder().decode(content)) as RawNotebook;
        } catch {
            raw = {
                cells: [],
            };
        }

        const notebook = new vscode.NotebookData(
            raw.cells.map((item) => {
                const cell = new vscode.NotebookCellData(
                    item.kind,
                    item.value,
                    item.languageId,
                );
                cell.metadata = item.metadata;
                cell.executionSummary = item.executionSummary;
                cell.outputs = item.outputs?.map(
                    (output) =>
                        new vscode.NotebookCellOutput(
                            output.items.map(
                                (oi) =>
                                    new vscode.NotebookCellOutputItem(
                                        new TextEncoder().encode(
                                            JSON.stringify(oi.data),
                                        ),
                                        oi.mime,
                                    ),
                            ),
                            output.metadata,
                        ),
                );
                return cell;
            }),
        );
        notebook.metadata = raw.metadata;

        return notebook;
    }

    serializeNotebook(data: vscode.NotebookData): Uint8Array {
        const contents: RawNotebook = {
            metadata: data.metadata,
            cells: data.cells.map((cell) => ({
                kind: cell.kind,
                languageId: cell.languageId,
                value: cell.value,
                metadata: cell.metadata,
                // executionSummary: cell.executionSummary,
                // outputs: cell.outputs?.map((output) => ({
                //   metadata: output.metadata,
                //   items: output.items.map((item) => {
                //     const outputString = new TextDecoder().decode(item.data);
                //     let data;
                //     try {
                //       data = JSON.parse(outputString);
                //     } catch (ex) {
                //       data = outputString;
                //     }
                //     return {
                //       mime: item.mime,
                //       data,
                //     };
                //   }),
                // })),
            })),
        };

        return new TextEncoder().encode(JSON.stringify(contents));
    }
}

export function registerSerializer(): vscode.Disposable {
    return vscode.workspace.registerNotebookSerializer(
        NOTEBOOK_TYPE,
        new Serializer(),
        {
            transientOutputs: true,
        },
    );
}
