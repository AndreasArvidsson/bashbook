/*
 * Inspired by
 * https://github.com/xtermjs/xterm.js/blob/master/addons/xterm-addon-fit/src/FitAddon.ts
 */

import { Terminal } from "xterm";

const MINIMUM_COLS = 2;

export default (terminal: Terminal) => {
  if (!terminal.element?.parentElement) {
    return;
  }

  const core = (terminal as any)._core;

  if (core._renderService.dimensions.actualCellWidth === 0) {
    return;
  }

  const parentElementStyle = window.getComputedStyle(
    terminal.element.parentElement
  );
  const elementStyle = window.getComputedStyle(terminal.element);

  const parentElementWidth = parseInt(parentElementStyle.width);
  const parentElementPadding =
    parseInt(parentElementStyle.paddingLeft) +
    parseInt(parentElementStyle.paddingRight);
  const elementPadding =
    parseInt(elementStyle.paddingLeft) + parseInt(elementStyle.paddingRight);
  const availableWidth =
    parentElementWidth -
    parentElementPadding -
    elementPadding -
    core.viewport.scrollBarWidth;

  return Math.max(
    MINIMUM_COLS,
    Math.floor(availableWidth / core._renderService.dimensions.actualCellWidth)
  );
};
