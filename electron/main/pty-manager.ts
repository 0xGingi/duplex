import { createRequire } from 'module'
import type { IPty } from 'node-pty'
import type { BrowserWindow } from 'electron'
import type { CliType } from '../../src/types/index.ts'
import {
  buildMissingCliMessage,
  checkLocalExecutableAvailable,
  extractCommandExecutable,
  resolveCliCommand,
} from './cli-command.ts'
import { parseSshProjectPath, shQuote } from './ssh-utils.ts'

const require = createRequire(import.meta.url)
let ptyModule: typeof import('node-pty') | null = null
const ptys = new Map<string, IPty>()

function getPtyModule(): typeof import('node-pty') {
  if (ptyModule) return ptyModule

  ptyModule = require('node-pty') as typeof import('node-pty')
  return ptyModule
}

function getShell(): string {
  return process.env.SHELL || (process.platform === 'win32' ? 'powershell.exe' : '/bin/bash')
}

function getPtyEnv(): Record<string, string> {
  return { ...process.env } as Record<string, string>
}

export function createPty(
  id: string,
  cwd: string,
  win: BrowserWindow,
  cliType?: CliType,
  cliCommand?: string
): void {
  // Guard against duplicate create requests for the same tab/session id.
  // Existing PTY should continue running unless explicitly killed first.
  if (ptys.has(id)) return

  const remoteTarget = parseSshProjectPath(cwd)
  const launchCommand = resolveCliCommand(cliType, cliCommand)
  const launchExecutable = extractCommandExecutable(launchCommand)
  const pty = getPtyModule()
  const ptyProcess = remoteTarget
    ? pty.spawn(
      'ssh',
      [
        '-tt',
        remoteTarget.host,
        launchCommand
          ? `exec \${SHELL:-/bin/bash} -ilc ${shQuote(
            launchExecutable
              ? `cd ${shQuote(remoteTarget.remotePath)} && if command -v ${shQuote(launchExecutable)} >/dev/null 2>&1; then ${launchCommand}; else printf '%s\\n' ${shQuote(buildMissingCliMessage({
                scope: 'remote',
                host: remoteTarget.host,
                executable: launchExecutable,
              }))}; exec \${SHELL:-/bin/bash} -il; fi`
              : `cd ${shQuote(remoteTarget.remotePath)} && ${launchCommand}`
          )}`
          : `cd ${shQuote(remoteTarget.remotePath)} && exec \${SHELL:-/bin/bash} -il`,
      ],
      {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd: process.env.HOME || process.cwd(),
        env: getPtyEnv(),
      }
    )
    : pty.spawn(getShell(), process.platform === 'win32' ? [] : ['-il'], {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd,
      env: getPtyEnv(),
    })

  ptys.set(id, ptyProcess)

  ptyProcess.onData((data: string) => {
    if (!win.isDestroyed()) {
      win.webContents.send('pty:data', id, data)
    }
  })

  ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
    ptys.delete(id)
    if (!win.isDestroyed()) {
      win.webContents.send('pty:exit', id, exitCode)
    }
  })

  if (remoteTarget) return

  // Auto-launch CLI if specified
  if (launchCommand) {
    setTimeout(() => {
      if (launchExecutable && !checkLocalExecutableAvailable(launchExecutable)) {
        if (!win.isDestroyed()) {
          win.webContents.send(
            'pty:data',
            id,
            `\r\n${buildMissingCliMessage({ scope: 'local', executable: launchExecutable })}\r\n`
          )
        }
        return
      }
      ptyProcess.write(`${launchCommand}\r`)
    }, 500)
  }
}

export function writePty(id: string, data: string): void {
  ptys.get(id)?.write(data)
}

export function resizePty(id: string, cols: number, rows: number): void {
  const safeCols = Math.max(2, Math.floor(cols))
  const safeRows = Math.max(2, Math.floor(rows))
  ptys.get(id)?.resize(safeCols, safeRows)
}

export function killPty(id: string): void {
  const p = ptys.get(id)
  if (p) {
    p.kill()
    ptys.delete(id)
  }
}

export function killAll(): void {
  for (const [id, p] of ptys) {
    p.kill()
    ptys.delete(id)
  }
}
