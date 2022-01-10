# BashBook

A notebook for bash. Run shell script in notebook cells.

**Early version. Not for public consumption yet!**

## Commands

- `ctrl+backspace`  
   `bashbook.cell.executeAndClear`  
   Execute Cell and clear content

## Components

- node-pty
- xterm.js

## Build dependencies

### Rebuild node-pty with correct electron version

Only necessary on windows... probably

```
cd node_modules/node-pty
../.bin/electron-rebuild
```
