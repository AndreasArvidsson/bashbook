# BashBook

A notebook for bash. Run shell script in notebook cells.

**Early version. Not for public consumption yet!**

## Commands

- `ctrl+backspace`  
   `bashbook.cell.executeAndClear`  
   Execute cell and clear content

- `shift+backspace`
  `bashbook.cell.clearAndEdit`  
   Clear cell content and edit

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
