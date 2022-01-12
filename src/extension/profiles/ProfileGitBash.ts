import ProfileBash from "./ProfileBash";

export default class ProfileGitBash extends ProfileBash {
  getShell(): string {
    return "C:/Program Files/Git/bin/bash.exe";
  }

  getRootPath(): string {
    return "C:/Program Files/Git/";
  }
}
