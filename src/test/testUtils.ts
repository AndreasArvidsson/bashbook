import * as assert from "node:assert/strict";
import type { Logger } from "../extension/logger";

export class FakePty {
    public readonly writes: string[] = [];
    public disposed = false;
    private onDataCallback?: (data: string) => void;

    onData(callback: (data: string) => void): { dispose: () => void } {
        this.onDataCallback = callback;
        return {
            dispose: () => {
                this.disposed = true;
                this.onDataCallback = undefined;
            },
        };
    }

    write(data: string): void {
        this.writes.push(data);
    }

    emit(data: string): void {
        assert.ok(
            this.onDataCallback,
            "Expected onData callback to be registered",
        );
        this.onDataCallback(data);
    }
}

const noop = () => {
    // no operation
};

export const logger: Logger = {
    debug: noop,
    log: noop,
    warn: noop,
    error: noop,
};

export const prompt = "__BASHBOOK_PROMPT__ab5a5204__";
export const token = "ae7db5bd";
