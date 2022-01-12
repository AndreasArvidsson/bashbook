import Profile from "./profiles/Profile";

export interface Graph {
  profile: Profile;
  historyPush: (value: string) => void;
  setCWD: (cwd: string) => void;
}
