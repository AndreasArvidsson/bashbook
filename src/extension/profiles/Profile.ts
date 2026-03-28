export interface Profile {
    useConpty?: boolean;
    getShell(): string;
    getPromtp1(prompt: string): string;
    getPrompt2(prompt: string): string;
    getResultCommand(token: string): string;
    updateRootPath(path: string): string;
    nodeToShellPath(path: string): string;
    readHistory(): Promise<string[]>;
}

export type ProfileValue = "Bash" | "Git Bash" | "Csh";
