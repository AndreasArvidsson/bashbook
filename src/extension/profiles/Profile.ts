export interface Profile {
    useConpty?: boolean;
    getShell(): string;
    getPrompts(prompt1: string, prompt2: string): string;
    getResultCommand(uuid: string): string;
    wrapCommand(command: string): string;
    updateRootPath(path: string): string;
    nodeToShellPath(path: string): string;
    readHistory(): Promise<string[]>;
}

export type ProfileValue = "Bash" | "Git Bash" | "Csh";
