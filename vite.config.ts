import { builtinModules } from "node:module";
import path from "node:path";
import { defineConfig } from "vite";

// oxlint-disable-next-line import/no-default-export
export default defineConfig(({ mode: outMode, command }) => {
    const outDir = "out";
    const sourcemap = true;
    const emptyOutDir = false;
    const isWatch = process.argv.includes("--watch");
    const mode = command === "build" && !isWatch ? "production" : "development";

    if (outMode === "renderer") {
        return {
            mode,
            build: {
                outDir,
                sourcemap,
                emptyOutDir,
                lib: {
                    entry: path.resolve(__dirname, "src/renderer/renderer.ts"),
                    formats: ["es"],
                    fileName: "renderer",
                },
            },
        };
    }

    return {
        mode,
        build: {
            outDir,
            sourcemap,
            emptyOutDir,
            lib: {
                entry: path.resolve(__dirname, "src/extension/extension.ts"),
                formats: ["cjs"],
                fileName: "extension",
            },
            rollupOptions: {
                external: [
                    "vscode",
                    "node-pty",
                    ...builtinModules,
                    ...builtinModules.map((m) => `node:${m}`),
                ],
            },
        },
    };
});
