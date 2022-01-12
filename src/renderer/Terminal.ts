import * as xterm from "xterm";
import "xterm/css/xterm.css";
import "./Terminal.css";

const DEFAULT_OPTIONS: xterm.ITerminalOptions = {
  rendererType: "dom",
  rows: 1,
};

const COLS_MIN = 2;
const ROWS_MAX = 30;

export default class Terminal extends xterm.Terminal {
  private dataContent = "";
  private onDataDisposable?: xterm.IDisposable;

  constructor(options: xterm.ITerminalOptions) {
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
    if (!this.element?.parentElement) {
      return;
    }
    const core = (this as any)._core;
    if (core._renderService.dimensions.actualCellWidth === 0) {
      return;
    }
    const parentElementStyle = window.getComputedStyle(
      this.element.parentElement
    );
    const parentElementWidth = parseInt(parentElementStyle.width);
    const parentElementPadding = 12;
    const availableWidth =
      parentElementWidth - parentElementPadding - core.viewport.scrollBarWidth;
    return Math.max(
      COLS_MIN,
      Math.floor(
        availableWidth / core._renderService.dimensions.actualCellWidth
      )
    );
  }
}
