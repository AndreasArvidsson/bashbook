import { Disposable, ExtensionMode } from "vscode";
import { NOTEBOOK_LABEL } from "./constants";
import { getErrorMessage } from "./util/getErrorMessage";
import { getDebug, onDebugChange } from "./util/Options";

let debug = false;

export interface Logger {
    debug(message: string): void;
    log(message: string): void;
    warn(message: string): void;
    error(message: string, error?: unknown): void;
}

export const logger: Logger = {
    debug: (message: string): void => {
        if (debug) {
            console.debug(`[${NOTEBOOK_LABEL}] ${message}`);
        }
    },
    log: (message: string): void => {
        console.log(`[${NOTEBOOK_LABEL}] ${message}`);
    },
    warn: (message: string): void => {
        console.warn(`[${NOTEBOOK_LABEL}] ${message}`);
    },
    error: (message: string, error?: unknown): void => {
        const msg = `[${NOTEBOOK_LABEL}] ${message}`;
        if (error != null) {
            console.error(`${msg}: ${getErrorMessage(error)}`);
        } else {
            console.error(msg);
        }
    },
};

export function initLogger(extensionMode: ExtensionMode): Disposable {
    if (extensionMode === ExtensionMode.Development) {
        debug = true;
        return Disposable.from();
    }

    debug = getDebug();

    return onDebugChange(() => {
        debug = getDebug();
    });
}
