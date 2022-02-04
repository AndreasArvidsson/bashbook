import * as path from "path";
import ProfileBash from "./ProfileBash";

export default class ProfileGitBash extends ProfileBash {
  getShell(): string {
    return "C:/Program Files/Git/bin/bash.exe";
  }

  nodeToShellPath(path: string): string {
    // c: => /c/
    if (/^\[a-zA-Z]:/.test(path)) {
      path = `/${path[0]}/${path.substring(2)}`;
    }
    return path.replace(/\\/, "/");
  }

  updateRootPath(rootPath: string): string {
    // /c/ => c:
    if (/^\/[a-zA-Z]\//.test(rootPath)) {
      return `${rootPath[1]}:${rootPath.substring(2)}`;
    }
    if (rootPath.startsWith("/")) {
      return path.join("C:/Program Files/Git", rootPath);
    }
    return rootPath;
  }
}
