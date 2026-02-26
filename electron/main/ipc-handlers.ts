import { ipcMain, type BrowserWindow } from 'electron'
import {
  selectProjectFolder,
  connectSshProject,
  duplicateProject,
  deleteProjectCopy,
  listProjectCopies,
} from './project-service.ts'
import {
  getBranch,
  getRemote,
  getStatus,
  getFileDiff,
  getStagedFileDiff,
  listBranches,
  stageFile,
  unstageFile,
  stageAll,
  unstageAll,
  commit,
  amendCommit,
  push,
  publishBranch,
  discardFile,
  discardAll,
} from './git-service.ts'
import { createPty, writePty, resizePty, killPty } from './pty-manager.ts'
import store from './store.ts'
import type { CliType } from '../../src/types/index.ts'

type WindowGetter = () => BrowserWindow | null

let handlersRegistered = false

function getActiveWindow(getWindow: WindowGetter): BrowserWindow {
  const win = getWindow()
  if (!win || win.isDestroyed()) {
    throw new Error('No active window')
  }
  return win
}

export function registerIpcHandlers(getWindow: WindowGetter): void {
  if (handlersRegistered) return
  handlersRegistered = true

  // Project
  ipcMain.handle('project:select-folder', () => selectProjectFolder(getActiveWindow(getWindow)))
  ipcMain.handle('project:connect-ssh', (_e, host: string, remotePath: string) =>
    connectSshProject(host, remotePath)
  )
  ipcMain.handle('project:duplicate', (_e, sourcePath: string, branchName: string) =>
    duplicateProject(sourcePath, branchName)
  )
  ipcMain.handle('project:delete-copy', (_e, path: string) => deleteProjectCopy(path))
  ipcMain.handle('project:list-copies', (_e, sourcePath: string) => listProjectCopies(sourcePath))

  // Git
  ipcMain.handle('git:branch', (_e, path: string) => getBranch(path))
  ipcMain.handle('git:branches', (_e, path: string) => listBranches(path))
  ipcMain.handle('git:remote', (_e, path: string) => getRemote(path))
  ipcMain.handle('git:status', (_e, path: string) => getStatus(path))
  ipcMain.handle('git:file-diff', (_e, path: string, file: string, staged?: boolean) =>
    staged ? getStagedFileDiff(path, file) : getFileDiff(path, file)
  )
  ipcMain.handle('git:stage-file', (_e, path: string, file: string) => stageFile(path, file))
  ipcMain.handle('git:unstage-file', (_e, path: string, file: string) => unstageFile(path, file))
  ipcMain.handle('git:stage-all', (_e, path: string) => stageAll(path))
  ipcMain.handle('git:unstage-all', (_e, path: string) => unstageAll(path))
  ipcMain.handle('git:commit', (_e, path: string, message: string) => commit(path, message))
  ipcMain.handle('git:amend-commit', (_e, path: string, message?: string) => amendCommit(path, message))
  ipcMain.handle('git:push', (_e, path: string) => push(path))
  ipcMain.handle('git:publish', (_e, path: string) => publishBranch(path))
  ipcMain.handle('git:discard-file', (_e, path: string, file: string) => discardFile(path, file))
  ipcMain.handle('git:discard-all', (_e, path: string) => discardAll(path))

  // PTY
  ipcMain.handle('pty:create', (_e, id: string, cwd: string, cliType?: CliType) => {
    try {
      const win = getActiveWindow(getWindow)
      createPty(id, cwd, win, cliType)
      return { ok: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const win = getWindow()

      if (win && !win.isDestroyed()) {
        win.webContents.send('pty:data', id, `\r\n[Failed to start terminal: ${message}]\r\n`)
        win.webContents.send('pty:exit', id, 1)
      }

      return { ok: false, error: message }
    }
  })
  ipcMain.on('pty:write', (_e, id: string, data: string) => writePty(id, data))
  ipcMain.on('pty:resize', (_e, id: string, cols: number, rows: number) => resizePty(id, cols, rows))
  ipcMain.handle('pty:kill', (_e, id: string) => killPty(id))

  // Store
  ipcMain.handle('store:get', (_e, key: string) => store.get(key))
  ipcMain.handle('store:set', (_e, key: string, value: unknown) => store.set(key, value))

  // Window controls
  ipcMain.on('window:minimize', () => {
    const win = getWindow()
    if (win && !win.isDestroyed()) {
      win.minimize()
    }
  })
  ipcMain.on('window:maximize', () => {
    const win = getWindow()
    if (!win || win.isDestroyed()) return
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
  })
  ipcMain.on('window:close', () => {
    const win = getWindow()
    if (win && !win.isDestroyed()) {
      win.close()
    }
  })
}
