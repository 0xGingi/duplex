import { useEffect } from 'react'
import TitleBar from './components/layout/TitleBar.tsx'
import AppLayout from './components/layout/AppLayout.tsx'
import LeftSidebar from './components/sidebar/LeftSidebar.tsx'
import TerminalPanel from './components/terminal/TerminalPanel.tsx'
import RightSidebar from './components/git-panel/RightSidebar.tsx'
import { useAppStore } from './stores/useAppStore.ts'
import { useTabStore } from './stores/useTabStore.ts'
import type { Project, Tab, AppState } from './types/index.ts'

function usePersistence() {
  const project = useAppStore((s) => s.project)
  const setProject = useAppStore((s) => s.setProject)
  const sidebarWidth = useAppStore((s) => s.sidebarWidth)
  const gitPanelWidth = useAppStore((s) => s.gitPanelWidth)
  const gitPanelOpen = useAppStore((s) => s.gitPanelOpen)
  const bottomTerminalHeight = useAppStore((s) => s.bottomTerminalHeight)
  const setSidebarWidth = useAppStore((s) => s.setSidebarWidth)
  const setGitPanelWidth = useAppStore((s) => s.setGitPanelWidth)
  const setGitPanelOpen = useAppStore((s) => s.setGitPanelOpen)
  const setBottomTerminalHeight = useAppStore((s) => s.setBottomTerminalHeight)

  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const setTabs = useTabStore((s) => s.setTabs)
  const setActiveTab = useTabStore((s) => s.setActiveTab)
  const addTab = useTabStore((s) => s.addTab)

  // Restore state on mount
  useEffect(() => {
    const restore = async () => {
      // Restore app state
      const appState = await window.electronAPI.storeGet<AppState>('appState')
      if (appState) {
        if (appState.sidebarWidth) setSidebarWidth(appState.sidebarWidth)
        if (appState.gitPanelWidth) setGitPanelWidth(appState.gitPanelWidth)
        if (appState.gitPanelOpen !== undefined) setGitPanelOpen(appState.gitPanelOpen)
        if (appState.bottomTerminalHeight) setBottomTerminalHeight(appState.bottomTerminalHeight)
      }

      // Restore project
      const lastPath = await window.electronAPI.storeGet<string>('lastProjectPath')
      if (lastPath) {
        try {
          const branch = await window.electronAPI.getGitBranch(lastPath)
          const remote = await window.electronAPI.getGitRemote(lastPath)
          const name = lastPath.split('/').pop() || lastPath

          const proj: Project = {
            id: crypto.randomUUID(),
            name,
            path: lastPath,
            branch,
            remote,
          }
          setProject(proj)

          // Restore tabs
          const savedTabs = await window.electronAPI.storeGet<Tab[]>('tabs')
          const savedActiveId = await window.electronAPI.storeGet<string>('activeTabId')

          if (savedTabs && savedTabs.length > 0) {
            const restoredTabs: Tab[] = []

            for (const savedTab of savedTabs) {
              const isOriginal = savedTab.isOriginal || savedTab.branch === branch
              let tabPath = lastPath

              if (!isOriginal) {
                try {
                  const existingBranch = await window.electronAPI.getGitBranch(savedTab.path)
                  if (existingBranch === savedTab.branch) {
                    tabPath = savedTab.path
                  } else {
                    tabPath = await window.electronAPI.duplicateProject(lastPath, savedTab.branch)
                  }
                } catch {
                  try {
                    tabPath = await window.electronAPI.duplicateProject(lastPath, savedTab.branch)
                  } catch {
                    // Skip tabs we cannot restore.
                    continue
                  }
                }
              }

              restoredTabs.push({
                ...savedTab,
                projectId: proj.id,
                path: tabPath,
                isOriginal,
              })
            }

            if (restoredTabs.length > 0) {
              setTabs(restoredTabs)
              if (savedActiveId && restoredTabs.some((t) => t.id === savedActiveId)) {
                setActiveTab(savedActiveId)
              } else {
                setActiveTab(restoredTabs[0]!.id)
              }
            } else {
              addTab({
                id: crypto.randomUUID(),
                projectId: proj.id,
                name: branch,
                branch,
                cliType: 'codex',
                path: lastPath,
                isOriginal: true,
              })
            }
          } else {
            // Create default tab
            addTab({
              id: crypto.randomUUID(),
              projectId: proj.id,
              name: branch,
              branch,
              cliType: 'codex',
              path: lastPath,
              isOriginal: true,
            })
          }
        } catch {
          // Last project no longer accessible
        }
      }
    }
    restore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist state on change
  useEffect(() => {
    window.electronAPI.storeSet('tabs', tabs)
  }, [tabs])

  useEffect(() => {
    if (activeTabId) window.electronAPI.storeSet('activeTabId', activeTabId)
  }, [activeTabId])

  useEffect(() => {
    window.electronAPI.storeSet('appState', {
      sidebarWidth,
      gitPanelWidth,
      gitPanelOpen,
      bottomTerminalHeight,
    })
  }, [sidebarWidth, gitPanelWidth, gitPanelOpen, bottomTerminalHeight])
}

export default function App() {
  usePersistence()

  return (
    <div className="flex flex-col h-screen">
      <TitleBar />
      <div className="flex-1 overflow-hidden">
        <AppLayout
          sidebar={<LeftSidebar />}
          main={<TerminalPanel />}
          gitPanel={<RightSidebar />}
        />
      </div>
    </div>
  )
}
