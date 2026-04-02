// oxlint-disable unicorn/escape-case
import * as assert from "node:assert/strict";
import { START_SIGNAL_TIMEOUT_MS } from "../extension/constants";
import { waitForStartSignal } from "../extension/waitForStartSignal";
import { FakePty, token, prompt, logger } from "./testUtils";

interface Fixture {
    name: string;
    chunks: string[];
}

const fixtures: Fixture[] = [
    {
        name: "Resolves from noisy git bash startup transcript",
        chunks: [
            "\u001b]0;MINGW64:/c/Users/andreas/repositories/[test]\u0007\u001b[?25l\r\n\u001b[0;32mandreas@Andreas-Desktop \u001b[0;35mMINGW64 \u001b[0;33m~/repositories/[test]\u001b[0m\u001b[0K\r\n$\u001b[0K\u001b[3G\u001b[?25h\u001b[?25l\r$ export PS1='__BASHBOOK_PROMPT__ab5a5204__'\u001b[0K\r\n__BASHBOOK_PROMPT__ab5a5204__export PS2='> '\u001b[0K\r\n\u001b[0K\u001b[?25h__BASHBOOK_PROMPT__ab5a5204__echo __BASHBOOK_START_ae7db5bd__\u001b[0K\u001b[?25l\r\n__BASHBOOK_START_ae7db5bd__\u001b[0K\r\n",
            "__BASHBOOK_PROMPT__ab5a5204__\u001b[0K\u001b[?25h",
        ],
    },
    {
        name: "Resolves when prompt arrives in a later chunk",
        chunks: [
            "echo __BASHBOOK_START_ae7db5bd__\r\n__BASHBOOK_START_ae7db5bd__\r\n",
            "__BASHBOOK_PROMPT__ab5a5204__",
        ],
    },
    {
        name: "Resolves when prompt is split across chunks",
        chunks: [
            "echo __BASHBOOK_START_ae7db5bd__\r\n__BASHBOOK_START_ae7db5bd__\r\n__BASHBOOK_PRO",
            "MPT__ab5a5204__",
        ],
    },
];

suite("waitForStartSignal", () => {
    fixtures.forEach((fixture) => {
        test(fixture.name, async () => {
            const pty = new FakePty();

            const waitPromise = waitForStartSignal(logger, pty, token, prompt);

            assert.deepEqual(pty.writes, [
                `echo __BASHBOOK_START_${token}__\r`,
            ]);

            fixture.chunks.forEach((chunk) => {
                pty.emit(chunk);
            });

            await waitPromise;

            assert.equal(pty.disposed, true);
        });
    });

    test("Rejects with timeout while waiting for custom prompt", async () => {
        const pty = new FakePty();
        const { restore, runTimer } = stubTimers();

        try {
            const waitPromise = waitForStartSignal(logger, pty, token, prompt);

            pty.emit(`echo __BASHBOOK_START_${token}__\r\n`);
            pty.emit(`__BASHBOOK_START_${token}__\r\n`);

            runTimer();

            await assert.rejects(waitPromise, {
                message: "Timeout waiting for custom prompt",
            });
            assert.equal(pty.disposed, true);
        } finally {
            restore();
        }
    });

    test("Keeps waiting when prompt arrives just before timeout", async () => {
        const pty = new FakePty();
        const { restore, hasScheduledTimer } = stubTimers();

        try {
            const waitPromise = waitForStartSignal(logger, pty, token, prompt);

            pty.emit(`echo __BASHBOOK_START_${token}__\r\n`);
            pty.emit(`__BASHBOOK_START_${token}__\r\n`);
            assert.equal(hasScheduledTimer(), true);
            pty.emit(prompt);

            await waitPromise;

            assert.equal(hasScheduledTimer(), false);
            assert.equal(pty.disposed, true);
        } finally {
            restore();
        }
    });
});

function stubTimers(): {
    restore: () => void;
    hasScheduledTimer: () => boolean;
    runTimer: () => void;
} {
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    let nextId = 1;
    const timers = new Map<number, () => void>();

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    globalThis.setTimeout = ((
        callback: (...args: never[]) => void,
        ms?: number,
    ) => {
        assert.equal(ms, START_SIGNAL_TIMEOUT_MS);
        const id = nextId++;
        timers.set(id, callback);
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        return id as unknown as NodeJS.Timeout;
    }) as unknown as typeof globalThis.setTimeout;

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    globalThis.clearTimeout = ((timeoutId: NodeJS.Timeout | number) => {
        timers.delete(Number(timeoutId));
    }) as typeof globalThis.clearTimeout;

    return {
        restore: () => {
            globalThis.setTimeout = originalSetTimeout;
            globalThis.clearTimeout = originalClearTimeout;
        },
        hasScheduledTimer: () => timers.size > 0,
        runTimer: () => {
            const [timer] = timers.values();
            assert.notEqual(
                timer,
                undefined,
                "Expected timeout to be scheduled",
            );
            timers.clear();
            timer();
        },
    };
}
