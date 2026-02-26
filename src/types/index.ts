export type CliType = 'claude' | 'codex'

export interface Project {
  id: string
  name: string
  path: string
  branch: string
  remote?: string
}

export interface Tab {
  id: string
  projectId: string
  name: string
  branch: string
  cliType: CliType
  path: string
  ptyId?: string
  isOriginal: boolean
}

export interface GitFileChange {
  file: string
  status: 'M' | 'A' | 'D' | '?' | 'R' | 'C' | 'U'
  staged: boolean
}

export interface GitStatus {
  branch: string
  ahead: number
  behind: number
  changes: GitFileChange[]
}

export interface FileDiff {
  file: string
  hunks: string
}

export interface AppState {
  sidebarWidth: number
  gitPanelWidth: number
  gitPanelOpen: boolean
  bottomTerminalHeight: number
}

export interface RecentSshProject {
  host: string
  remotePath: string
  lastUsedAt: number
}

export interface PersistedState {
  lastProjectPath?: string
  recentSshProjects?: RecentSshProject[]
  tabs: Tab[]
  activeTabId?: string
  windowBounds?: { x: number; y: number; width: number; height: number }
  appState: AppState
}
