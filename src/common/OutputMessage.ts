export interface OutputMessageData {
  type: "data";
  notebookUri: string;
  cellUri: string;
  data: string;
  cols: number;
  firstCommand: boolean;
}

export interface OutputMessageFinished {
  type: "finished";
  notebookUri: string;
  cellUri: string;
}

export type OutputMessage = OutputMessageData | OutputMessageFinished;
