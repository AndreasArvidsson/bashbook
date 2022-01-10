export interface ExtensionMessageData {
  type: "data";
  notebookUri: string;
  cellUri: string;
  data: string;
}

export interface ExtensionMessageSetCols {
  type: "setCols";
  notebookUri: string;
  cols: number;
}

export type ExtensionMessage = ExtensionMessageData | ExtensionMessageSetCols;
