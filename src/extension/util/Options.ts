import { workspace } from "vscode";
import { ProfileValue } from "../profiles/Profile";
import { NOTEBOOK_TYPE } from "../Constants";

export function getShell() {
  return workspace.getConfiguration(NOTEBOOK_TYPE).get<string>("shell");
}

export function getProfile() {
  return workspace
    .getConfiguration(NOTEBOOK_TYPE)
    .get<ProfileValue>("profile", "Bash");
}
