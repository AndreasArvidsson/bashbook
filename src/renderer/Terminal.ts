import * as xterm from "@xterm/xterm";

type TerminalOptions = xterm.ITerminalOptions & xterm.ITerminalInitOnlyOptions;

const DEFAULT_OPTIONS: TerminalOptions = {
    rows: 1,
};

const COLS_MIN = 2;
const ROWS_MAX = 30;

export class Terminal extends xterm.Terminal {
    private dataContent = "";
    private onDataDisposable?: xterm.IDisposable;

    public constructor(options: TerminalOptions) {
        super({ ...DEFAULT_OPTIONS, ...options });

        this.onSelectionChange(async () => {
            const selection = this.getSelection().trim();
            if (selection.length > 0) {
                await navigator.clipboard.writeText(selection);
            }
        });
    }

    public write(data: string): void {
        if (this.options.disableStdin) {
            return;
        }

        super.write(data);
        this.dataContent += data;

        // Resize number of rows based on actual data content
        const lines = this.dataContent.split(/\r?\n/);
        const rows = Math.min(ROWS_MAX, lines.length);
        if (this.rows !== rows) {
            this.resize(this.cols, rows);
        }
    }

    public onInput(callback: (data: string) => void): void {
        this.onDataDisposable = this.onData(callback);
    }

    public disableInput(): void {
        this.onDataDisposable?.dispose();
        this.options.disableStdin = true;
        // Hide cursor
        this.options.cursorStyle = "underline";
    }

    public calcTermCols(): number {
        if (this.element?.parentElement == null || this.cols === 0) {
            return 0;
        }
        const screenElement =
            this.element.querySelector<HTMLElement>(".xterm-screen");
        const viewportElement =
            this.element.querySelector<HTMLElement>(".xterm-viewport");
        if (screenElement == null || viewportElement == null) {
            return 0;
        }
        const cellWidth =
            screenElement.getBoundingClientRect().width / this.cols;
        if (cellWidth === 0) {
            return 0;
        }
        const parentElementStyle = globalThis.window.getComputedStyle(
            this.element.parentElement,
        );
        const parentElementWidth = Number.parseInt(
            parentElementStyle.width,
            10,
        );
        const parentElementPadding = 12;
        const scrollBarWidth =
            viewportElement.offsetWidth - viewportElement.clientWidth;
        const availableWidth =
            parentElementWidth - parentElementPadding - scrollBarWidth;
        return Math.max(COLS_MIN, Math.floor(availableWidth / cellWidth));
    }
}
