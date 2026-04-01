import { workspace } from "vscode";
import type { Disposable } from "vscode";
import { NOTEBOOK_TYPE } from "../constants";
import type { ProfileValue } from "../profiles/Profile";

export function getProfile(): ProfileValue {
    return workspace
        .getConfiguration(NOTEBOOK_TYPE)
        .get<ProfileValue>("profile", "Bash");
}

export function getShell(): string | undefined {
    const shell = workspace.getConfiguration(NOTEBOOK_TYPE).get("shell", "");
    return shell.length > 0 ? shell : undefined;
}

export function getDebug(): boolean {
    return workspace.getConfiguration(NOTEBOOK_TYPE).get("debug", false);
}

export function onDebugChange(callback: () => void): Disposable {
    const config = `${NOTEBOOK_TYPE}.debug`;
    return workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration(config)) {
            callback();
        }
    });
}
