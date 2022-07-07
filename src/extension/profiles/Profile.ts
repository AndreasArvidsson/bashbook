import { getProfile } from "../util/Options";
import ProfileBash from "./ProfileBash";
import ProfileGitBash from "./ProfileGitBash";
import ProfileCsh from "./ProfileCsh";

export default interface Profile {
  getShell(): string;
  updateRootPath(path: string): string;
  nodeToShellPath(path: string): string;
  readHistory(): Promise<string[]>;
  getPS1(uuid: string): string;
  getPS2(ps2: string): string;
}

export type ProfileValue = "Bash" | "Git Bash" | "Csh";

export function createProfile(): Profile {
  const profile = getProfile();
  switch (profile) {
    case "Bash":
      return new ProfileBash();
    case "Git Bash":
      return new ProfileGitBash();
    case "Csh":
      return new ProfileCsh();
  }
}
