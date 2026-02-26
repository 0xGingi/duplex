import { createRequire } from 'module'
import type { IPty } from 'node-pty'
import type { BrowserWindow } from 'electron'
import type { CliType } from '../../src/types/index.ts'
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

export function createPty(
  id: string,
  cwd: string,
  win: BrowserWindow,
  cliType?: CliType
): void {
  // Kill existing if any
  killPty(id)

  const remoteTarget = parseSshProjectPath(cwd)
  const pty = getPtyModule()
  const shell = getShell()
  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd: remoteTarget ? (process.env.HOME || process.cwd()) : cwd,
    env: { ...process.env } as Record<string, string>,
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

  if (remoteTarget) {
    setTimeout(() => {
      const remoteExec = cliType
        ? `exec ${shQuote(cliType === 'claude' ? 'claude' : 'codex')}`
        : 'exec ${SHELL:-/bin/bash} -l'
      const remoteCommand = `cd ${shQuote(remoteTarget.remotePath)} && ${remoteExec}`
      const sshCommand = `ssh -t ${shQuote(remoteTarget.host)} ${shQuote(remoteCommand)}`
      ptyProcess.write(`${sshCommand}\r`)
    }, 250)
    return
  }

  // Auto-launch CLI if specified
  if (cliType) {
    setTimeout(() => {
      const cmd = cliType === 'claude' ? 'claude' : 'codex'
      ptyProcess.write(`${cmd}\r`)
    }, 500)
  }
}

export function writePty(id: string, data: string): void {
  ptys.get(id)?.write(data)
}

export function resizePty(id: string, cols: number, rows: number): void {
  ptys.get(id)?.resize(cols, rows)
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
