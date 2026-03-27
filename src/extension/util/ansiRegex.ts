// https://raw.githubusercontent.com/chalk/ansi-regex/main/index.js

function createAnsiRegex(): RegExp {
    const pattern = [
        String.raw`(\[\d*[A-Z])`,
        String.raw`[\u001B\u009B][[\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\d\/#&.:=?%@~_]+)*|[a-zA-Z\d]+(?:;[-a-zA-Z\d\/#&.:=?%@~_]*)*)?\u0007)`,
        String.raw`(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))`,
    ].join("|");

    return new RegExp(pattern, "g");
}

const ansiRegex = createAnsiRegex();

export function cleanAnsi(input: string): string {
    ansiRegex.lastIndex = 0;
    return input.replaceAll(ansiRegex, "").replaceAll("\r", "");
}
