// Keep SGR color/style sequences, but drop terminal housekeeping that leaks into notebook output.
const eraseLineSequenceRegex = new RegExp(String.raw`\u001B\[[0-9;]*K`, "g");
const cursorVisibilitySequenceRegex = new RegExp(
    String.raw`\u001B\[\?25[hl]`,
    "g",
);

export function sanitizeRendererData(data: string): string {
    return data
        .replaceAll(eraseLineSequenceRegex, "")
        .replaceAll(cursorVisibilitySequenceRegex, "")
        .replaceAll(/\r(?!\n)/g, "");
}
