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

## Information

### One shell per notebook

Each notebook is running one continuous shell. This means that commands running in one cell will effect the others. Only one execution is allowed at the time. Rest is queued.

### Interactive terminal (prompt)

Interaction with running execution is possible in the output terminal. Finished executions are non-interactive.

### Resize

- Resize terminal height to fit content dynamically
- Resize terminal width at end of execution. Only affects next execution.

### Current Working Directory(CWD)

Tries to set CWD in following order

1. File directory
1. Workspace directory
1. User home directory

## Build details

### Build local

```
npm install
npm run compile
```

### Components

- node-pty
- xterm.js

### Rebuild node-pty with correct electron version

If you get an error `NODE_MODULE_VERSION` mismatch run the following:

```
cd node_modules/node-pty
../.bin/electron-rebuild
```
