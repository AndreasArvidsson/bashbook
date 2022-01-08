import { workspace } from "vscode";
import { platform } from "os";

const NAMESPACE = "bashbook";

export function getShell() {
  const shell = workspace.getConfiguration(NAMESPACE).get<string>("shell");
  if (shell) {
    return shell;
  }

  return platform() === "win32" ? "bash.exe" : "bash";
}
