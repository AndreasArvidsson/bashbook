// https://raw.githubusercontent.com/chalk/ansi-regex/main/index.js

function createAnsiRegex({ onlyFirst = false } = {}) {
  const pattern = [
    "(\\[\\d*[A-Z])",
    "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))",
  ].join("|");

  return new RegExp(pattern, onlyFirst ? undefined : "g");
}

export const ansiRegex = createAnsiRegex();
export const ansiRegexLeading = createAnsiRegex({ onlyFirst: true });
