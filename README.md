# BashBook

Notebook for running bash/shell script

**Early version. Not for public consumption yet!**

## Commands

- `ctrl+backspace`  
   `bashbook.cell.executeAndClear`  
   Execute cell and clear content

- `shift+backspace`
  `bashbook.cell.clearAndEdit`  
   Clear cell content and edit

- `bashbook.newNotebook`  
   Create new Bash notebook

## Build dependencies

## Build local

```
npm install
npm run compile
```

## Components

- node-pty
- xterm.js

### Rebuild node-pty with correct electron version

If you get an error `NODE_MODULE_VERSION` mismatch run the following:

```
cd node_modules/node-pty
../.bin/electron-rebuild
```
