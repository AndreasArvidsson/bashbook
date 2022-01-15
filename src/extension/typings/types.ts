import CommandParser from "../util/CommandParser";
import Profile from "../profiles/Profile";

export interface Graph {
  profile: Profile;
  parser: CommandParser;
  historyPush: (value: string) => void;
  setCWD: (cwd: string) => void;
}
