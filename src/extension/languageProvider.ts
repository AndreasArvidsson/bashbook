import * as vscode from "vscode";
import * as os from "os";
import * as path from "path";
import getFilesForDirOrParent from "./util/getFilesForDirOrParent";
import Profile from "./profiles/Profile";
import { LANGUAGE } from "./Constants";

const selector: vscode.DocumentSelector = { language: LANGUAGE };

export class BashCompletionItemProvider
  implements vscode.CompletionItemProvider
{
  static readonly triggerCharacters = ["/"];
  private history: vscode.CompletionItem[] = [];
  private map = new Map<string, vscode.CompletionItem>();
  private nextIndex = Number.MAX_SAFE_INTEGER;
  private cwd = "/";

  constructor(private profile: Profile) {
    this.setCWD = this.setCWD.bind(this);
    this.historyPush = this.historyPush.bind(this);

    profile.readHistory().then((history) => {
      history.forEach(this.historyPush);
    });
  }

  setCWD(cwd: string) {
    this.cwd = cwd.startsWith("~")
      ? tildeToPath(cwd)
      : this.profile.updateRootPath(cwd);
  }

  historyPush(value: string) {
    if (!this.map.has(value)) {
      const item: vscode.CompletionItem = {
        label: value,
        kind: vscode.CompletionItemKind.Event,
      };
      this.map.set(value, item);
      this.history.push(item);
    }
    this.map.get(value)!.sortText = `${--this.nextIndex}`;
  }

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ) {
    const line = document.lineAt(position.line);
    const text = line.text.substring(0, position.character);
    const historyItems = await this.getHistory(text, line.range);
    const fileItems = await this.getFiles(text, position);
    return historyItems.concat(fileItems);
  }

  private async getHistory(text: string, range: vscode.Range) {
    // History completes from start of line
    const lines = text
      ? this.history.filter(({ label }) => (<string>label).startsWith(text))
      : this.history;
    lines.forEach((line) => {
      line.range = range;
    });
    return lines;
  }

  private async getFiles(text: string, position: vscode.Position) {
    // Start of line is dedicated to history
    // An empty ~ does not reference the home directory like ~/ does
    if (position.character === 0 || text === "~") {
      return [];
    }

    // File system completes from last non-whitespace token
    const existingPath = findLastPath(text);
    let absPath: string;
    if (existingPath) {
      // '\ ' is not a syntax that works in node
      const pathText = existingPath.replace(/\\ /g, " ");
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

    const existingName = existingPath.split("/").pop()!;

    const startPosition = position.translate({
      characterDelta: -existingName.length,
    });

    console.debug(`Path: ${absPath}`);
    console.debug(filteredFiles);

    return filteredFiles.map((file) =>
      createFileCompletionItem(file, startPosition)
    );
  }
}

class CodeLensProvider implements vscode.CodeLensProvider {
  private disposable?: vscode.Disposable;
  private cwd = "/";

  register() {
    this.dispose();
    this.disposable = vscode.languages.registerCodeLensProvider(selector, this);
  }

  dispose() {
    this.disposable?.dispose();
  }

  setCWD(cwd: string) {
    if (this.cwd !== cwd) {
      this.cwd = cwd;
      console.log(cwd);
      this.register();
    }
  }

  provideCodeLenses(
    document: vscode.TextDocument
  ): vscode.ProviderResult<vscode.CodeLens[]> {
    if (vscode.window.activeTextEditor?.document !== document) {
      return null;
    }
    const topOfDocument = new vscode.Range(0, 0, 0, 0);
    const command = { title: this.cwd, command: "" };
    const codeLens = new vscode.CodeLens(topOfDocument, command);
    return [codeLens];
  }
}

export default (profile: Profile) => {
  const historyCompletionItemProvider = new BashCompletionItemProvider(profile);
  const codeLensProvider = new CodeLensProvider();
  return {
    disposable: vscode.Disposable.from(
      vscode.languages.registerCompletionItemProvider(
        selector,
        historyCompletionItemProvider,
        ...BashCompletionItemProvider.triggerCharacters
      ),
      codeLensProvider,
      vscode.window.onDidChangeActiveTextEditor(() =>
        codeLensProvider.register()
      )
    ),
    historyPush: historyCompletionItemProvider.historyPush,
    setCWD: (cwd: string) => {
      historyCompletionItemProvider.setCWD(cwd);
      codeLensProvider.setCWD(cwd);
    },
  };
};

function findLastPath(text: string) {
  // Since javascript doesn't support negative lookbehind we have to do this manually
  const parts = text.split(" ");
  let result = parts[parts.length - 1];
  for (let i = parts.length - 2; i > -1; --i) {
    if (!parts[i].endsWith("\\")) {
      break;
    }
    result = parts[i] + " " + result;
  }
  return result;
}

function createFileCompletionItem(
  file: string,
  startPosition: vscode.Position
) {
  const item: vscode.CompletionItem = {
    label: file,
    kind: vscode.CompletionItemKind.File,
  };
  let textLength;
  if (file.includes(" ")) {
    item.insertText = file.replace(/[ ]/g, "\\ ");
    item.filterText = item.insertText;
    textLength = item.insertText.length;
  } else {
    textLength = file.length;
  }
  item.range = new vscode.Range(
    startPosition,
    startPosition.translate({ characterDelta: textLength })
  );
  return item;
}

function tildeToPath(relativePath: string) {
  return path.join(os.homedir(), relativePath.substring(1));
}
