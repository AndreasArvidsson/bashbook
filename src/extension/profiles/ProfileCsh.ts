import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import Profile from "./Profile";

export default class ProfileCsh implements Profile {
  getShell(): string {
    return "csh";
  }

  updateRootPath(path: string): string {
    return path;
  }

  nodeToShellPath(path: string): string {
    return path;
  }

  getPS1(uuid: string): string {
    return 'set prompt="' + uuid + '|`echo $status`|`pwd`|"\r';
  }

  getPS2(ps2: string): string {
    return `set prompt2="${ps2}"\r`;
  }

  readHistory(): Promise<string[]> {
    return new Promise((resolve) => {
      const historyFile = path.resolve(os.homedir(), ".history");
      fs.readFile(historyFile, "utf8", (err, data) => {
        if (err) {
          console.error(err);
          resolve([]);
          return;
        }
        const lines = data.split("\n").filter(Boolean).filter((l) => !l.startsWith("#"));
        resolve(lines);
      });
    });
  }
}
