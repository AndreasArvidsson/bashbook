import { getProfile } from "../util/Options";
import type { Profile } from "./Profile";
import { ProfileBash } from "./ProfileBash";
import { ProfileCsh } from "./ProfileCsh";
import { ProfileGitBash } from "./ProfileGitBash";

export function createProfile(): Profile {
    const profile = getProfile();
    switch (profile) {
        case "Bash":
            return new ProfileBash();
        case "Git Bash":
            return new ProfileGitBash();
        case "Csh":
            return new ProfileCsh();
        default:
            throw new Error("Unsupported profile");
    }
}
