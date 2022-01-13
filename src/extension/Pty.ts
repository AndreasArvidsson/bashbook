import { commands } from "vscode";
import { IPty, spawn } from "node-pty";
import Parser from "./util/Parser";

const CTRL_C = "\x03";
const UUID = "b83a4057-8ba5-4546-92c6-3b189d7c1ce9";
const ROWS = 30;
const UUID_REGEXP = new RegExp(UUID.split("").join("\\s*\\r?\\n?"));
const PS2 = "> ";

interface Result {
  errorCode: number;
  cwd: string;
}

export default class Pty {
  public pid: number;
  private pty: IPty;

  constructor(shell: string, cwd: string) {
    this.pty = spawn(shell, [], {
      name: "xterm-color",
      cols: 80,
      rows: ROWS,
      cwd,
      env: <{ [key: string]: string }>process.env,
    });

    this.pty.onExit(() => {
      console.debug("Exit");
      commands.executeCommand("workbench.action.closeActiveEditor");
    });

    this.pid = this.pty.pid;

    // Set prompt
    this.pty.write(`export PS1="${UUID}|\\$?|\\w|"\r`);
    this.pty.write(`export PS2="${PS2}"\r`);
  }

  dispose() {
    this.pty.kill();
  }

  getCols() {
    return this.pty.cols;
  }

  setCols(cols: number) {
    this.pty.resize(cols, ROWS);
    this.pty.write("\r");
  }

  write(data: string) {
    this.pty.write(data);
  }

  terminate() {
    this.pty.write(CTRL_C);
  }

  writeCommand(command: string, onData: (data: string) => void) {
    return new Promise<Result>((resolve, reject) => {
      const parser = new Parser();
      let waitingForCommand = command;
      let firstData = true;
      let ps1State = 0;
      let errorCode: number;
      let cwd: string;

      // Don't print command when it's echoed back
      const parseCommand = () => {
        if (waitingForCommand.startsWith("\n")) {
          const i = parser.indexOf(PS2);
          if (i > -1) {
            waitingForCommand = waitingForCommand.substring(1);
            parser.advance(i + PS2.length);
          }
        }
        waitingForCommand = parser.match(waitingForCommand);

        // We're both waiting for command and have data in the parser buffer
        // Something has gone wrong with the parsing of the command. Probably due to control characters.
        if (
          waitingForCommand &&
          !parser.isEmpty() &&
          !waitingForCommand.startsWith("\n")
        ) {
          console.error(
            `Waiting for command with data in parser buffer\n'${parser.get()}'`
          );
          waitingForCommand = "";
        }

        if (!waitingForCommand) {
          parseCallback = parseData;
        }

        if (!parser.isEmpty()) {
          parseCallback();
        }
      };

      const parseData = () => {
        if (firstData) {
          firstData = false;
          parser.trimLeadingAnsiAndNl();
        }

        // const [bufferI, dataI] = parser.lookahead(UUID);TODO

        const uuidMatch = parser.get().match(UUID_REGEXP);
        const data = uuidMatch
          ? parser.read(uuidMatch.index!)
          : parser.readAll();

        if (data) {
          onData(data);
        }

        if (uuidMatch) {
          parseCallback = parsePS1;
          parseCallback();
        }
      };

      const parsePS1 = () => {
        // Each part of the PS1 ends with '|'
        const index = parser.indexOf("|");
        if (index < 1) {
          return;
        }
        parser.trimAnsiAndNl();
        if (ps1State === 0) {
          parser.advance(UUID.length);
        } else if (ps1State === 1) {
          errorCode = Number.parseInt(parser.read(index));
        } else {
          cwd = parser.read(index);
          const result = { errorCode, cwd };
          disposable.dispose();
          if (errorCode === 0) {
            resolve(result);
          } else {
            reject(result);
          }
        }

        parser.match("|");
        ++ps1State;
        parsePS1();
      };

      let parseCallback = parseCommand;

      const disposable = this.pty.onData((data) => {
        parser.append(data);
        parseCallback();
      });

      this.pty.write(`${command}\r`);
    });
  }
}
