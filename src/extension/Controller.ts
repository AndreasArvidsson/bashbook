import * as vscode from "vscode";
import {
  CONTROLLER_ID,
  LANGUAGE,
  NOTEBOOK_LABEL,
  NOTEBOOK_TYPE,
} from "./Constants";
import { Graph } from "./typings/types";
import Notebook, { ExecutionOptions } from "./Notebook";

export default class Controller {
  private readonly controller: vscode.NotebookController;
  private readonly notebooks = new Map<string, Notebook>();

  constructor(private graph: Graph) {
    this.controller = vscode.notebooks.createNotebookController(
      CONTROLLER_ID,
      NOTEBOOK_TYPE,
      NOTEBOOK_LABEL
    );
    this.controller.supportedLanguages = [LANGUAGE];
    this.controller.supportsExecutionOrder = true;
    this.doExecution = this.doExecution.bind(this);
    this.controller.executeHandler = this.executeHandler.bind(this);
    this.onDidOpenNotebookDocument = this.onDidOpenNotebookDocument.bind(this);
    this.onDidCloseNotebookDocument =
      this.onDidCloseNotebookDocument.bind(this);
  }

  dispose() {
    this.controller.dispose();
    this.notebooks.forEach((shell) => shell.dispose());
  }

  onDidOpenNotebookDocument(document: vscode.NotebookDocument) {
    this.notebooks.set(
      document.uri.toString(),
      new Notebook(this.graph, document.uri)
    );
  }

  onDidCloseNotebookDocument(document: vscode.NotebookDocument) {
    this.notebooks.get(document.uri.toString())?.dispose();
    this.notebooks.delete(document.uri.toString());
  }

  onData(notebookUri: string, cellUri: string, data: string) {
    this.notebooks.get(notebookUri)?.onData(cellUri, data);
  }

  setCols(notebookUri: string, cols: number) {
    this.notebooks.get(notebookUri)?.setCols(cols);
  }

  doExecution(cell: vscode.NotebookCell, options?: ExecutionOptions) {
    return new Promise<string>((resolve, reject) => {
      this.notebooks
        .get(cell.notebook.uri.toString())!
        .doExecution(
          this.controller.createNotebookCellExecution(cell),
          options,
          resolve,
          reject
        );
    });
  }

  private executeHandler(cells: vscode.NotebookCell[]) {
    for (const cell of cells) {
      this.notebooks
        .get(cell.notebook.uri.toString())!
        .doExecution(this.controller.createNotebookCellExecution(cell));
    }
  }
}
