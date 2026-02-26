import { create } from 'zustand'
import type { GitStatus } from '../types/index.ts'

interface SelectedGitFile {
  tabId: string
  file: string
  staged: boolean
}

interface GitStore {
  statusByTab: Record<string, GitStatus>
  selectedFile: SelectedGitFile | null
  diffContent: string | null

  setStatus: (tabId: string, status: GitStatus) => void
  setSelectedFile: (file: SelectedGitFile | null) => void
  setDiffContent: (content: string | null) => void
  clearTab: (tabId: string) => void
  clearAll: () => void
}

export const useGitStore = create<GitStore>((set) => ({
  statusByTab: {},
  selectedFile: null,
  diffContent: null,

  setStatus: (tabId, status) =>
    set((s) => ({
      statusByTab: { ...s.statusByTab, [tabId]: status },
    })),

  setSelectedFile: (selectedFile) => set({ selectedFile }),
  setDiffContent: (diffContent) => set({ diffContent }),

  clearTab: (tabId) =>
    set((s) => {
      const { [tabId]: _, ...rest } = s.statusByTab
      return { statusByTab: rest }
    }),

  clearAll: () => set({ statusByTab: {}, selectedFile: null, diffContent: null }),
}))
