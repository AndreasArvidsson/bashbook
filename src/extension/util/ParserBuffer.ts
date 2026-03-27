import { ansiRegexLeading } from "./ansiRegex";

export class ParserBuffer {
    private buffer = "";

    append(data: string): void {
        this.buffer += data;
    }

    clear(): void {
        this.buffer = "";
    }

    get(index?: number): string {
        return index == null ? this.buffer : this.buffer[index];
    }

    length(): number {
        return this.buffer.length;
    }

    isEmpty(): boolean {
        return this.buffer.length === 0;
    }

    indexOf(data: string): number {
        return this.buffer.indexOf(data);
    }

    indexOfNl(): { index: number; indexAfter: number } | null {
        const i = this.buffer.indexOf("\n");
        if (i === -1) {
            return null;
        }
        return {
            index: this.buffer[i - 1] === "\r" ? i - 1 : i,
            indexAfter: i + 1,
        };
    }

    match(data: string): string {
        const [bufferI, dataI] = this.lookahead(data);
        this.buffer = this.buffer.slice(bufferI);
        return data.slice(dataI);
    }

    lookahead(data: string): [number, number] {
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

    read(length: number): string {
        const result = this.buffer.slice(0, length);
        this.advance(length);
        return result;
    }

    readAll(): string {
        const result = this.buffer;
        this.buffer = "";
        return result;
    }

    advance(length: number): void {
        this.buffer = this.buffer.slice(length);
    }

    trimLeadingAnsiAndNl(): void {
        this.buffer = this.buffer
            .replace(ansiRegexLeading, "")
            .replace(/^\r?\n?/, "");
    }

    trimNl(): void {
        this.buffer = this.buffer.replaceAll(/\r?\n?/g, "");
    }
}
