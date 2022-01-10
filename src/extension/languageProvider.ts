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
import { LANGUAGE } from "./Constants";
import { readHistory } from "./history";

const selector: DocumentSelector = { language: LANGUAGE };

export class HistoryCompletionItemProvider implements CompletionItemProvider {
  static readonly triggerCharacters = [];
  private history: CompletionItem[] = [];
  private map = new Map<string, CompletionItem>();
  private nextIndex = Number.MAX_SAFE_INTEGER;

  constructor() {
    this.historyPush = this.historyPush.bind(this);

    readHistory().then((history) => {
      history.forEach(this.historyPush);
    });
  }

  provideCompletionItems(document: TextDocument, position: Position) {
    let text = document
      .lineAt(position.line)
      .text.substring(0, position.character);

    const historyResult = text
      ? this.history.filter(({ label }) => (<string>label).startsWith(text))
      : this.history;

    return historyResult;
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
}

export function registerLanguageProvider() {
  const historyCompletionItemProvider = new HistoryCompletionItemProvider();
  return {
    disposable: Disposable.from(
      languages.registerCompletionItemProvider(
        selector,
        historyCompletionItemProvider,
        ...HistoryCompletionItemProvider.triggerCharacters
      )
    ),
    historyPush: historyCompletionItemProvider.historyPush,
  };
}
