import type { ReactNode } from 'react'
import { useAppStore } from '../../stores/useAppStore.ts'
import { useCallback, useRef, useEffect } from 'react'

interface AppLayoutProps {
  sidebar: ReactNode
  main: ReactNode
  gitPanel: ReactNode
}

export default function AppLayout({ sidebar, main, gitPanel }: AppLayoutProps) {
  const sidebarWidth = useAppStore((s) => s.sidebarWidth)
  const gitPanelWidth = useAppStore((s) => s.gitPanelWidth)
  const gitPanelOpen = useAppStore((s) => s.gitPanelOpen)
  const setSidebarWidth = useAppStore((s) => s.setSidebarWidth)
  const setGitPanelWidth = useAppStore((s) => s.setGitPanelWidth)

  const dragging = useRef<'sidebar' | 'gitPanel' | null>(null)

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (dragging.current === 'sidebar') {
        setSidebarWidth(Math.max(180, Math.min(400, e.clientX)))
      } else if (dragging.current === 'gitPanel') {
        setGitPanelWidth(Math.max(240, Math.min(600, window.innerWidth - e.clientX)))
      }
    },
    [setSidebarWidth, setGitPanelWidth]
  )

  const onMouseUp = useCallback(() => {
    dragging.current = null
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

  const startDrag = (panel: 'sidebar' | 'gitPanel') => {
    dragging.current = panel
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left sidebar */}
      <div
        className="flex-shrink-0 bg-bg-secondary border-r border-border overflow-y-auto"
        style={{ width: sidebarWidth }}
      >
        {sidebar}
      </div>

      {/* Sidebar resize handle */}
      <div
        className="w-1 cursor-col-resize hover:bg-accent/30 active:bg-accent/50 flex-shrink-0 transition-colors"
        onMouseDown={() => startDrag('sidebar')}
      />

      {/* Center panel */}
      <div className="flex-1 min-w-0 overflow-hidden">{main}</div>

      {/* Git panel resize handle */}
      {gitPanelOpen && (
        <div
          className="w-1 cursor-col-resize hover:bg-accent/30 active:bg-accent/50 flex-shrink-0 transition-colors"
          onMouseDown={() => startDrag('gitPanel')}
        />
      )}

      {/* Right git panel */}
      {gitPanelOpen && (
        <div
          className="flex-shrink-0 bg-bg-secondary border-l border-border overflow-y-auto"
          style={{ width: gitPanelWidth }}
        >
          {gitPanel}
        </div>
      )}
    </div>
  )
}
