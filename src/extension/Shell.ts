import { spawn } from "child_process";

const shell = "C:\\Program Files\\Git\\bin\\bash.exe"; // TODO

const ERROR_CODE = "ERRORCODE=";

export const createShell = () => {
  const child = spawn(shell, { shell: false });

  const run = (command: string) => {
    return new Promise((resolve, reject) => {
      let buf = Buffer.alloc(0);

      child.stdout.on("data", (chunk: any) => {
        buf = Buffer.concat([buf, chunk]);
        const index = buf.indexOf(ERROR_CODE);

        if (index > -1) {
          const code = String(buf.slice(index + ERROR_CODE.length)).trimEnd();
          const results = String(buf.slice(0, index));
          if (code === "0") {
            resolve(results);
          } else {
            reject(results);
          }
        }
      });

      child.stderr.once("data", (chunk: any) => {
        buf = Buffer.concat([buf, chunk]);
        reject(String(buf));
      });

      child.once("error", (error: any) => {
        reject(String(error));
      });

      child.stdin.write(`${command}; echo ${ERROR_CODE}$?\n`);
    });
  };

  const dispose = () => {
    child.stdin.end();
    child.disconnect();
  };

  return {
    run,
    dispose,
  };
};
