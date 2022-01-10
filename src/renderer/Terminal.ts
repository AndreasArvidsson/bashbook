import { IDisposable, ITerminalOptions, Terminal as xTerminal } from "xterm";
import calcTermCols from "./calcTermCols";
import "xterm/css/xterm.css";
import "./Terminal.css";

const DEFAULT_OPTIONS = {
  rendererType: "dom",
  rows: 1,
};

const ROWS_MAX = 30;

export default class Terminal extends xTerminal {
  private dataContent = "";
  private onDataDisposable?: IDisposable;

  constructor(options: ITerminalOptions) {
    super(Object.assign({}, DEFAULT_OPTIONS, options));
  }

  writeData(data: string) {
    this.write(data);
    this.dataContent += data;

    // Resize number of rows based on actual data content
    const lines = this.dataContent.split("\n");
    const rows = Math.min(ROWS_MAX, lines.length);
    if (this.rows !== rows) {
      this.resize(this.cols, rows);
    }
  }

  onInput(callback: (data: string) => void) {
    this.onDataDisposable = this.onData(callback);
  }

  disableInput() {
    this.onDataDisposable?.dispose();
    this.options.disableStdin = true;
    // Hide cursor
    this.options.cursorStyle = "underline";
  }

  calcTermCols() {
    return calcTermCols(this);
  }
}
