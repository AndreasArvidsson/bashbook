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

    // return this.getHistory(text).concat(this.getFiles(text, position));
    return this.getFiles(text, position, document);
  }

  private getHistory(text: string) {
    // History completes from start of line
    return text
      ? this.history.filter(({ label }) => (<string>label).startsWith(text))
      : this.history;
  }

  private getFiles(
    text: string,
    position: vscode.Position,
    document: vscode.TextDocument
  ) {
    // Start of line is dedicated to history
    if (position.character === 0) {
      return [];
    }

    // File system completes from last non-whitespace token
    // TODO Handle quoted and escaped paths with white space in them
    const existingPath = findLastPath(text);
    let absPath: string;
    if (existingPath) {
      // '\ ' is not a syntax that works in node
      const pathText = existingPath.replace(/\\ /g, " ");
      if (pathText.startsWith("~")) {
        absPath = path.join(os.homedir(), pathText.substring(1));
      } else if (pathText.startsWith("/")) {
        absPath = this.profile.updateRootPath(pathText);
      } else {
        absPath = path.resolve(this.cwd, pathText);
      }
    } else {
      absPath = path.resolve(this.cwd);
    }

    const files = getFilesForDirOrParent(absPath);
    const name = files.name.toLowerCase();
    const filteredFiles = name
      ? files.files.filter((file) => file.toLowerCase().startsWith(name))
      : files.files;

    const existingName = existingPath.split("/").pop()!;
    const insertingRange = new vscode.Range(
      position.translate({
        characterDelta: -existingName.length,
      }),
      position
    );

    // TODO
    console.log(absPath);
    console.log(filteredFiles);

    return filteredFiles.map((file) =>
      createFileCompletionItem(file, insertingRange)
    );
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

function createFileCompletionItem(file: string, insertingRange: vscode.Range) {
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
  item.range = {
    inserting: insertingRange,
    replacing: new vscode.Range(
      insertingRange.start,
      insertingRange.start.translate({ characterDelta: textLength })
    ),
  };
  return item;
}
