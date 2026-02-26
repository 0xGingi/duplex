import type { CliType, GitFileChange, GitStatus, FileDiff, Tab, PersistedState } from './index'

interface PtyCreateResult {
  ok: boolean
  error?: string
}

export interface ElectronAPI {
  // Project
  selectProjectFolder: () => Promise<{ path: string; name: string } | null>
  connectSshProject: (host: string, remotePath: string) => Promise<{ path: string; name: string }>
  getGitBranch: (path: string) => Promise<string>
  getGitBranches: (path: string) => Promise<string[]>
  getGitRemote: (path: string) => Promise<string>

  // Project duplication
  duplicateProject: (sourcePath: string, branchName: string) => Promise<string>
  deleteProjectCopy: (path: string) => Promise<void>
  listProjectCopies: (sourcePath: string) => Promise<string[]>

  // PTY
  ptyCreate: (id: string, cwd: string, cliType?: CliType) => Promise<PtyCreateResult>
  ptyWrite: (id: string, data: string) => void
  ptyResize: (id: string, cols: number, rows: number) => void
  ptyKill: (id: string) => Promise<void>
  onPtyData: (callback: (id: string, data: string) => void) => () => void
  onPtyExit: (callback: (id: string, code: number) => void) => () => void

  // Git
  getGitStatus: (path: string) => Promise<GitStatus>
  getFileDiff: (path: string, file: string, staged?: boolean) => Promise<string>
  stageFile: (path: string, file: string) => Promise<void>
  unstageFile: (path: string, file: string) => Promise<void>
  stageAll: (path: string) => Promise<void>
  unstageAll: (path: string) => Promise<void>
  commit: (path: string, message: string) => Promise<void>
  amendCommit: (path: string, message?: string) => Promise<void>
  push: (path: string) => Promise<void>
  publishBranch: (path: string) => Promise<void>
  discardFile: (path: string, file: string) => Promise<void>
  discardAll: (path: string) => Promise<void>

  // Store
  storeGet: <T>(key: string) => Promise<T | undefined>
  storeSet: (key: string, value: unknown) => Promise<void>

  // Window
  windowMinimize: () => void
  windowMaximize: () => void
  windowClose: () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
