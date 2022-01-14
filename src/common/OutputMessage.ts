export interface OutputMessageExecuting {
  type: "executing";
  notebookUri: string;
  cellUri: string;
  data: string;
  cols: number;
  firstCommand: boolean;
}

export interface OutputMessageCompleted {
  type: "completed";
  notebookUri: string;
  cellUri: string;
  data: string;
  cols: number;
}

export type OutputMessage = OutputMessageExecuting | OutputMessageCompleted;
