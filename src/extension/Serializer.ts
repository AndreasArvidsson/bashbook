import { TextDecoder, TextEncoder } from "util";
import {
  CancellationToken,
  NotebookCellData,
  NotebookCellExecutionSummary,
  NotebookCellKind,
  NotebookCellOutput,
  NotebookCellOutputItem,
  NotebookData,
  NotebookSerializer,
} from "vscode";

type Metadata = { [key: string]: any };

interface RawNotebook {
  metadata?: Metadata;
  cells: {
    kind: NotebookCellKind;
    value: string;
    languageId: string;
    metadata?: Metadata;
    executionSummary?: NotebookCellExecutionSummary;
    outputs?: {
      metadata?: Metadata;
      items: {
        mime: string;
        data: string;
      }[];
    }[];
  }[];
}

export default class Serializer implements NotebookSerializer {
  async deserializeNotebook(
    content: Uint8Array,
    _token: CancellationToken
  ): Promise<NotebookData> {
    const contents = new TextDecoder().decode(content);

    let raw: RawNotebook;
    try {
      raw = <RawNotebook>JSON.parse(contents);
    } catch {
      raw = {
        cells: [],
      };
    }

    const notebook = new NotebookData(
      raw.cells.map((item) => {
        const cell = new NotebookCellData(
          item.kind,
          item.value,
          item.languageId
        );
        cell.metadata = item.metadata;
        cell.executionSummary = item.executionSummary;
        cell.outputs = item.outputs?.map(
          (output) =>
            new NotebookCellOutput(
              output.items.map(
                (item) =>
                  new NotebookCellOutputItem(
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

  async serializeNotebook(
    data: NotebookData,
    _token: CancellationToken
  ): Promise<Uint8Array> {
    const contents: RawNotebook = {
      metadata: data.metadata,
      cells: data.cells.map((cell) => ({
        kind: cell.kind,
        languageId: cell.languageId,
        value: cell.value,
        metadata: cell.metadata,
        // executionSummary: cell.executionSummary,
        // TODO
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
