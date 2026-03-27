import * as vscode from "vscode";
import {
    CONTROLLER_ID,
    LANGUAGE,
    NOTEBOOK_LABEL,
    NOTEBOOK_TYPE,
} from "./Constants";
import type { ExecutionOptions } from "./Notebook";
import { Notebook } from "./Notebook";
import type { Graph } from "./types";

export class Controller {
    private readonly controller: vscode.NotebookController;
    private readonly notebooks = new Map<string, Notebook>();

    constructor(private readonly graph: Graph) {
        this.controller = vscode.notebooks.createNotebookController(
            CONTROLLER_ID,
            NOTEBOOK_TYPE,
            NOTEBOOK_LABEL,
            this.executeHandler.bind(this),
        );
        this.controller.supportedLanguages = [LANGUAGE];
        this.controller.supportsExecutionOrder = true;
    }

    dispose(): void {
        this.controller.dispose();
        for (const notebook of this.notebooks.values()) {
            notebook.dispose();
        }
        this.notebooks.clear();
    }

    onDidCloseNotebookDocument(document: vscode.NotebookDocument): void {
        this.notebooks.get(document.uri.toString())?.dispose();
        this.notebooks.delete(document.uri.toString());
    }

    onData(notebookUri: string, cellUri: string, data: string): void {
        this.notebooks.get(notebookUri)?.onData(cellUri, data);
    }

    setCols(notebookUri: string, cols: number): void {
        this.notebooks.get(notebookUri)?.setCols(cols);
    }

    doExecution(
        cell: vscode.NotebookCell,
        options: ExecutionOptions = {},
    ): Promise<string> {
        return new Promise<string>((resolve) => {
            const notebook = this.notebooks.get(cell.notebook.uri.toString());

            if (notebook == null) {
                resolve("");
                return;
            }

            void notebook.doExecution(
                this.controller.createNotebookCellExecution(cell),
                options,
                resolve,
            );
        });
    }

    private async executeHandler(
        cells: vscode.NotebookCell[],
        notebook: vscode.NotebookDocument,
    ): Promise<void> {
        let notebookInstance = this.notebooks.get(notebook.uri.toString());

        if (notebookInstance == null) {
            notebookInstance = new Notebook(this.graph, notebook.uri);
            this.notebooks.set(notebook.uri.toString(), notebookInstance);
        }

        await Promise.all(
            cells.map((cell) =>
                notebookInstance.doExecution(
                    this.controller.createNotebookCellExecution(cell),
                ),
            ),
        );
    }
}
