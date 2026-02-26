import { useEffect, useMemo } from 'react'
import { useAppStore } from '../../stores/useAppStore.ts'
import { useTabStore } from '../../stores/useTabStore.ts'
import { cleanupTerminal, useTerminal } from './useTerminal.ts'

function getFolderName(folderPath: string): string {
  const parts = folderPath.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? folderPath
}

function BottomTerminalInstance({ cwd }: { cwd: string }) {
  const terminalId = useMemo(() => `__bottom_terminal__:${cwd}`, [cwd])
  const { containerRef } = useTerminal({
    tabId: terminalId,
    cwd,
    active: true,
  })

  useEffect(() => {
    return () => cleanupTerminal(terminalId)
  }, [terminalId])

  return <div ref={containerRef} className="flex-1 overflow-hidden bg-[#0d0d14]" />
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

  const cwd = activeTab?.path ?? project?.path ?? ''
  const folderLabel = cwd ? getFolderName(cwd) : 'No folder selected'

  return (
    <div
      className="border-t border-border bg-bg-secondary flex flex-col"
      style={{ height: bottomTerminalHeight }}
    >
      <div className="h-9 px-3 border-b border-border flex items-center gap-2">
        <span className="text-xs text-text-muted truncate min-w-0">
          Bottom Terminal: <span className="text-text-secondary">{folderLabel}</span>
        </span>
      </div>

      {cwd ? (
        <BottomTerminalInstance cwd={cwd} />
      ) : (
        <div className="flex-1 flex items-center justify-center text-xs text-text-muted">
          Select a project folder to start the bottom terminal
        </div>
      )}
    </div>
  )
}
