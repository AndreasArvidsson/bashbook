import type { NotebookCellExecution } from "vscode";
import type { Profile } from "./profiles/Profile";
import type { CommandParser } from "./util/CommandParser";

export interface Graph {
    profile: Profile;
    parser: CommandParser;
    historyPush: (value: string) => void;
    setCWD: (cwd: string) => void;
}

export interface Result {
    exitCode: number;
    cwd: string;
}

export interface ExecutionOptions {
    noOutput?: boolean;
}

export interface CommandExecution {
    command: string;
    execution: NotebookCellExecution;
    cellUri: string;
    options: ExecutionOptions;
    resolve?: (value: string) => void;
    reject?: (reason: string) => void;
}
