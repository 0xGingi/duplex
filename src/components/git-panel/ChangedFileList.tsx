import type { GitFileChange } from '../../types/index.ts'
import { useGitStore } from '../../stores/useGitStore.ts'

interface ChangedFileListProps {
  changes: GitFileChange[]
  tabPath: string
  staged: boolean
  onStatusChange: () => Promise<void>
  onError?: (message: string) => void
}

const statusColors: Record<string, string> = {
  M: 'text-yellow',
  A: 'text-green',
  D: 'text-red',
  '?': 'text-text-muted',
  R: 'text-cyan',
  C: 'text-cyan',
  U: 'text-red',
}

const statusLabels: Record<string, string> = {
  M: 'Modified',
  A: 'Added',
  D: 'Deleted',
  '?': 'Untracked',
  R: 'Renamed',
  C: 'Copied',
  U: 'Unmerged',
}

export default function ChangedFileList({
  changes,
  tabPath,
  staged,
  onStatusChange,
  onError,
}: ChangedFileListProps) {
  const selectedFile = useGitStore((s) => s.selectedFile)
  const setSelectedFile = useGitStore((s) => s.setSelectedFile)
  const setDiffContent = useGitStore((s) => s.setDiffContent)

  const handleClick = async (file: string) => {
    setSelectedFile({ file, staged })
    try {
      const diff = await window.electronAPI.getFileDiff(tabPath, file, staged)
      setDiffContent(diff)
    } catch {
      setDiffContent(null)
    }
  }

  const handleToggleStage = async (file: string) => {
    try {
      if (staged) {
        await window.electronAPI.unstageFile(tabPath, file)
      } else {
        await window.electronAPI.stageFile(tabPath, file)
      }
      setSelectedFile(null)
      setDiffContent(null)
      await onStatusChange()
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Failed to update staged state')
    }
  }

  const handleDiscard = async (file: string) => {
    try {
      await window.electronAPI.discardFile(tabPath, file)
      if (selectedFile?.file === file && !selectedFile.staged) {
        setSelectedFile(null)
        setDiffContent(null)
      }
      await onStatusChange()
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Failed to discard file changes')
    }
  }

  const scopedChanges = changes.filter((change) => change.staged === staged)

  if (scopedChanges.length === 0) {
    return (
      <div className="px-3 py-4 text-center text-sm text-text-muted">
        {staged ? 'No staged changes' : 'No unstaged changes'}
      </div>
    )
  }

  // Deduplicate: show unique files with their most relevant status
  const fileMap = new Map<string, GitFileChange>()
  for (const change of scopedChanges) {
    const existing = fileMap.get(change.file)
    if (!existing || change.staged) {
      fileMap.set(change.file, change)
    }
  }

  return (
    <div className="space-y-0.5">
      {Array.from(fileMap.values()).map((change) => {
        const isSelected = selectedFile?.file === change.file && selectedFile.staged === staged
        return (
          <div
            key={`${change.file}-${change.staged}`}
            className={`w-full flex items-center gap-2 px-3 py-1.5 transition-colors ${
              isSelected ? 'bg-bg-active' : 'hover:bg-bg-hover'
            }`}
          >
            <button
              onClick={() => handleClick(change.file)}
              className="flex items-center gap-2 flex-1 min-w-0 text-left"
            >
              <span
                className={`text-xs font-mono font-bold w-4 text-center flex-shrink-0 ${
                  statusColors[change.status] || 'text-text-muted'
                }`}
                title={statusLabels[change.status]}
              >
                {change.status}
              </span>
              <span className="text-sm text-text-secondary truncate">{change.file}</span>
            </button>
            <button
              onClick={() => void handleToggleStage(change.file)}
              className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                staged
                  ? 'text-yellow border-yellow/30 hover:bg-yellow/10'
                  : 'text-green border-green/30 hover:bg-green/10'
              }`}
              title={staged ? 'Unstage file' : 'Stage file'}
            >
              {staged ? 'Unstage' : 'Stage'}
            </button>
            {!staged && (
              <button
                onClick={() => void handleDiscard(change.file)}
                className="text-[10px] px-1.5 py-0.5 rounded border transition-colors text-red border-red/30 hover:bg-red/10"
                title="Discard unstaged changes"
              >
                Discard
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
