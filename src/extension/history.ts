import { readFile } from "fs";
import { resolve } from "path";
import { getShell } from "./Options";
import { homedir } from "os";

export const readHistory = (): Promise<string[]> => {
  const shell = getShell();

  if (!shell.includes("bash")) {
    console.error(`Can't read history file. Shell '${shell}' is not bash.`);
    return Promise.resolve([]);
  }

  const historyFile = resolve(homedir(), ".bash_history");

  return new Promise((resolve) => {
    readFile(historyFile, "utf8", function (err, data) {
      if (err) {
        console.error(err);
        resolve([]);
        return;
      }
      const lines = data.split("\n").filter(Boolean);
      resolve(lines);
    });
  });
};
