export interface Graph {
  historyPush: (value: string) => void;
  setCWD: (cwd: string) => void;
}
