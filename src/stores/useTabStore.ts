import { create } from 'zustand'
import type { Tab, CliType } from '../types/index.ts'

interface TabStore {
  tabs: Tab[]
  activeTabId: string | null

  addTab: (tab: Tab) => void
  removeTab: (id: string) => void
  setActiveTab: (id: string) => void
  updateTab: (id: string, updates: Partial<Tab>) => void
  setTabs: (tabs: Tab[]) => void
  getActiveTab: () => Tab | undefined
}

export const useTabStore = create<TabStore>((set, get) => ({
  tabs: [],
  activeTabId: null,

  addTab: (tab) =>
    set((s) => ({
      tabs: [...s.tabs, tab],
      activeTabId: tab.id,
    })),

  removeTab: (id) =>
    set((s) => {
      const newTabs = s.tabs.filter((t) => t.id !== id)
      let newActive = s.activeTabId
      if (s.activeTabId === id) {
        const idx = s.tabs.findIndex((t) => t.id === id)
        newActive = newTabs[idx]?.id ?? newTabs[idx - 1]?.id ?? null
      }
      return { tabs: newTabs, activeTabId: newActive }
    }),

  setActiveTab: (id) => set({ activeTabId: id }),

  updateTab: (id, updates) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),

  setTabs: (tabs) => set({ tabs }),

  getActiveTab: () => {
    const { tabs, activeTabId } = get()
    return tabs.find((t) => t.id === activeTabId)
  },
}))
