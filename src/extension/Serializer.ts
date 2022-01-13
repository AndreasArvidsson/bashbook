import * as vscode from "vscode";
import { TextDecoder, TextEncoder } from "util";
import { NOTEBOOK_TYPE } from "./Constants";

type Metadata = { [key: string]: any };

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
  async deserializeNotebook(content: Uint8Array): Promise<vscode.NotebookData> {
    const contents = new TextDecoder().decode(content);

    let raw: RawNotebook;
    try {
      raw = <RawNotebook>JSON.parse(contents);
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
          item.languageId
        );
        cell.metadata = item.metadata;
        cell.executionSummary = item.executionSummary;
        cell.outputs = item.outputs?.map(
          (output) =>
            new vscode.NotebookCellOutput(
              output.items.map(
                (item) =>
                  new vscode.NotebookCellOutputItem(
                    new TextEncoder().encode(item.data),
                    item.mime
                  )
              ),
              output.metadata
            )
        );
        return cell;
      })
    );
    notebook.metadata = raw.metadata;

    return notebook;
  }

  async serializeNotebook(data: vscode.NotebookData): Promise<Uint8Array> {
    const contents: RawNotebook = {
      metadata: data.metadata,
      cells: data.cells.map((cell) => ({
        kind: cell.kind,
        languageId: cell.languageId,
        value: cell.value,
        metadata: cell.metadata,
        // TODO Store data as proper json instead of bytes
        // executionSummary: cell.executionSummary,
        // outputs: cell.outputs?.map((output) => ({
        //   metadata: output.metadata,
        //   items: output.items.map((item) => ({
        //     mime: item.mime,
        //     data: new TextDecoder().decode(item.data),
        //   })),
        // })),
      })),
    };

    return new TextEncoder().encode(JSON.stringify(contents));
  }
}

export function registerSerializer() {
  return vscode.workspace.registerNotebookSerializer(
    NOTEBOOK_TYPE,
    new Serializer(),
    {
      transientOutputs: true,
    }
  );
}
