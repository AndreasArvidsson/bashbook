import { workspace } from "vscode";
import { NOTEBOOK_TYPE } from "./Constants";
import { ProfileValue } from "./profiles/Profile";

export function getShell() {
  return workspace.getConfiguration(NOTEBOOK_TYPE).get<string>("shell");
}

export function getProfile() {
  return workspace
    .getConfiguration(NOTEBOOK_TYPE)
    .get<ProfileValue>("profile", "Bash");
}
