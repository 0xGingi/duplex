import { useEffect, useState } from 'react'
import TitleBar from './components/layout/TitleBar.tsx'
import AppLayout from './components/layout/AppLayout.tsx'
import LeftSidebar from './components/sidebar/LeftSidebar.tsx'
import TerminalPanel from './components/terminal/TerminalPanel.tsx'
import RightSidebar from './components/git-panel/RightSidebar.tsx'
import { useAppStore } from './stores/useAppStore.ts'
import { useTabStore } from './stores/useTabStore.ts'
import type { Project, Tab, AppState } from './types/index.ts'

function getLeafName(value: string): string {
  const parts = value.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? value
}

function normalizeRemotePath(inputPath: string): string {
  const trimmed = inputPath.trim().replace(/\\/g, '/')
  if (!trimmed) return ''
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  const normalized = withLeadingSlash.replace(/\/+/g, '/')
  return normalized === '/' ? normalized : normalized.replace(/\/+$/, '')
}

function parseSshProjectPath(projectPath: string): { host: string; remotePath: string } | null {
  if (!projectPath.startsWith('ssh://')) return null

  const raw = projectPath.slice('ssh://'.length)
  if (!raw) return null

  const marker = raw.indexOf(':/')
  if (marker >= 0) {
    const host = raw.slice(0, marker).trim()
    const remotePath = normalizeRemotePath(raw.slice(marker + 1))
    if (!host || !remotePath) return null
    return { host, remotePath }
  }

  const slash = raw.indexOf('/')
  if (slash <= 0) return null
  const host = raw.slice(0, slash).trim()
  const remotePath = normalizeRemotePath(raw.slice(slash))
  if (!host || !remotePath) return null
  return { host, remotePath }
}

function usePersistence() {
  const [hasRestored, setHasRestored] = useState(false)
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
      try {
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
            let projectPath = lastPath
            let projectName = getLeafName(lastPath)

            const sshTarget = parseSshProjectPath(lastPath)
            if (sshTarget) {
              const sshProject = await window.electronAPI.connectSshProject(sshTarget.host, sshTarget.remotePath)
              projectPath = sshProject.path
              projectName = sshProject.name
              if (projectPath !== lastPath) {
                await window.electronAPI.storeSet('lastProjectPath', projectPath)
              }
            }

            const branch = await window.electronAPI.getGitBranch(projectPath)
            if (!branch || branch === 'unknown') {
              await window.electronAPI.storeSet('lastProjectPath', undefined)
              return
            }
            const remote = await window.electronAPI.getGitRemote(projectPath)

            const proj: Project = {
              id: crypto.randomUUID(),
              name: projectName,
              path: projectPath,
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
                let tabPath = projectPath

                if (!isOriginal) {
                  try {
                    const existingBranch = await window.electronAPI.getGitBranch(savedTab.path)
                    if (existingBranch === savedTab.branch) {
                      tabPath = savedTab.path
                    } else {
                      tabPath = await window.electronAPI.duplicateProject(projectPath, savedTab.branch)
                    }
                  } catch {
                    try {
                      tabPath = await window.electronAPI.duplicateProject(projectPath, savedTab.branch)
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
                  path: projectPath,
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
                path: projectPath,
                isOriginal: true,
              })
            }
          } catch {
            // Last project no longer accessible
          }
        }
      } finally {
        setHasRestored(true)
      }
    }
    restore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist state on change
  useEffect(() => {
    if (!hasRestored) return
    window.electronAPI.storeSet('tabs', tabs)
  }, [tabs, hasRestored])

  useEffect(() => {
    if (!hasRestored) return
    window.electronAPI.storeSet('activeTabId', activeTabId ?? undefined)
  }, [activeTabId, hasRestored])

  useEffect(() => {
    if (!hasRestored) return
    window.electronAPI.storeSet('appState', {
      sidebarWidth,
      gitPanelWidth,
      gitPanelOpen,
      bottomTerminalHeight,
    })
  }, [sidebarWidth, gitPanelWidth, gitPanelOpen, bottomTerminalHeight, hasRestored])
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
