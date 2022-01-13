import * as fs from "fs";
import * as path from "path";

export default (absPath: string) => {
  try {
    const stat = fs.statSync(absPath);
    if (stat.isDirectory()) {
      return {
        files: fs.readdirSync(absPath),
        name: "",
      };
    }
  } catch (ex) {}
  const parentPath = path.dirname(absPath);
  if (absPath !== parentPath) {
    try {
      return {
        files: fs.readdirSync(parentPath),
        name: path.basename(absPath),
      };
    } catch (ex) {}
  }
  return {
    files: [],
    name: "",
  };
};
