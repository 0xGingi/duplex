import { create } from 'zustand'
import type { Project } from '../types/index.ts'

interface AppStore {
  project: Project | null
  sidebarWidth: number
  gitPanelWidth: number
  gitPanelOpen: boolean
  bottomTerminalHeight: number

  setProject: (project: Project | null) => void
  setSidebarWidth: (width: number) => void
  setGitPanelWidth: (width: number) => void
  toggleGitPanel: () => void
  setGitPanelOpen: (open: boolean) => void
  setBottomTerminalHeight: (height: number) => void
}

export const useAppStore = create<AppStore>((set) => ({
  project: null,
  sidebarWidth: 240,
  gitPanelWidth: 320,
  gitPanelOpen: true,
  bottomTerminalHeight: 208,

  setProject: (project) => set({ project }),
  setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
  setGitPanelWidth: (gitPanelWidth) => set({ gitPanelWidth }),
  toggleGitPanel: () => set((s) => ({ gitPanelOpen: !s.gitPanelOpen })),
  setGitPanelOpen: (gitPanelOpen) => set({ gitPanelOpen }),
  setBottomTerminalHeight: (bottomTerminalHeight) => set({ bottomTerminalHeight }),
}))
