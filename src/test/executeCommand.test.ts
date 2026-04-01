// oxlint-disable unicorn/escape-case
import * as assert from "node:assert/strict";
import { executeCommand } from "../extension/executeCommand";
import { ProfileBash } from "../extension/profiles/ProfileBash";
import { FakePty, logger, prompt, token } from "./testUtils";

export interface Fixture {
    name: string;
    command: string;
    skip?: boolean;
    chunks: string[];
    expectOutput: string[];
    expectResult: {
        exitCode: number;
        cwd: string;
    };
}

const fixtures: Fixture[] = [
    {
        name: "Git bash echoed command with split chunk",
        command: "echo hello && echo world",
        chunks: [
            "echo __BASHBOOK_START_ae7db5bd__; echo hello && ec\u001b[0Kh\u001b[?25l\r\no world\u001b[0K\r\n__BASHBOOK_START_ae7db5bd__\u001b[0K\r\nhello\u001b[0K\r\nworld\u001b[0K\r\n\u001b[0K\u001b[?25h",
            "__BASHBOOK_PROMPT__ab5a5204__\u001b[0K",
            'echo "|ae7db5bd|exit:$?|cwd:$(pwd)|"\u001b[0K\u001b[?25l\r\n\u001b[0K\u001b[?25h',
            "|ae7db5bd|exit:0|cwd:/c/Users/andreas/repositories/[test]|\u001b[0K\u001b[?25l\r\n__BASHBOOK_PROMPT__ab5a5204__\u001b[0K\u001b[?25h",
        ],
        expectOutput: [
            "hello\u001b[0K",
            "\r\nworld\u001b[0K",
            "\r\n\u001b[0K\u001b[?25h",
        ],
        expectResult: {
            exitCode: 0,
            cwd: "/c/Users/andreas/repositories/[test]",
        },
    },
    {
        name: "Buffers partial prompt tail until prompt completes",
        command: "echo hello && echo world",
        chunks: [
            "echo __BASHBOOK_START_ae7db5bd__; echo hello && echo world\r\n__BASHBOOK_START_ae7db5bd__\r\nhello\r\nworld\r\n__BASHBOOK_PRO",
            "MPT__ab5a5204__",
            'echo "|ae7db5bd|exit:$?|cwd:$(pwd)|"\r\n',
            "|ae7db5bd|exit:0|cwd:/tmp/project|\r\n__BASHBOOK_PROMPT__ab5a5204__",
        ],
        expectOutput: ["hello", "\r\nworld"],
        expectResult: {
            exitCode: 0,
            cwd: "/tmp/project",
        },
    },
    {
        name: "Ignores echoed result command split across chunks",
        command: "echo hello && echo world",
        chunks: [
            "echo __BASHBOOK_START_ae7db5bd__; echo hello && echo world\r\n__BASHBOOK_START_ae7db5bd__\r\nhello\r\nworld\r\n",
            "__BASHBOOK_PROMPT__ab5a5204__",
            'echo "|ae7db',
            '5bd|exit:$?|cwd:$(pwd)|"\r\n',
            "|ae7db5bd|exit:7|cwd:/var/tmp|\r\n__BASHBOOK_PROMPT__ab5a5204__",
        ],
        expectOutput: ["hello", "\r\nworld", "\r\n"],
        expectResult: {
            exitCode: 7,
            cwd: "/var/tmp",
        },
    },
    {
        name: "Preserves repeated echo output on separate lines",
        command: "echo hello\necho hello",
        chunks: [
            "echo __BASHBOOK_START_ae7db5bd__; echo hello\r\necho hello\r\n__BASHBOOK_START_ae7db5bd__\r\nhello\r\nhello\r\n",
            "__BASHBOOK_PROMPT__ab5a5204__",
            'echo "|ae7db5bd|exit:$?|cwd:$(pwd)|"\r\n',
            "|ae7db5bd|exit:0|cwd:/tmp/project|\r\n__BASHBOOK_PROMPT__ab5a5204__",
        ],
        expectOutput: ["hello", "\r\nhello", "\r\n"],
        expectResult: {
            exitCode: 0,
            cwd: "/tmp/project",
        },
    },
    {
        name: "Preserves repeated printf output on the same line",
        command: "printf foo\nprintf foo",
        chunks: [
            "echo __BASHBOOK_START_ae7db5bd__; printf foo\r\nprintf foo\r\n__BASHBOOK_START_ae7db5bd__\r\nfoofoo",
            "__BASHBOOK_PROMPT__ab5a5204__",
            'echo "|ae7db5bd|exit:$?|cwd:$(pwd)|"\r\n',
            "|ae7db5bd|exit:0|cwd:/tmp/project|\r\n__BASHBOOK_PROMPT__ab5a5204__",
        ],
        expectOutput: ["foofoo"],
        expectResult: {
            exitCode: 0,
            cwd: "/tmp/project",
        },
    },
    {
        name: "Preserves repeated printf output after buffered tail flush",
        command: "printf foo\nprintf foo",
        chunks: [
            "echo __BASHBOOK_START_ae7db5bd__; printf foo\r\nprintf foo\r\n__BASHBOOK_START_ae7db5bd__\r\nfoo",
            "foo__BASHBOOK_PROMPT__ab5a5204__",
            'echo "|ae7db5bd|exit:$?|cwd:$(pwd)|"\r\n',
            "|ae7db5bd|exit:0|cwd:/tmp/project|\r\n__BASHBOOK_PROMPT__ab5a5204__",
        ],
        expectOutput: ["foo", "foo"],
        expectResult: {
            exitCode: 0,
            cwd: "/tmp/project",
        },
    },
    {
        name: "Preserves output that starts with the prompt token",
        command: "printf '__BASHBOOK_PROMPT__ab5a5204__not-a-prompt\nok'",
        chunks: [
            "echo __BASHBOOK_START_ae7db5bd__; printf '__BASHBOOK_PROMPT__ab5a5204__not-a-prompt\r\nok'\r\n__BASHBOOK_START_ae7db5bd__\r\n__BASHBOOK_PROMPT__ab5a5204__not-a-prompt\r\nok",
            "__BASHBOOK_PROMPT__ab5a5204__",
            'echo "|ae7db5bd|exit:$?|cwd:$(pwd)|"\r\n',
            "|ae7db5bd|exit:0|cwd:/tmp/project|\r\n__BASHBOOK_PROMPT__ab5a5204__",
        ],
        expectOutput: ["__BASHBOOK_PROMPT__ab5a5204__not-a-prompt", "ok"],
        expectResult: {
            exitCode: 0,
            cwd: "/tmp/project",
        },
    },
    {
        name: "Uses the final result footer when output contains a footer-shaped string",
        command: "printf '|ae7db5bd|exit:999|cwd:/fake|'",
        chunks: [
            "echo __BASHBOOK_START_ae7db5bd__; printf '|ae7db5bd|exit:999|cwd:/fake|'\r\n__BASHBOOK_START_ae7db5bd__\r\n|ae7db5bd|exit:999|cwd:/fake|",
            "__BASHBOOK_PROMPT__ab5a5204__",
            'echo "|ae7db5bd|exit:$?|cwd:$(pwd)|"\r\n',
            "|ae7db5bd|exit:0|cwd:/tmp/project|\r\n__BASHBOOK_PROMPT__ab5a5204__",
        ],
        expectOutput: ["|ae7db5bd|exit:999|cwd:/fake|"],
        expectResult: {
            exitCode: 0,
            cwd: "/tmp/project",
        },
    },
    {
        name: "Ignores start token noise before the real start signal",
        command: "printf ok",
        chunks: [
            "echo __BASHBOOK_START_ae7db5bd__; printf ok\r\nnoise __BASHBOOK_START_ae7db5bd__ noise\r\n__BASHBOOK_START_ae7db5bd__\r\nok",
            "__BASHBOOK_PROMPT__ab5a5204__",
            'echo "|ae7db5bd|exit:$?|cwd:$(pwd)|"\r\n',
            "|ae7db5bd|exit:0|cwd:/tmp/project|\r\n__BASHBOOK_PROMPT__ab5a5204__",
        ],
        expectOutput: ["ok"],
        expectResult: {
            exitCode: 0,
            cwd: "/tmp/project",
        },
    },
    {
        name: "Handles prompt split by ansi control sequences",
        command: "printf foo",
        chunks: [
            "echo __BASHBOOK_START_ae7db5bd__; printf foo\r\n__BASHBOOK_START_ae7db5bd__\r\nfoo",
            "__BASHBOOK_PROMPT__ab5a\u001b[0K5204__",
            'echo "|ae7db5bd|exit:$?|cwd:$(pwd)|"\r\n',
            "|ae7db5bd|exit:0|cwd:/tmp/project|\r\n__BASHBOOK_PROMPT__ab5a5204__",
        ],
        expectOutput: ["foo"],
        expectResult: {
            exitCode: 0,
            cwd: "/tmp/project",
        },
    },
    {
        name: "Parses a heavily fragmented result footer",
        command: "printf foo",
        chunks: [
            "echo __BASHBOOK_START_ae7db5bd__; printf foo\r\n__BASHBOOK_START_ae7db5bd__\r\nfoo",
            "__BASHBOOK_PROMPT__ab5a5204__",
            'echo "|ae7db5bd|exit:$?|cwd:$(pwd)|"\r\n',
            "|ae7db5bd|ex",
            "it:0|cw",
            "d:/tmp/project|",
            "__BASHBOOK_PROMPT__ab5a5204__",
        ],
        expectOutput: ["foo"],
        expectResult: {
            exitCode: 0,
            cwd: "/tmp/project",
        },
    },
    {
        name: "Preserves output ending with a partial prompt prefix",
        command: "printf '__BASHBOOK_PRO'; printf 'tail'",
        chunks: [
            "echo __BASHBOOK_START_ae7db5bd__; printf '__BASHBOOK_PRO'; printf 'tail'\r\n__BASHBOOK_START_ae7db5bd__\r\n__BASHBOOK_PRO",
            "tail__BASHBOOK_PROMPT__ab5a5204__",
            'echo "|ae7db5bd|exit:$?|cwd:$(pwd)|"\r\n',
            "|ae7db5bd|exit:0|cwd:/tmp/project|\r\n__BASHBOOK_PROMPT__ab5a5204__",
        ],
        expectOutput: ["__BASHBOOK_PROtail"],
        expectResult: {
            exitCode: 0,
            cwd: "/tmp/project",
        },
    },
    {
        name: "Avoids duplicated printf output during cursor redraw before prompt",
        command: "printf foo",
        chunks: [
            "echo __BASHBOOK_START_ae7db5bd__; printf foo\u001b[0K\u001b[?25l\r\n__BASHBOOK_START_ae7db5bd__\u001b[0K\r\nfoo\u001b[0K\r\u001b[2A\u001b[74G\u001b[?25h",
            "\u001b[?25l\r\n\r\nfoo__BASHBOOK_PROMPT__ab5a5204__\u001b[0K\u001b[?25h",
            'echo "|ae7db5bd|exit:$?|cwd:$(pwd)|"\u001b[0K\u001b[?25l\r\n\u001b[0K\u001b[?25h|ae7db5bd|exit:0|cwd:/c/Users/andreas/repositories/[test]|\u001b[0K\u001b[?25l\r\n\u001b[0K\u001b[?25h',
            "\u001b[?25l__BASHBOOK_PROMPT__ab5a5204__\u001b[0K\u001b[1G\u001b[?25h\u001b[30G",
        ],
        expectOutput: ["foo\u001b[0K\r\u001b[2A\u001b[74G\u001b[?25h"],
        expectResult: {
            exitCode: 0,
            cwd: "/c/Users/andreas/repositories/[test]",
        },
    },
    {
        name: "Handles printf output when result and prompt arrive on same line",
        command: "printf foo",
        chunks: [
            "echo __BASHBOOK_START_ae7db5bd__; printf foo\u001b[0K\u001b[?25l\r\n__BASHBOOK_START_ae7db5bd__\u001b[0K\r\nfoo\u001b[0K\u001b[?25h",
            "__BASHBOOK_PROMPT__ab5a5204__\u001b[0K",
            'echo "|ae7db5bd|exit:$?|cwd:$(pwd)|"\u001b[0K\u001b[?25l\r\n\u001b[0K\u001b[?25h',
            "|ae7db5bd|exit:0|cwd:/c/Users/andreas/repositories/[test]|\u001b[0K\u001b[?25l\r\n__BASHBOOK_PROMPT__ab5a5204__\u001b[0K\u001b[?25h",
        ],
        expectOutput: ["foo\u001b[0K\u001b[?25h"],
        expectResult: {
            exitCode: 0,
            cwd: "/c/Users/andreas/repositories/[test]",
        },
    },
    {
        name: "Handles interactive script input and output",
        command: "./test_interactive.sh",
        chunks: [
            "echo __BASHBOOK_START_ae7db5bd__; ./test_interactive.sh\u001b[0K\u001b[?25l\r\n__BASHBOOK_START_ae7db5bd__\u001b[0K\r\nEnter a value. 'q' to quit\u001b[0K\r\n\u001b[0K\u001b[?25h",
            "a\u001b[0K",
            "b\u001b[0K",
            "c\u001b[0K",
            "\u001b[?25l\r\nYou entered 'abc'\u001b[0K\r\nEnter a value. 'q' to quit\u001b[0K\r\n\u001b[0K\u001b[?25h",
            "q\u001b[0K",
            "\u001b[?25l\r\n__BASHBOOK_PROMPT__ab5a5204__\u001b[0K\u001b[?25h",
            'echo "|ae7db5bd|exit:$?|cwd:$(pwd)|"\u001b[0K\u001b[?25l\r\n\u001b[0K\u001b[?25h',
            "|ae7db5bd|exit:0|cwd:/c/Users/andreas/repositories/[test]|\u001b[0K\u001b[?25l\r\n__BASHBOOK_PROMPT__ab5a5204__\u001b[0K\u001b[?25h",
        ],
        expectOutput: [
            "Enter a value. 'q' to quit\u001b[0K",
            "\r\n\u001b[0K\u001b[?25h",
            "a\u001b[0K",
            "b\u001b[0K",
            "c\u001b[0K",
            "\r\nYou entered 'abc'\u001b[0K",
            "\r\nEnter a value. 'q' to quit\u001b[0K",
            "\r\n\u001b[0K\u001b[?25h",
            "q\u001b[0K",
        ],
        expectResult: {
            exitCode: 0,
            cwd: "/c/Users/andreas/repositories/[test]",
        },
    },
    {
        name: "Handles interactive script input when typed characters are not echoed",
        command: "./test_interactive.sh",
        chunks: [
            "echo __BASHBOOK_START_ae7db5bd__; ./test_interactive.sh\u001b[0K\u001b[?25l\r\n__BASHBOOK_START_ae7db5bd__\u001b[0K\r\nEnter a value. 'q' to quit\u001b[0K\r\n\u001b[0K\u001b[?25h",
            "\u001b[?25l\r\nYou entered 'abc'\u001b[0K\r\nEnter a value. 'q' to quit\u001b[0K\r\n\u001b[0K\u001b[?25h",
            "\u001b[?25l\r\n__BASHBOOK_PROMPT__ab5a5204__\u001b[0K\u001b[?25h",
            'echo "|ae7db5bd|exit:$?|cwd:$(pwd)|"\u001b[0K\u001b[?25l\r\n\u001b[0K\u001b[?25h',
            "|ae7db5bd|exit:0|cwd:/c/Users/andreas/repositories/[test]|\u001b[0K\u001b[?25l\r\n__BASHBOOK_PROMPT__ab5a5204__\u001b[0K\u001b[?25h",
        ],
        expectOutput: [
            "Enter a value. 'q' to quit\u001b[0K",
            "\r\n\u001b[0K\u001b[?25h",
            "\r\n\u001b[?25l",
            "\r\nYou entered 'abc'\u001b[0K",
            "\r\nEnter a value. 'q' to quit\u001b[0K",
            "\r\n\u001b[0K\u001b[?25h",
            "\r\n\u001b[?25l",
        ],
        expectResult: {
            exitCode: 0,
            cwd: "/c/Users/andreas/repositories/[test]",
        },
    },
    {
        name: "Preserves interactive backspace editing sequences",
        command: "./test_interactive.sh",
        chunks: [
            "echo __BASHBOOK_START_ae7db5bd__; ./test_interactive.sh\u001b[0K\u001b[?25l\r\n__BASHBOOK_START_ae7db5bd__\u001b[0K\r\nEnter a value. 'q' to quit\u001b[0K\r\n\u001b[0K\u001b[?25h",
            "ab\b \bc\u001b[0K",
            "\u001b[?25l\r\nYou entered 'ac'\u001b[0K\r\nEnter a value. 'q' to quit\u001b[0K\r\n\u001b[0K\u001b[?25h",
            "q\u001b[0K",
            "\u001b[?25l\r\n__BASHBOOK_PROMPT__ab5a5204__\u001b[0K\u001b[?25h",
            'echo "|ae7db5bd|exit:$?|cwd:$(pwd)|"\u001b[0K\u001b[?25l\r\n\u001b[0K\u001b[?25h',
            "|ae7db5bd|exit:0|cwd:/c/Users/andreas/repositories/[test]|\u001b[0K\u001b[?25l\r\n__BASHBOOK_PROMPT__ab5a5204__\u001b[0K\u001b[?25h",
        ],
        expectOutput: [
            "Enter a value. 'q' to quit\u001b[0K",
            "\r\n\u001b[0K\u001b[?25h",
            "ab\b \bc\u001b[0K",
            "\r\nYou entered 'ac'\u001b[0K",
            "\r\nEnter a value. 'q' to quit\u001b[0K",
            "\r\n\u001b[0K\u001b[?25h",
            "q\u001b[0K",
        ],
        expectResult: {
            exitCode: 0,
            cwd: "/c/Users/andreas/repositories/[test]",
        },
    },
    {
        name: "Handles a successful command with no output",
        command: "true",
        chunks: [
            "echo __BASHBOOK_START_ae7db5bd__; true\r\n__BASHBOOK_START_ae7db5bd__\r\n",
            "__BASHBOOK_PROMPT__ab5a5204__",
            'echo "|ae7db5bd|exit:$?|cwd:$(pwd)|"\r\n',
            "|ae7db5bd|exit:0|cwd:/tmp/project|\r\n__BASHBOOK_PROMPT__ab5a5204__",
        ],
        expectOutput: [],
        expectResult: {
            exitCode: 0,
            cwd: "/tmp/project",
        },
    },
    {
        name: "Handles a failing command with no output",
        command: "false",
        chunks: [
            "echo __BASHBOOK_START_ae7db5bd__; false\r\n__BASHBOOK_START_ae7db5bd__\r\n",
            "__BASHBOOK_PROMPT__ab5a5204__",
            'echo "|ae7db5bd|exit:$?|cwd:$(pwd)|"\r\n',
            "|ae7db5bd|exit:1|cwd:/tmp/project|\r\n__BASHBOOK_PROMPT__ab5a5204__",
        ],
        expectOutput: [],
        expectResult: {
            exitCode: 1,
            cwd: "/tmp/project",
        },
    },
    {
        name: "Parses cwd values with pipes spaces and unicode",
        command: "printf ok",
        chunks: [
            "echo __BASHBOOK_START_ae7db5bd__; printf ok\r\n__BASHBOOK_START_ae7db5bd__\r\nok",
            "__BASHBOOK_PROMPT__ab5a5204__",
            'echo "|ae7db5bd|exit:$?|cwd:$(pwd)|"\r\n',
            "|ae7db5bd|exit:0|cwd:/tmp/a|b snowman \u2603|\r\n__BASHBOOK_PROMPT__ab5a5204__",
        ],
        expectOutput: ["ok"],
        expectResult: {
            exitCode: 0,
            cwd: "/tmp/a|b snowman \u2603",
        },
    },
    {
        name: "Does not support output equal to the prompt token exactly",
        command: "printf '__BASHBOOK_PROMPT__ab5a5204__'",
        skip: true,
        chunks: [
            "echo __BASHBOOK_START_ae7db5bd__; printf '__BASHBOOK_PROMPT__ab5a5204__'\r\n__BASHBOOK_START_ae7db5bd__\r\n__BASHBOOK_PROMPT__ab5a5204__",
            'echo "|ae7db5bd|exit:$?|cwd:$(pwd)|"\r\n',
            "|ae7db5bd|exit:0|cwd:/tmp/project|\r\n__BASHBOOK_PROMPT__ab5a5204__",
        ],
        expectOutput: ["__BASHBOOK_PROMPT__ab5a5204__"],
        expectResult: {
            exitCode: 0,
            cwd: "/tmp/project",
        },
    },
    {
        name: "Keeps collecting result until prompt arrives in later chunk",
        command: "echo hello && echo world",
        chunks: [
            "echo __BASHBOOK_START_ae7db5bd__; echo hello && echo world\r\n__BASHBOOK_START_ae7db5bd__\r\nhello\r\nworld\r\n",
            "__BASHBOOK_PROMPT__ab5a5204__",
            'echo "|ae7db5bd|exit:$?|cwd:$(pwd)|"\r\n',
            "|ae7db5bd|exit:3|cwd:/workspace|\r\n",
            "__BASHBOOK_PROMPT__ab5a5204__",
        ],
        expectOutput: ["hello", "\r\nworld", "\r\n"],
        expectResult: {
            exitCode: 3,
            cwd: "/workspace",
        },
    },
];

suite("executeCommand", () => {
    fixtures.forEach((fixture) => {
        // oxlint-disable-next-line func-names
        test(fixture.name, async function () {
            const pty = new FakePty();
            const output: string[] = [];

            if (fixture.skip) {
                this.skip();
            }

            const resultPromise = executeCommand(
                logger,
                pty,
                new ProfileBash(),
                fixture.command,
                token,
                prompt,
                (data) => {
                    output.push(data);
                },
            );

            assert.deepEqual(pty.writes, [
                `echo __BASHBOOK_START_${token}__; ${fixture.command}\r`,
            ]);

            fixture.chunks.forEach((chunk) => {
                pty.emit(chunk);
            });

            const result = await resultPromise;

            assert.deepEqual(output, fixture.expectOutput);
            assert.deepEqual(pty.writes, [
                `echo __BASHBOOK_START_${token}__; ${fixture.command}\r`,
                `echo "|${token}|exit:$?|cwd:$(pwd)|"\r`,
            ]);
            assert.deepEqual(result, fixture.expectResult);
            assert.equal(pty.disposed, true);
        });
    });
});
