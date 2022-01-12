import { getProfile } from "../Options";
import ProfileBash from "./ProfileBash";
import ProfileGitBash from "./ProfileGitBash";

export default interface Profile {
  getShell(): string;
  getRootPath(): string;
  readHistory(): Promise<string[]>;
}

export type ProfileValue = "Bash" | "Git Bash";

export function createProfile(): Profile {
  const profile = getProfile();
  switch (profile) {
    case "Bash":
      return new ProfileBash();
    case "Git Bash":
      return new ProfileGitBash();
  }
}
