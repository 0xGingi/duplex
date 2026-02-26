import { useEffect, useMemo } from 'react'
import { useAppStore } from '../../stores/useAppStore.ts'
import { useTabStore } from '../../stores/useTabStore.ts'
import { cleanupTerminal, useTerminal } from './useTerminal.ts'

function getFolderName(folderPath: string): string {
  const parts = folderPath.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? folderPath
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
  const setActiveTab = useTabStore((s) => s.setActiveTab)

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? tabs[0] ?? null,
    [tabs, activeTabId]
  )

  useEffect(() => {
    if (tabs.length === 0) return
    if (!activeTabId || !tabs.some((tab) => tab.id === activeTabId)) {
      setActiveTab(tabs[0]!.id)
    }
  }, [tabs, activeTabId, setActiveTab])

  return (
    <div
      className="border-t border-border bg-bg-secondary flex flex-col"
      style={{ height: bottomTerminalHeight }}
    >
      <div className="h-9 px-2 border-b border-border flex items-center gap-1">
        <span className="text-[11px] text-text-muted px-2 whitespace-nowrap">Bottom</span>
        <div className="flex-1 min-w-0 overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTab?.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  title={tab.path}
                  className={`group flex items-center rounded border transition-colors ${
                    isActive
                      ? 'bg-bg-active border-border text-text-primary'
                      : 'bg-bg-tertiary border-border text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <span className="max-w-[180px] px-2 py-1 text-xs truncate">{tab.branch}</span>
                  <span className="text-[10px] text-text-muted pr-2">{getFolderName(tab.path)}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {activeTab ? (
        <div className="flex-1 min-h-0 relative overflow-hidden bg-[#0d0d14]">
          {tabs.map((tab) => (
            <BottomTerminalInstance
              key={tab.id}
              terminalId={`__bottom_terminal_branch__:${tab.id}`}
              cwd={tab.path}
              active={tab.id === activeTab.id}
            />
          ))}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-xs text-text-muted">
          {project ? 'No branch tabs open' : 'Select a project folder to start a terminal'}
        </div>
      )}
    </div>
  )
}
