export interface Profile {
    useConpty?: boolean;
    getShell(): string;
    updateRootPath(path: string): string;
    nodeToShellPath(path: string): string;
    readHistory(): Promise<string[]>;
    getPS1(uuid: string): string;
    getPS2(ps2: string): string;
}

export type ProfileValue = "Bash" | "Git Bash" | "Csh";
