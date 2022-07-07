# BashBook

Notebook for running bash/shell script

![example ls](./images/example_ls.png)

## Creating a BashBook

BashBook the way you would any normal notebook

1. Open a file with the `.bashbook` extension
1. New File... / `Bash Notebook`
1. Command / `BashBook: Create new Bash Notebook`

## Commands

- Create new Bash Notebook
- Open notebook as markdown
- Open all outputs in new file
- Execute cell and select content
- Execute cell and clear content
- Execute and show output in below markdown cell
- Clear cell content and edit
- Copy cell output
- Open cell output in new file

## Details

### One shell per notebook

Each notebook is running one continuous shell. This means that commands running in one cell will effect the others. Only one execution is allowed at the time and the rest is queued.

### Interactive terminal (prompt)

Interaction with running execution is possible in the output terminal. Finished executions are non-interactive.

![example prompt](./images/example_prompt.png)

### Resize

- Resizes terminal height to fit content dynamically
- Resizes terminal width at end of execution. Only affects next execution.

### Current Working Directory(CWD)

Tries to set CWD in following order

1. File directory
1. Workspace directory
1. User home directory

## Problem with Ubuntu/Debian

On a Ubuntu/Debian system you may get a `Cannot open resource with notebook editor` error if vscode is installed as a flatpack(Ubuntu Software). For BashBook to work correctly vscode needs to be installed with [apt install](https://code.visualstudio.com/docs/setup/linux#_debian-and-ubuntu-based-distributions)

## Build details

### Build local

```
npm install

# Run after each install
npm run rebuild

npm run compile
```

### Dependencies

Due to node-pty we have platform specific dependencies  
[node-pty dependencies](https://github.com/Microsoft/node-pty#dependencies)

### Components

- node-pty
- xterm.js

### Rebuild node-pty with correct electron version

If you get an error `NODE_MODULE_VERSION` mismatch.

1. Check the version of electron vscode is using. `Help => About => Electron`
1. Make sure you have the correct version of electron in `package.json`. List of electron versions is available [here](https://github.com/electron/releases#releases)
1. Run `npm run rebuild`
