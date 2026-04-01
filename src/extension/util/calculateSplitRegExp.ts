export function calculateSplitRegExp(prompt: string): RegExp {
    return new RegExp(String.raw`\r?\n|(?=${prompt})`);
}
