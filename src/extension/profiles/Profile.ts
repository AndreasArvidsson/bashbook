import { getProfile } from "../util/Options";
import ProfileBash from "./ProfileBash";
import ProfileGitBash from "./ProfileGitBash";

export default interface Profile {
  getShell(): string;
  updateRootPath(path: string): string;
  nodeToShellPath(path: string): string;
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
