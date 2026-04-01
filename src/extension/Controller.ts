import * as vscode from "vscode";
import {
    CONTROLLER_ID,
    LANGUAGE,
    NOTEBOOK_LABEL,
    NOTEBOOK_TYPE,
} from "./constants";
import { Notebook } from "./Notebook";
import type { ExecutionOptions, Graph } from "./types";

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

    onDidOpenNotebookDocument(document: vscode.NotebookDocument): void {
        if (
            document.notebookType === NOTEBOOK_TYPE &&
            !this.notebooks.has(document.uri.toString())
        ) {
            this.notebooks.set(
                document.uri.toString(),
                new Notebook(this.graph, document.uri),
            );
        }
    }

    onDidCloseNotebookDocument(document: vscode.NotebookDocument): void {
        if (document.notebookType === NOTEBOOK_TYPE) {
            this.notebooks.get(document.uri.toString())?.dispose();
            this.notebooks.delete(document.uri.toString());
        }
    }

    syncNotebookDirectory(uri: vscode.Uri): void {
        const notebook = this.notebooks.get(uri.toString());
        if (notebook != null) {
            this.graph.setCWD(notebook.cwd);
        }
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
        return new Promise<string>((resolve, reject) => {
            const notebookInstance = this.getOrCreateNotebook(
                cell.notebook.uri,
            );

            void notebookInstance.doExecution(
                this.controller.createNotebookCellExecution(cell),
                options,
                resolve,
                reject,
            );
        });
    }

    private async executeHandler(
        cells: vscode.NotebookCell[],
        notebook: vscode.NotebookDocument,
    ): Promise<void> {
        const notebookInstance = this.getOrCreateNotebook(notebook.uri);

        await Promise.all(
            cells.map((cell) =>
                notebookInstance.doExecution(
                    this.controller.createNotebookCellExecution(cell),
                ),
            ),
        );
    }

    private getOrCreateNotebook(uri: vscode.Uri) {
        let notebookInstance = this.notebooks.get(uri.toString());

        if (notebookInstance == null) {
            notebookInstance = new Notebook(this.graph, uri);
            this.notebooks.set(uri.toString(), notebookInstance);
        }

        return notebookInstance;
    }
}
