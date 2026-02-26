import { useAppStore } from '../../stores/useAppStore.ts'

export default function TitleBar() {
  const project = useAppStore((s) => s.project)

  return (
    <div className="flex items-center h-10 bg-bg-secondary border-b border-border select-none"
         style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      {/* Left: App title */}
      <div className="flex items-center gap-2 px-4 min-w-[240px]">
        <span className="text-sm font-semibold text-accent">Duplex</span>
      </div>

      {/* Center: Project info */}
      <div className="flex-1 flex items-center justify-center">
        {project && (
          <span className="text-xs text-text-secondary">
            {project.name}
            <span className="text-text-muted mx-1.5">/</span>
            <span className="text-accent">{project.branch}</span>
          </span>
        )}
      </div>

      {/* Right: Window controls */}
      <div className="flex items-center" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={() => window.electronAPI.windowMinimize()}
          className="w-12 h-10 flex items-center justify-center hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
        >
          <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
            <rect width="10" height="1" />
          </svg>
        </button>
        <button
          onClick={() => window.electronAPI.windowMaximize()}
          className="w-12 h-10 flex items-center justify-center hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="0.5" y="0.5" width="9" height="9" />
          </svg>
        </button>
        <button
          onClick={() => window.electronAPI.windowClose()}
          className="w-12 h-10 flex items-center justify-center hover:bg-red/20 text-text-secondary hover:text-red transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <path d="M1 0L5 4L9 0L10 1L6 5L10 9L9 10L5 6L1 10L0 9L4 5L0 1Z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
