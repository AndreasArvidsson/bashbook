import {
  CompletionItem,
  CompletionItemKind,
  CompletionItemProvider,
  Disposable,
  DocumentSelector,
  languages,
  Position,
  TextDocument,
} from "vscode";
import * as os from "os";
import * as path from "path";
import { LANGUAGE } from "./Constants";
import { readHistory } from "./history";
import { getFilesForDirOrParent } from "./fileSystem";

const selector: DocumentSelector = { language: LANGUAGE };

export class BashCompletionItemProvider implements CompletionItemProvider {
  static readonly triggerCharacters = [];
  private history: CompletionItem[] = [];
  private map = new Map<string, CompletionItem>();
  private nextIndex = Number.MAX_SAFE_INTEGER;
  private cwd = "/";

  constructor() {
    this.historyPush = this.historyPush.bind(this);
    this.setCWD = this.setCWD.bind(this);

    readHistory().then((history) => {
      history.forEach(this.historyPush);
    });
  }

  provideCompletionItems(document: TextDocument, position: Position) {
    let text = document
      .lineAt(position.line)
      .text.substring(0, position.character);

    // History completes from the start of the line
    const historyResult = text
      ? this.history.filter(({ label }) => (<string>label).startsWith(text))
      : this.history;

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
        absPath = path.resolve(text);
      } else {
        absPath = path.resolve(this.cwd, text);
      }
    } else {
      absPath = path.resolve(this.cwd);
    }

    // TODO
    console.log(`'${this.cwd}'`);
    console.log(`'${text}'`);
    console.log(absPath);

    const files = getFilesForDirOrParent(absPath);
    const name = files.name.toLowerCase();
    const filteredFiles = files.name
      ? files.files.filter((file) => file.toLowerCase().startsWith(name))
      : files.files;
    const filesResult = filteredFiles.map((file) => ({
      label: file,
      kind: CompletionItemKind.File,
    }));

    // TODO
    console.log(filteredFiles);

    return historyResult.concat(filesResult);
  }

  historyPush(value: string) {
    if (!this.map.has(value)) {
      const item = {
        label: value,
        kind: CompletionItemKind.Text,
      };
      this.map.set(value, item);
      this.history.push(item);
    }
    this.map.get(value)!.sortText = `${--this.nextIndex}`;
  }

  setCWD(cwd: string) {
    this.cwd = cwd;
  }
}

export function registerLanguageProvider() {
  const historyCompletionItemProvider = new BashCompletionItemProvider();
  return {
    disposable: Disposable.from(
      languages.registerCompletionItemProvider(
        selector,
        historyCompletionItemProvider,
        ...BashCompletionItemProvider.triggerCharacters
      )
    ),
    historyPush: historyCompletionItemProvider.historyPush,
    setCWD: historyCompletionItemProvider.setCWD,
  };
}
