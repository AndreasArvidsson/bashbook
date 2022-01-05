import { TextDecoder, TextEncoder } from "util";
import {
  CancellationToken,
  NotebookCellData,
  NotebookCellKind,
  NotebookData,
  NotebookSerializer,
} from "vscode";

interface RawNotebook {
  cells: RawNotebookCell[];
  // metadata: { [key: string]: any };
}

interface RawNotebookCell {
  kind: NotebookCellKind;
  languageId: string;
  value: string;
  // metadata: { [key: string]: any };
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
        // metadata: {},
      };
    }

    const cells = raw.cells.map((item) => {
      const cell = new NotebookCellData(item.kind, item.value, item.languageId);
      // cell.metadata = item.metadata;
      return cell;
    });

    const notebook = new NotebookData(cells);
    // notebook.metadata = raw.metadata;
    return notebook;
  }

  async serializeNotebook(
    data: NotebookData,
    _token: CancellationToken
  ): Promise<Uint8Array> {
    const contents: RawNotebook = {
      // metadata: data.metadata ?? {},
      cells: data.cells.map((cell) => ({
        kind: cell.kind,
        languageId: cell.languageId,
        value: cell.value,
        // metadata: cell.metadata ?? {},
      })),
    };

    return new TextEncoder().encode(JSON.stringify(contents));
  }
}
