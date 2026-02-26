import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../../stores/useAppStore.ts'
import { useTabStore } from '../../stores/useTabStore.ts'
import { cleanupTerminal, useTerminal } from './useTerminal.ts'

function getFolderName(folderPath: string): string {
  const parts = folderPath.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? folderPath
}

interface BottomTerminalTab {
  id: string
  cwd: string
}

function createBottomTerminalTab(cwd: string): BottomTerminalTab {
  return {
    id: crypto.randomUUID(),
    cwd,
  }
}

function BottomTerminalInstance({ terminalId, cwd, active }: {
  terminalId: string
  cwd: string
  active: boolean
}) {
  const { containerRef } = useTerminal({
    tabId: terminalId,
    cwd,
    active,
  })

  useEffect(() => {
    return () => cleanupTerminal(terminalId)
  }, [terminalId])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden bg-[#0d0d14]"
      style={{ display: active ? 'block' : 'none' }}
    />
  )
}

export default function TerminalLauncherBar() {
  const project = useAppStore((s) => s.project)
  const bottomTerminalHeight = useAppStore((s) => s.bottomTerminalHeight)
  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId),
    [tabs, activeTabId]
  )

  const [bottomTabs, setBottomTabs] = useState<BottomTerminalTab[]>([])
  const [activeBottomTabId, setActiveBottomTabId] = useState<string | null>(null)

  const cwd = activeTab?.path ?? project?.path ?? ''

  useEffect(() => {
    if (!project?.path) {
      setBottomTabs([])
      setActiveBottomTabId(null)
      return
    }

    const initialTab = createBottomTerminalTab(project.path)
    setBottomTabs([initialTab])
    setActiveBottomTabId(initialTab.id)
  }, [project?.path])

  useEffect(() => {
    if (activeBottomTabId && bottomTabs.some((tab) => tab.id === activeBottomTabId)) return
    setActiveBottomTabId(bottomTabs[0]?.id ?? null)
  }, [bottomTabs, activeBottomTabId])

  const activeBottomTab = useMemo(
    () => bottomTabs.find((tab) => tab.id === activeBottomTabId) ?? null,
    [bottomTabs, activeBottomTabId]
  )

  const handleAddBottomTab = () => {
    const nextCwd = cwd || project?.path || ''
    if (!nextCwd) return

    const nextTab = createBottomTerminalTab(nextCwd)
    setBottomTabs((prev) => [...prev, nextTab])
    setActiveBottomTabId(nextTab.id)
  }

  const handleCloseBottomTab = (tabId: string) => {
    setBottomTabs((prev) => {
      const index = prev.findIndex((tab) => tab.id === tabId)
      if (index < 0) return prev

      const nextTabs = prev.filter((tab) => tab.id !== tabId)
      setActiveBottomTabId((current) => {
        if (current !== tabId) {
          return current && nextTabs.some((tab) => tab.id === current) ? current : (nextTabs[0]?.id ?? null)
        }
        const fallback = nextTabs[index] ?? nextTabs[index - 1] ?? nextTabs[0]
        return fallback?.id ?? null
      })

      return nextTabs
    })
  }

  return (
    <div
      className="border-t border-border bg-bg-secondary flex flex-col"
      style={{ height: bottomTerminalHeight }}
    >
      <div className="h-9 px-2 border-b border-border flex items-center gap-1">
        <span className="text-[11px] text-text-muted px-2 whitespace-nowrap">Bottom</span>
        <div className="flex-1 min-w-0 overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max">
            {bottomTabs.map((tab) => {
              const isActive = tab.id === activeBottomTabId
              const folderLabel = getFolderName(tab.cwd)
              return (
                <div
                  key={tab.id}
                  className={`group flex items-center rounded border transition-colors ${
                    isActive
                      ? 'bg-bg-active border-border text-text-primary'
                      : 'bg-bg-tertiary border-border text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <button
                    onClick={() => setActiveBottomTabId(tab.id)}
                    className="max-w-[180px] px-2 py-1 text-xs truncate"
                    title={tab.cwd}
                  >
                    {folderLabel}
                  </button>
                  {bottomTabs.length > 1 && (
                    <button
                      onClick={() => handleCloseBottomTab(tab.id)}
                      className="px-1.5 py-1 text-[11px] text-text-muted hover:text-text-primary"
                      title="Close terminal tab"
                    >
                      x
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        <button
          onClick={handleAddBottomTab}
          className="px-2 py-1 text-xs rounded border border-border bg-bg-tertiary text-text-secondary hover:text-text-primary"
          title={cwd ? `New terminal tab in ${cwd}` : 'Select a project folder first'}
          disabled={!cwd}
        >
          +
        </button>
      </div>

      {activeBottomTab ? (
        <div className="flex-1 min-h-0 relative overflow-hidden bg-[#0d0d14]">
          {bottomTabs.map((tab) => (
            <BottomTerminalInstance
              key={tab.id}
              terminalId={`__bottom_terminal_tab__:${tab.id}`}
              cwd={tab.cwd}
              active={tab.id === activeBottomTab.id}
            />
          ))}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-xs text-text-muted">
          Select a project folder to start a terminal
        </div>
      )}
    </div>
  )
}
