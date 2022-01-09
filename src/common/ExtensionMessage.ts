export interface ExtensionMessageData {
  type: "data";
  uri: string;
  data: string;
}

export interface ExtensionMessageSetCols {
  type: "setCols";
  cols: number;
}

export type ExtensionMessage = ExtensionMessageData | ExtensionMessageSetCols;
