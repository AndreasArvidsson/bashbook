import { IPty, spawn } from "node-pty";
import { createPromise } from "./Promise";

const CTRL_C = "\x03";
const errorCode = "ERRORCODE=";

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
  }

  dispose() {
    this.pty.kill();
  }

  write(data: string) {
    this.pty.write(data);
  }

  writeCommand(command: string, onData: (data: string) => void) {
    const { promise, resolve, reject } = createPromise<number>();
    let waitingForCommand = true;

    const disposable = this.pty.onData((data) => {
      // Don't print command when it's echoed back
      if (waitingForCommand) {
        waitingForCommand = false;
        return;
      }

      const errorCodeIndex = data.indexOf(errorCode);
      if (errorCodeIndex > -1) {
        const code = Number.parseInt(data[errorCodeIndex + errorCode.length]);
        const success = code === 0;
        if (errorCodeIndex > 0) {
          onData(data.substring(0, errorCodeIndex));
        }
        disposable.dispose();
        if (success) {
          resolve(code);
        } else {
          reject(code);
        }
      } else {
        onData(data);
      }
    });

    const terminate = () => {
      disposable.dispose();
      this.pty.write(CTRL_C);
      reject(-1);
    };

    this.pty.write(`${command}; echo ${errorCode}$?\r`);

    return {
      promise,
      terminate,
    };
  }
}
