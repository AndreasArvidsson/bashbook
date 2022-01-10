import {
  CompletionItem,
  CompletionItemKind,
  CompletionItemProvider,
  Disposable,
  DocumentSelector,
  languages,
} from "vscode";
import { LANGUAGE } from "./Constants";
import { readHistory } from "./history";

const selector: DocumentSelector = { language: LANGUAGE };

export class HistoryCompletionItemProvider implements CompletionItemProvider {
  static readonly triggerCharacters = [];
  private result: CompletionItem[] = [];
  private map = new Map<string, CompletionItem>();
  private nextIndex = Number.MAX_SAFE_INTEGER;

  constructor() {
    this.push = this.push.bind(this);

    readHistory().then((history) => {
      history.forEach(this.push);
    });
  }

  provideCompletionItems() {
    return this.result;
  }

  push(value: string) {
    if (!this.map.has(value)) {
      const item = {
        label: value,
        kind: CompletionItemKind.Text,
      };
      this.map.set(value, item);
      this.result.push(item);
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
    historyPush: historyCompletionItemProvider.push,
  };
}
