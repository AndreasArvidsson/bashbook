import { randomUUID } from "node:crypto";

export function generateToken(): string {
    return randomUUID().slice(0, 8);
}

export function generateStart(token: string): string {
    return `__BASHBOOK_START_${token}__`;
}

export function generatePrompt(): string {
    return `__BASHBOOK_PROMPT__${generateToken()}__`;
}
