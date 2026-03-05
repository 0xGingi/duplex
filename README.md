# Duplex

Desktop app for working on multiple coding branches with built-in terminals and Git workflows.

<img width="4084" height="2250" alt="CleanShot 2026-03-04 at 20 04 21@2x" src="https://github.com/user-attachments/assets/56a3e474-672a-4812-8174-ded520cc04ca" />


## Features

- Multi-branch workspace tabs (create, reopen, switch, close).
- Per-tab CLI terminal sessions (`codex`, `claude`, `kimi`, or `opencode`) for branch work.
- Custom CLI tools can be added and edited (name + command), then used per tab.
- Custom commands are validated on save, and missing commands show clear launch errors (local/SSH).
- User-selectable default CLI for newly opened projects and tabs.
- Bottom shell terminal (always plain terminal), resizable.
- Git sidebar with:
  - unstaged/staged sections
  - stage/unstage file or all
  - discard file or all unstaged changes
  - commit / amend / push / publish branch
  - diff viewer for staged and unstaged changes
- Session persistence:
  - last project path
  - open tabs and active tab
  - panel sizes and layout state
  - branch tabs restored on app restart
- SSH remote project support (`ssh://user@host:/absolute/path` internally).

## Tech Stack

- Electron + React + Vite
- Tailwind CSS
- Zustand
- xterm + node-pty

## Requirements

- Bun (recommended) or Node-compatible environment for tooling
- `git` available in PATH
- `ssh` available in PATH (for remote projects)
- Optional: `codex`, `claude`, `kimi`, and/or `opencode` installed where you want to run them
  - local tabs: local machine
  - SSH tabs: remote host

## Getting Started

```bash
bun install
bun run dev
```

Build production assets:

```bash
bun run build
```

Create distributable app (AppImage on Linux, DMG on macOS config):

```bash
bun run dist
```

## Usage

### Select a project

- Use `Local` to open a local folder.
- Use `SSH` and enter:
  - host (example: `user@server`)
  - absolute remote repo path (example: `/home/user/my-repo`)

### Branch tabs

- `New Branch` creates a branch workspace tab.
- Existing branches can be reopened from `Open existing branch...`.
- Branch workspaces are copied from the project root and skip `node_modules`.

### Terminals

- Main tab terminals run the selected CLI (`Codex` / `Claude` / `Kimi` / `OpenCode`) per tab.
- Default CLI is configurable under `CLI Settings` in the sidebar.
- Custom tools added in `CLI Settings` appear in all CLI selectors.
- Bottom terminal is always a shell terminal in the active tab folder.
- Drag the divider above the bottom terminal to resize split height.

### Git panel

- Stage/unstage files and view diffs.
- Commit or amend with message.
- Push or publish (`push -u origin <branch>`).
- Discard operations apply to unstaged changes.

## SSH Notes

- Remote project paths are stored as: `ssh://user@host:/absolute/path`.
- Git operations for SSH projects execute remotely over SSH.
- Branch copy/reopen/delete for SSH projects are also done remotely.
- If CLI commands fail in SSH tabs, verify the CLI exists on the remote host.
- Clipboard image paste in SSH tabs is forwarded by Duplex: the image is uploaded to `/tmp/codex-clipboard-*.png` on the remote host and that remote path is pasted into the terminal.

## Project Structure

```text
electron/
  main/        Electron main process, IPC handlers, git/project/pty services
  preload/     Renderer bridge API
src/
  components/  UI panels (sidebar, terminal, git)
  stores/      Zustand state
  types/       Shared TS types
```

## Troubleshooting

- Black window on Linux:
  - Use the latest built app from this repo state.
  - GPU acceleration is disabled for Linux in main process for stability.
- AppImage fails with `chrome-sandbox` setuid error or doesn't display:
  - Launch with: `./Duplex-*.AppImage --no-sandbox --ozone-platform=x11`
  - Or set environment variable: `ELECTRON_OZONE_PLATFORM_HINT=x11 ./Duplex-*.AppImage --no-sandbox`
- SSH connection fails:
  - test directly: `ssh user@host`
  - verify repo path exists and is a git repo.
- Push/publish fails:
  - check remote auth and branch upstream configuration.
