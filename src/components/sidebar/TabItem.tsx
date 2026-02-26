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
      {!tab.isOriginal && (
        <button
          onClick={handleClose}
          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-bg-hover rounded transition-opacity"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className="text-text-muted hover:text-text-primary">
            <path d="M2 1L6 5L10 1L11 2L7 6L11 10L10 11L6 7L2 11L1 10L5 6L1 2Z" />
          </svg>
        </button>
      )}
    </div>
  )
}
