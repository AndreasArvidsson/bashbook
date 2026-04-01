// oxlint-disable unicorn/escape-case
import * as assert from "node:assert/strict";
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
});
