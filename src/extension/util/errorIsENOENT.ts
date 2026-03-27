export function errorIsENOENT(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error != null &&
        "code" in error &&
        error.code === "ENOENT"
    );
}
