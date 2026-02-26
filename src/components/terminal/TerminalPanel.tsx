import { useCallback, useEffect, useRef } from 'react'
import { useTabStore } from '../../stores/useTabStore.ts'
import { useAppStore } from '../../stores/useAppStore.ts'
import { useTerminal } from './useTerminal.ts'
import TerminalHeader from './TerminalHeader.tsx'
import TerminalLauncherBar from './TerminalLauncherBar.tsx'
import '@xterm/xterm/css/xterm.css'

function TerminalInstance({ tabId, cwd, cliType, active }: {
  tabId: string
  cwd: string
  cliType?: 'claude' | 'codex'
  active: boolean
}) {
  const { containerRef } = useTerminal({ tabId, cwd, cliType, active })

  return (
    <div
      ref={containerRef}
      className="flex-1"
      style={{ display: active ? 'block' : 'none' }}
    />
  )
}

export default function TerminalPanel() {
  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const project = useAppStore((s) => s.project)
  const setBottomTerminalHeight = useAppStore((s) => s.setBottomTerminalHeight)
  const resizingRef = useRef(false)

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!resizingRef.current) return

    const newHeight = Math.max(120, Math.min(520, window.innerHeight - e.clientY))
    setBottomTerminalHeight(newHeight)
  }, [setBottomTerminalHeight])

  const onMouseUp = useCallback(() => {
    if (!resizingRef.current) return
    resizingRef.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onMouseMove, onMouseUp])

  const startResize = () => {
    resizingRef.current = true
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }

  return (
    <div className="flex flex-col h-full">
      {tabs.length > 0 && <TerminalHeader />}

      <div className="flex-1 relative overflow-hidden bg-[#0d0d14]">
        {tabs.length === 0 ? (
          <div className="flex flex-col h-full">
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl mb-4 text-text-muted">&#x2756;</div>
                <div className="text-lg text-text-secondary mb-2">
                  {project ? 'No terminal open' : 'No project selected'}
                </div>
                <div className="text-sm text-text-muted">
                  {project ? 'Use the bottom bar to open a CLI in this folder' : 'Select a project folder to get started'}
                </div>
              </div>
            </div>
          </div>
        ) : (
          tabs.map((tab) => (
            <TerminalInstance
              key={tab.id}
              tabId={tab.id}
              cwd={tab.path}
              cliType={tab.cliType}
              active={tab.id === activeTabId}
            />
          ))
        )}
      </div>

      <div
        className="h-1 cursor-row-resize hover:bg-accent/30 active:bg-accent/50 transition-colors"
        onMouseDown={startResize}
      />

      <TerminalLauncherBar />
    </div>
  )
}
