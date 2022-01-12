import * as vscode from "vscode";
import * as os from "os";
import * as path from "path";
import { LANGUAGE } from "./Constants";
import { getFilesForDirOrParent } from "./fileSystem";
import Profile from "./profiles/Profile";

const selector: vscode.DocumentSelector = { language: LANGUAGE };

export class BashCompletionItemProvider
  implements vscode.CompletionItemProvider
{
  static readonly triggerCharacters = [];
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
    this.cwd = cwd;
  }

  historyPush(value: string) {
    if (!this.map.has(value)) {
      const item = {
        label: value,
        kind: vscode.CompletionItemKind.Text,
      };
      this.map.set(value, item);
      this.history.push(item);
    }
    this.map.get(value)!.sortText = `${--this.nextIndex}`;
  }

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ) {
    const text = document
      .lineAt(position.line)
      .text.substring(0, position.character);

    return this.getHistory(text).concat(this.getFiles(text, position));
  }

  private getHistory(text: string) {
    // History completes from start of line
    return text
      ? this.history.filter(({ label }) => (<string>label).startsWith(text))
      : this.history;
  }

  private getFiles(text: string, position: vscode.Position) {
    // Start of line is dedicated to history
    if (position.character === 0) {
      return [];
    }

    // File system completes from last non-whitespace token
    // TODO Handle quoted and escaped paths with white space in them
    const index = text.lastIndexOf(" ");
    if (index > -1) {
      text = text.substring(index + 1);
    }

    let absPath: string;
    if (text) {
      if (text.startsWith("~")) {
        absPath = path.join(os.homedir(), text.substring(1));
      } else if (text.startsWith("/")) {
        absPath = path.join(this.profile.getRootPath(), text.substring(1));
      } else {
        absPath = path.resolve(this.cwd, text);
      }
    } else {
      absPath = path.resolve(this.cwd);
    }

    const files = getFilesForDirOrParent(absPath);
    const name = files.name.toLowerCase();
    const filteredFiles = files.name
      ? files.files.filter((file) => file.toLowerCase().startsWith(name))
      : files.files;

    // TODO
    console.log(absPath);
    console.log(filteredFiles);

    return filteredFiles.map((file) => ({
      label: file,
      kind: vscode.CompletionItemKind.File,
    }));
  }
}

export function registerLanguageProvider(profile: Profile) {
  const historyCompletionItemProvider = new BashCompletionItemProvider(profile);
  return {
    disposable: vscode.Disposable.from(
      vscode.languages.registerCompletionItemProvider(
        selector,
        historyCompletionItemProvider,
        ...BashCompletionItemProvider.triggerCharacters
      )
    ),
    historyPush: historyCompletionItemProvider.historyPush,
    setCWD: historyCompletionItemProvider.setCWD,
  };
}
