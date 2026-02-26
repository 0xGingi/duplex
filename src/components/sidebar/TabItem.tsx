import { useTabStore } from '../../stores/useTabStore.ts'
import type { Tab } from '../../types/index.ts'

interface TabItemProps {
  tab: Tab
}

export default function TabItem({ tab }: TabItemProps) {
  const activeTabId = useTabStore((s) => s.activeTabId)
  const setActiveTab = useTabStore((s) => s.setActiveTab)
  const removeTab = useTabStore((s) => s.removeTab)
  const isActive = activeTabId === tab.id

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await window.electronAPI.ptyKill(tab.id)
    removeTab(tab.id)
  }

  const handleDeleteBranchWorkspace = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (tab.isOriginal) return

    const confirmed = window.confirm(`Delete workspace for branch "${tab.branch}"?\n\nThis removes the copied folder at:\n${tab.path}`)
    if (!confirmed) return

    await window.electronAPI.ptyKill(tab.id)
    removeTab(tab.id)

    try {
      await window.electronAPI.deleteProjectCopy(tab.path)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      window.alert(`Closed tab, but failed to delete workspace:\n${message}`)
    }
  }

  return (
    <div
      onClick={() => setActiveTab(tab.id)}
      className={`
        flex items-center gap-2 px-3 py-2 mx-2 rounded-md cursor-pointer group transition-colors
        ${isActive ? 'bg-bg-active text-text-primary' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'}
      `}
    >
      {/* CLI type indicator */}
      <div
        className={`w-2 h-2 rounded-full flex-shrink-0 ${
          tab.cliType === 'claude' ? 'bg-accent' : 'bg-green'
        }`}
      />

      {/* Branch info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{tab.branch}</div>
        <div className="text-xs text-text-muted truncate">
          {tab.cliType === 'claude' ? 'Claude Code' : 'Codex'}
          {tab.isOriginal && ' (main)'}
        </div>
      </div>

      {/* Close button */}
      <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
        {!tab.isOriginal && (
          <button
            onClick={handleDeleteBranchWorkspace}
            className="p-0.5 hover:bg-bg-hover rounded"
            title="Delete branch workspace copy"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className="text-text-muted hover:text-red">
              <path d="M4 1h4l.6 1H11v1H1V2h2.4L4 1zm-1 3h1v6H3V4zm2 0h1v6H5V4zm2 0h1v6H7V4zm2 0h1v6H9V4z" />
            </svg>
          </button>
        )}
        <button
          onClick={handleClose}
          className="p-0.5 hover:bg-bg-hover rounded"
          title="Close tab"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className="text-text-muted hover:text-text-primary">
            <path d="M2 1L6 5L10 1L11 2L7 6L11 10L10 11L6 7L2 11L1 10L5 6L1 2Z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
