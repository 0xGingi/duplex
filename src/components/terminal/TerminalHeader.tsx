import { useTabStore } from '../../stores/useTabStore.ts'
import { useAppStore } from '../../stores/useAppStore.ts'
import type { CliType } from '../../types/index.ts'

export default function TerminalHeader() {
  const activeTab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId))
  const updateTab = useTabStore((s) => s.updateTab)
  const toggleGitPanel = useAppStore((s) => s.toggleGitPanel)
  const gitPanelOpen = useAppStore((s) => s.gitPanelOpen)

  if (!activeTab) return null

  const handleCliChange = async (cliType: CliType) => {
    if (cliType === activeTab.cliType) return
    updateTab(activeTab.id, { cliType })

    // Kill and restart PTY with new CLI
    await window.electronAPI.ptyKill(activeTab.id)
    await window.electronAPI.ptyCreate(activeTab.id, activeTab.path, cliType)
  }

  return (
    <div className="flex items-center h-10 px-4 bg-bg-secondary border-b border-border">
      {/* Branch info */}
      <div className="flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-text-muted">
          <path d="M5 3.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm0 2.122a2.25 2.25 0 1 0-1.5 0v5.256a2.25 2.25 0 1 0 1.5 0V5.372Zm-1 7.378a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Zm7.5-9a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Zm1.5.75a2.25 2.25 0 1 0-3 2.122v5.256a2.25 2.25 0 1 0 1.5 0V6.372a2.25 2.25 0 0 0 1.5-2.122Zm-1.5 9a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
        </svg>
        <span className="text-sm font-medium text-text-primary">{activeTab.branch}</span>
        <span className="text-xs text-text-muted">{activeTab.path}</span>
      </div>

      <div className="flex-1" />

      {/* CLI type selector */}
      <div className="flex items-center gap-1 mr-2">
        <button
          onClick={() => handleCliChange('claude')}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            activeTab.cliType === 'claude'
              ? 'bg-accent/20 text-accent'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          Claude
        </button>
        <button
          onClick={() => handleCliChange('codex')}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            activeTab.cliType === 'codex'
              ? 'bg-green/20 text-green'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          Codex
        </button>
      </div>

      {/* Toggle git panel */}
      <button
        onClick={toggleGitPanel}
        className={`p-1.5 rounded transition-colors ${
          gitPanelOpen ? 'text-accent bg-accent/10' : 'text-text-muted hover:text-text-secondary'
        }`}
        title="Toggle Git Panel"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M1.5 1.75V13.5h13.05a.75.75 0 0 1 0 1.5H.75a.75.75 0 0 1-.75-.75V1.75a.75.75 0 0 1 1.5 0Zm14.28 2.53-5.25 5.25a.75.75 0 0 1-1.06 0L7 7.06 4.28 9.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.25-3.25a.75.75 0 0 1 1.06 0L10 7.94l4.72-4.72a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z" />
        </svg>
      </button>
    </div>
  )
}
