declare const require: NodeJS.Require
const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron')
import type { CliType } from '../../src/types/index.ts'

contextBridge.exposeInMainWorld('electronAPI', {
  // Project
  selectProjectFolder: () => ipcRenderer.invoke('project:select-folder'),
  connectSshProject: (host: string, remotePath: string) =>
    ipcRenderer.invoke('project:connect-ssh', host, remotePath),
  getGitBranch: (path: string) => ipcRenderer.invoke('git:branch', path),
  getGitBranches: (path: string) => ipcRenderer.invoke('git:branches', path),
  getGitRemote: (path: string) => ipcRenderer.invoke('git:remote', path),

  // Project duplication
  duplicateProject: (sourcePath: string, branchName: string) =>
    ipcRenderer.invoke('project:duplicate', sourcePath, branchName),
  deleteProjectCopy: (path: string) => ipcRenderer.invoke('project:delete-copy', path),
  listProjectCopies: (sourcePath: string) => ipcRenderer.invoke('project:list-copies', sourcePath),

  // PTY
  ptyCreate: (id: string, cwd: string, cliType?: CliType) =>
    ipcRenderer.invoke('pty:create', id, cwd, cliType),
  ptyWrite: (id: string, data: string) => ipcRenderer.send('pty:write', id, data),
  ptyResize: (id: string, cols: number, rows: number) => ipcRenderer.send('pty:resize', id, cols, rows),
  ptyKill: (id: string) => ipcRenderer.invoke('pty:kill', id),
  onPtyData: (callback: (id: string, data: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, id: string, data: string) => callback(id, data)
    ipcRenderer.on('pty:data', handler)
    return () => ipcRenderer.removeListener('pty:data', handler)
  },
  onPtyExit: (callback: (id: string, code: number) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, id: string, code: number) => callback(id, code)
    ipcRenderer.on('pty:exit', handler)
    return () => ipcRenderer.removeListener('pty:exit', handler)
  },

  // Git
  getGitStatus: (path: string) => ipcRenderer.invoke('git:status', path),
  getFileDiff: (path: string, file: string, staged?: boolean) =>
    ipcRenderer.invoke('git:file-diff', path, file, staged),
  stageFile: (path: string, file: string) => ipcRenderer.invoke('git:stage-file', path, file),
  unstageFile: (path: string, file: string) => ipcRenderer.invoke('git:unstage-file', path, file),
  stageAll: (path: string) => ipcRenderer.invoke('git:stage-all', path),
  unstageAll: (path: string) => ipcRenderer.invoke('git:unstage-all', path),
  commit: (path: string, message: string) => ipcRenderer.invoke('git:commit', path, message),
  amendCommit: (path: string, message?: string) => ipcRenderer.invoke('git:amend-commit', path, message),
  push: (path: string) => ipcRenderer.invoke('git:push', path),
  publishBranch: (path: string) => ipcRenderer.invoke('git:publish', path),
  discardFile: (path: string, file: string) => ipcRenderer.invoke('git:discard-file', path, file),
  discardAll: (path: string) => ipcRenderer.invoke('git:discard-all', path),

  // Store
  storeGet: <T>(key: string) => ipcRenderer.invoke('store:get', key) as Promise<T | undefined>,
  storeSet: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),

  // Window
  windowMinimize: () => ipcRenderer.send('window:minimize'),
  windowMaximize: () => ipcRenderer.send('window:maximize'),
  windowClose: () => ipcRenderer.send('window:close'),
})
