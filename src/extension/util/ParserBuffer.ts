import { ansiRegexLeading } from "./ansiRegex";

export default class ParserBuffer {
  private buffer = "";

  append(data: string) {
    this.buffer += data;
  }

  clear() {
    this.buffer = "";
  }

  get(index?: number) {
    return index == null ? this.buffer : this.buffer[index];
  }

  length() {
    return this.buffer.length;
  }

  isEmpty() {
    return this.buffer.length === 0;
  }

  indexOf(data: string) {
    return this.buffer.indexOf(data);
  }

  indexOfNl() {
    const i = this.buffer.indexOf("\n");
    if (i < 0) {
      return null;
    }
    return {
      index: this.buffer[i - 1] === "\r" ? i - 1 : i,
      indexAfter: i + 1,
    };
  }

  match(data: string) {
    const [bufferI, dataI] = this.lookahead(data);
    this.buffer = this.buffer.substring(bufferI);
    return data.substring(dataI);
  }

  lookahead(data: string) {
    let bufferI = 0;
    let dataI = 0;

    while (bufferI < this.buffer.length && dataI < data.length) {
      const bufferChar = this.buffer[bufferI];
      if (bufferChar !== data[dataI]) {
        if (bufferChar === "\r" || bufferChar === "\n") {
          ++bufferI;
          continue;
        }
        break;
      }
      ++bufferI;
      ++dataI;
    }
    return [bufferI, dataI];
  }

  read(length: number) {
    const result = this.buffer.substring(0, length);
    this.advance(length);
    return result;
  }

  readAll() {
    const result = this.buffer;
    this.buffer = "";
    return result;
  }

  advance(length: number) {
    this.buffer = this.buffer.substring(length);
  }

  trimLeadingAnsiAndNl() {
    this.buffer = this.buffer
      .replace(ansiRegexLeading, "")
      .replace(/^\r?\n?/, "");
  }

  trimNl() {
    this.buffer = this.buffer.replace(/\r?\n?/g, "");
  }
}
