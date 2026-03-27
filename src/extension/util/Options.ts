import { workspace } from "vscode";
import { NOTEBOOK_TYPE } from "../Constants";
import type { ProfileValue } from "../profiles/Profile";

export function getShell(): string | undefined {
    const shell = workspace
        .getConfiguration(NOTEBOOK_TYPE)
        .get<string>("shell", "");
    return shell.length > 0 ? shell : undefined;
}

export function getProfile(): ProfileValue {
    return workspace
        .getConfiguration(NOTEBOOK_TYPE)
        .get<ProfileValue>("profile", "Bash");
}
