import * as path from "node:path";
import fastGlob from "fast-glob";
import Mocha from "mocha";

const mocha = new Mocha({
    ui: "tdd",
    color: true,
    // grep: "performSearch",
});

const cwd = path.resolve(__dirname);

const files = fastGlob.sync("**/**.test.ts", { cwd }).toSorted();

if (files.length === 0) {
    throw new Error("No test files found.");
}

files.forEach((f) => mocha.addFile(path.resolve(cwd, f)));

mocha.run((failures) => {
    if (failures > 0) {
        throw new Error(`${failures} tests failed.`);
    }
});
