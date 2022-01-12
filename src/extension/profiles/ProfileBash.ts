import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import Profile from "./Profile";

export default class ProfileBash implements Profile {
  getShell(): string {
    return os.platform() === "win32" ? "bash.exe" : "bash";
  }

  getRootPath() {
    return "/";
  }

  readHistory(): Promise<string[]> {
    return new Promise((resolve) => {
      const historyFile = path.resolve(os.homedir(), ".bash_history");
      fs.readFile(historyFile, "utf8", (err, data) => {
        if (err) {
          console.error(err);
          resolve([]);
          return;
        }
        const lines = data.split("\n").filter(Boolean);
        resolve(lines);
      });
    });
  }
}
