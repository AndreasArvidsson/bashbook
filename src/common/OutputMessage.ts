export interface OutputMessageData {
  type: "data";
  uri: string;
  data: string;
  cols: number;
  firstCommand: boolean;
}

export interface OutputMessageFinished {
  type: "finished";
  uri: string;
}

export type OutputMessage = OutputMessageData | OutputMessageFinished;
