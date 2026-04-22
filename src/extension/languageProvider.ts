import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { LANGUAGE } from "./constants";
import { logger } from "./logger";
import type { Profile } from "./profiles/Profile";
import { getFilesForDirOrParent } from "./util/getFilesForDirOrParent";

const selector: vscode.DocumentSelector = { language: LANGUAGE };

export class BashCompletionItemProvider
    implements vscode.CompletionItemProvider
{
    public static readonly triggerCharacters = ["/"];
    private readonly history: vscode.CompletionItem[] = [];
    private readonly map = new Map<string, vscode.CompletionItem>();
    private nextIndex = Number.MAX_SAFE_INTEGER;
    private cwd = "/";

    public constructor(private readonly profile: Profile) {
        this.setCWD = this.setCWD.bind(this);
        this.historyPush = this.historyPush.bind(this);

        void (async () => {
            const history = await this.profile.readHistory();
            for (const h of history) {
                this.historyPush(h);
            }
        })();
    }

    public setCWD(cwd: string): void {
        this.cwd = cwd.startsWith("~")
            ? tildeToPath(cwd)
            : this.profile.updateRootPath(cwd);
    }

    public historyPush(value: string): void {
        if (!this.map.has(value)) {
            const item: vscode.CompletionItem = {
                label: value,
                kind: vscode.CompletionItemKind.Event,
            };
            this.map.set(value, item);
            this.history.push(item);
        }
        // oxlint-disable-next-line typescript/no-non-null-assertion
        this.map.get(value)!.sortText = `${--this.nextIndex}`;
    }

    public provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
    ): vscode.CompletionItem[] {
        const line = document.lineAt(position.line);
        const text = line.text.slice(0, position.character);
        const historyItems = this.getHistory(text, line.range);
        const fileItems = this.getFiles(text, position);
        return historyItems.concat(fileItems);
    }

    private getHistory(
        text: string,
        range: vscode.Range,
    ): vscode.CompletionItem[] {
        // History completes from start of line
        const lines = text
            ? // oxlint-disable-next-line typescript/no-base-to-string
              this.history.filter(({ label }) => String(label).startsWith(text))
            : this.history;
        lines.forEach((line) => {
            line.range = range;
        });
        return lines;
    }

    private getFiles(
        text: string,
        position: vscode.Position,
    ): vscode.CompletionItem[] {
        // Start of line is dedicated to history
        // An empty ~ does not reference the home directory like ~/ does
        if (position.character === 0 || text === "~") {
            return [];
        }

        // File system completes from last non-whitespace token
        const existingPath = findLastPath(text);
        let absPath: string;
        if (existingPath.length > 0) {
            // '\ ' is not a syntax that works in node
            const pathText = existingPath.replaceAll(String.raw`\ `, " ");
            if (pathText.startsWith("~")) {
                absPath = tildeToPath(pathText);
            } else if (pathText.startsWith("/")) {
                absPath = this.profile.updateRootPath(pathText);
            } else {
                absPath = path.join(this.cwd, pathText);
            }
        } else {
            absPath = this.cwd;
        }

        const files = getFilesForDirOrParent(absPath);
        const name = files.name.toLowerCase();
        const filteredFiles = name
            ? files.files.filter((file) => file.toLowerCase().startsWith(name))
            : files.files;

        const existingName = existingPath.split("/").pop();

        if (existingName == null) {
            return [];
        }

        const startPosition = position.translate({
            characterDelta: -existingName.length,
        });

        logger.debug(`Path: ${absPath}`);
        logger.debug(filteredFiles.join(", "));

        return filteredFiles.map((file) =>
            createFileCompletionItem(file, startPosition),
        );
    }
}

class CodeLensProvider implements vscode.CodeLensProvider {
    private disposable?: vscode.Disposable;
    private cwd = "";
    private cwdPretty = "";

    public constructor(private readonly profile: Profile) {}

    public register(): void {
        this.dispose();
        this.disposable = vscode.languages.registerCodeLensProvider(
            selector,
            this,
        );
    }

    public dispose(): void {
        this.disposable?.dispose();
    }

    public setCWD(cwd: string): void {
        if (this.cwd !== cwd) {
            this.cwd = cwd;
            const { workspaceFolders } = vscode.workspace;
            if (workspaceFolders != null && workspaceFolders.length > 0) {
                const workspacePath = path.resolve(
                    workspaceFolders[0].uri.fsPath,
                );
                const workspaceParentPath = path.resolve(workspacePath, "..");
                const updatedCwd = this.profile.updateRootPath(cwd);
                const relativePath = path.relative(
                    workspaceParentPath,
                    updatedCwd,
                );
                const dirName = path.basename(workspacePath);
                this.cwdPretty = relativePath.startsWith(dirName)
                    ? this.profile.nodeToShellPath(relativePath)
                    : cwd;
            }
            this.register();
        }
    }

    public provideCodeLenses(
        document: vscode.TextDocument,
    ): vscode.ProviderResult<vscode.CodeLens[]> {
        if (vscode.window.activeTextEditor?.document !== document) {
            return null;
        }
        const topOfDocument = new vscode.Range(0, 0, 0, 0);
        const command = { title: this.cwdPretty, command: "" };
        const codeLens = new vscode.CodeLens(topOfDocument, command);
        return [codeLens];
    }
}

export function registerLanguageProvider(profile: Profile): {
    disposable: vscode.Disposable;
    historyPush: (command: string) => void;
    setCWD: (cwd: string) => void;
} {
    const historyCompletionItemProvider = new BashCompletionItemProvider(
        profile,
    );
    const codeLensProvider = new CodeLensProvider(profile);
    return {
        disposable: vscode.Disposable.from(
            vscode.languages.registerCompletionItemProvider(
                selector,
                historyCompletionItemProvider,
                ...BashCompletionItemProvider.triggerCharacters,
            ),
            codeLensProvider,
            vscode.window.onDidChangeActiveTextEditor(() => {
                codeLensProvider.register();
            }),
        ),
        historyPush: (cmd: string) => {
            historyCompletionItemProvider.historyPush(cmd);
        },
        setCWD: (cwd: string) => {
            historyCompletionItemProvider.setCWD(cwd);
            codeLensProvider.setCWD(cwd);
        },
    };
}

function findLastPath(text: string): string {
    // Since javascript doesn't support negative lookbehind we have to do this manually
    const parts = text.split(" ");
    let result = parts[parts.length - 1];
    for (let i = parts.length - 2; i > -1; --i) {
        if (!parts[i].endsWith("\\")) {
            break;
        }
        result = `${parts[i]} ${result}`;
    }
    return result;
}

function createFileCompletionItem(
    file: string,
    startPosition: vscode.Position,
): vscode.CompletionItem {
    const item: vscode.CompletionItem = {
        label: file,
        kind: vscode.CompletionItemKind.File,
    };
    let textLength;
    if (file.includes(" ")) {
        item.insertText = file.replaceAll(/[ ]/g, String.raw`\ `);
        item.filterText = item.insertText;
        textLength = item.insertText.length;
    } else {
        textLength = file.length;
    }
    item.range = new vscode.Range(
        startPosition,
        startPosition.translate({ characterDelta: textLength }),
    );
    return item;
}

function tildeToPath(relativePath: string): string {
    return path.join(os.homedir(), relativePath.slice(1));
}
