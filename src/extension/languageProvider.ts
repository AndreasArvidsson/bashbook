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

  constructor() {
    this.push = this.push.bind(this);

    readHistory().then((history) => {
      history.forEach((value) => {
        this.result.push({
          label: value,
          kind: CompletionItemKind.Text,
        });
      });
    });
  }

  provideCompletionItems() {
    return this.result;
  }

  push(value: string) {
    this.result.push({
      label: value,
      kind: CompletionItemKind.Text,
    });
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
