import { exec } from "child_process";
import { platform } from "os";

export const getChildrenForPPID = (ppid: number): Promise<number[]> => {
  if (platform() === "win32") {
    return getChildrenForPpidWin(ppid);
  }
  return getChildrenForPpidLinux(ppid);
};

const getChildrenForPpidWin = (ppid: number): Promise<number[]> => {
  return new Promise((resolve, reject) => {
    exec(
      `wmic process where "ParentProcessId='${ppid}'" get ProcessId`,
      {
        shell: "cmd",
      },
      (error, stdout, stderr) => {
        if (error != null) {
          reject(error);
          return;
        }
        if (stderr !== stderr) {
          reject(stderr);
          return;
        }
        const results = stdout
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(1)
          .map(Number.parseInt);
        resolve(results);
      }
    );
  });
};

const getChildrenForPpidLinux = (ppid: number): Promise<number[]> => {
  return new Promise((resolve, reject) => {
    exec(
      `ps -l | grep -e PPID -e ${ppid}`,
      {
        shell: "bash",
      },
      (error, stdout, stderr) => {
        if (error != null) {
          reject(error);
          return;
        }
        if (stderr !== stderr) {
          reject(stderr);
          return;
        }
        const lines = stdout.split("\n").filter(Boolean);
        const headers = lines[0].split(" ").filter(Boolean);
        const pidIndex = headers.indexOf("PID");
        const ppidIndex = headers.indexOf("PPID");
        const results: number[] = [];
        lines.slice(1).forEach((line) => {
          const lineCells = line.split(" ").filter((c) => c.length);
          if (Number.parseInt(lineCells[ppidIndex]) === ppid) {
            results.push(Number.parseInt(lineCells[pidIndex]));
          }
        });
        resolve(results);
      }
    );
  });
};
