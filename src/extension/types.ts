import type { Profile } from "./profiles/Profile";
import type { CommandParser } from "./util/CommandParser";

export interface Graph {
    profile: Profile;
    parser: CommandParser;
    historyPush: (value: string) => void;
    setCWD: (cwd: string) => void;
}

export interface Result {
    exitCode: number;
    cwd: string;
}
