import { create } from 'zustand'
import { DEFAULT_CLI_TYPE } from '../lib/cli-tools.ts'
import type { CliType, CustomCliTool, Project } from '../types/index.ts'

interface AppStore {
  project: Project | null
  sidebarWidth: number
  gitPanelWidth: number
  gitPanelOpen: boolean
  bottomTerminalHeight: number
  defaultCliType: CliType
  customCliTools: CustomCliTool[]

  setProject: (project: Project | null) => void
  setSidebarWidth: (width: number) => void
  setGitPanelWidth: (width: number) => void
  toggleGitPanel: () => void
  setGitPanelOpen: (open: boolean) => void
  setBottomTerminalHeight: (height: number) => void
  setDefaultCliType: (cliType: CliType) => void
  setCustomCliTools: (tools: CustomCliTool[]) => void
  setCliSettings: (settings: { defaultCliType: CliType; customCliTools: CustomCliTool[] }) => void
}

export const useAppStore = create<AppStore>((set) => ({
  project: null,
  sidebarWidth: 240,
  gitPanelWidth: 320,
  gitPanelOpen: true,
  bottomTerminalHeight: 208,
  defaultCliType: DEFAULT_CLI_TYPE,
  customCliTools: [],

  setProject: (project) => set({ project }),
  setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
  setGitPanelWidth: (gitPanelWidth) => set({ gitPanelWidth }),
  toggleGitPanel: () => set((s) => ({ gitPanelOpen: !s.gitPanelOpen })),
  setGitPanelOpen: (gitPanelOpen) => set({ gitPanelOpen }),
  setBottomTerminalHeight: (bottomTerminalHeight) => set({ bottomTerminalHeight }),
  setDefaultCliType: (defaultCliType) => set({ defaultCliType }),
  setCustomCliTools: (customCliTools) => set({ customCliTools }),
  setCliSettings: ({ defaultCliType, customCliTools }) => set({ defaultCliType, customCliTools }),
}))
