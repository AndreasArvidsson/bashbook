import { IPty, spawn } from "node-pty";

const CTRL_C = "\x03";
const UUID = "b83a4057-8ba5-4546-92c6-3b189d7c1ce9";

interface Result {
  errorCode: number;
  cwd: string;
}

export default class Pty {
  public pid: number;
  private pty: IPty;

  constructor(shell: string) {
    this.pty = spawn(shell, [], {
      name: "xterm-color",
      cols: 80,
      rows: 30,
      cwd: process.env.HOME,
      env: <{ [key: string]: string }>process.env,
    });

    this.pid = this.pty.pid;

    // Set PS1/prompt
    this.pty.write(`export PS1="${UUID}|$?|\\w|"\r`);
  }

  dispose() {
    this.pty.kill();
  }

  write(data: string) {
    this.pty.write(data);
  }

  terminate() {
    this.pty.write(CTRL_C);
  }

  writeCommand(command: string, onData: (data: string) => void) {
    return new Promise<Result>((resolve, reject) => {
      let waitingForCommand = true;

      const disposable = this.pty.onData((data) => {
        // Don't print command when it's echoed back
        if (waitingForCommand) {
          waitingForCommand = false;
          return;
        }

        const uuidIndex = data.indexOf(UUID);
        if (uuidIndex > -1) {
          const ps1 = data.substring(uuidIndex);
          const ps1Parts = ps1.split("|");
          const errorCode = Number.parseInt(ps1Parts[1]);
          const cwd = ps1Parts[2];
          const result = { errorCode, cwd };

          // There is data before the prompt
          if (uuidIndex > 0) {
            onData(data.substring(0, uuidIndex));
          }

          disposable.dispose();
          if (errorCode === 0) {
            resolve(result);
          } else {
            reject(result);
          }
        } else {
          onData(data);
        }
      });

      this.pty.write(`${command}\r`);
    });
  }
}
