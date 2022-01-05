import { TextDecoder, TextEncoder } from "util";
import {
  CancellationToken,
  NotebookCellData,
  NotebookCellKind,
  NotebookData,
  NotebookSerializer,
} from "vscode";

interface RawNotebookCell {
  kind: NotebookCellKind;
  language: string;
  value: string;
}

export default class Serializer implements NotebookSerializer {
  async deserializeNotebook(
    content: Uint8Array,
    _token: CancellationToken
  ): Promise<NotebookData> {
    const contents = new TextDecoder().decode(content);

    let raw: RawNotebookCell[];
    try {
      raw = <RawNotebookCell[]>JSON.parse(contents);
    } catch {
      raw = [];
    }

    const cells = raw.map(
      (item) => new NotebookCellData(item.kind, item.value, item.language)
    );

    return new NotebookData(cells);
  }

  async serializeNotebook(
    data: NotebookData,
    _token: CancellationToken
  ): Promise<Uint8Array> {
    const contents: RawNotebookCell[] = data.cells.map((cell) => ({
      kind: cell.kind,
      language: cell.languageId,
      value: cell.value,
    }));

    return new TextEncoder().encode(JSON.stringify(contents));
  }
}
