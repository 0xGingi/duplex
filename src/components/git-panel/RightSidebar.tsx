import { useEffect, useState } from 'react'
import { useTabStore } from '../../stores/useTabStore.ts'
import { useGitStore } from '../../stores/useGitStore.ts'
import { useGitStatus } from './useGitStatus.ts'
import ChangedFileList from './ChangedFileList.tsx'
import DiffViewer from './DiffViewer.tsx'

function formatActionError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  return raw.replace(/^Error invoking remote method '[^']+': Error:\s*/, '').trim()
}

export default function RightSidebar() {
  useGitStatus()

  const activeTabId = useTabStore((s) => s.activeTabId)
  const activeTab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId))
  const status = useGitStore((s) => (activeTabId ? s.statusByTab[activeTabId] : undefined))
  const selectedFile = useGitStore((s) => s.selectedFile)
  const setStatus = useGitStore((s) => s.setStatus)
  const setSelectedFile = useGitStore((s) => s.setSelectedFile)
  const setDiffContent = useGitStore((s) => s.setDiffContent)
  const [commitMessage, setCommitMessage] = useState('')
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const [actionInfo, setActionInfo] = useState('')

  useEffect(() => {
    if (selectedFile && selectedFile.tabId !== activeTab?.id) {
      setSelectedFile(null)
      setDiffContent(null)
    }
  }, [selectedFile, activeTab?.id, setSelectedFile, setDiffContent])

  if (!activeTab) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-text-muted">
        No active tab
      </div>
    )
  }

  const changes = status?.changes ?? []
  const stagedCount = changes.filter((c) => c.staged).length
  const unstagedCount = changes.filter((c) => !c.staged).length

  const refreshStatus = async () => {
    try {
      const nextStatus = await window.electronAPI.getGitStatus(activeTab.path)
      setStatus(activeTab.id, nextStatus)
    } catch {
      // Ignore refresh failures
    }
  }

  const runAction = async (
    actionKey: string,
    onRun: () => Promise<void>,
    successMessage: string,
    clearSelection = false
  ) => {
    setBusyAction(actionKey)
    setActionError('')
    setActionInfo('')
    try {
      await onRun()
      if (clearSelection) {
        setSelectedFile(null)
        setDiffContent(null)
      }
      await refreshStatus()
      setActionInfo(successMessage)
    } catch (error) {
      setActionError(formatActionError(error) || 'Git action failed')
    } finally {
      setBusyAction(null)
    }
  }

  const handleCommit = async () => {
    const message = commitMessage.trim()
    if (!message) return

    await runAction(
      'commit',
      () => window.electronAPI.commit(activeTab.path, message),
      'Committed changes',
      true
    )
    setCommitMessage('')
  }

  const handleAmendCommit = async () => {
    const message = commitMessage.trim()
    await runAction(
      'amend',
      () => window.electronAPI.amendCommit(activeTab.path, message || undefined),
      'Amended last commit',
      true
    )
    setCommitMessage('')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">Changes</h3>
          <div className="flex items-center gap-2 text-xs text-text-muted">
            {status && (
              <>
                {stagedCount > 0 && (
                  <span className="text-green">{stagedCount} staged</span>
                )}
                {unstagedCount > 0 && (
                  <span>{unstagedCount} modified</span>
                )}
              </>
            )}
          </div>
        </div>
        {status && (
          <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
            <span>{status.branch}</span>
            {status.ahead > 0 && <span className="text-green">&uarr;{status.ahead}</span>}
            {status.behind > 0 && <span className="text-yellow">&darr;{status.behind}</span>}
          </div>
        )}
      </div>

      {/* File list */}
      <div className={`overflow-y-auto ${selectedFile ? 'max-h-[40%]' : 'flex-1'} border-b border-border`}>
        <div className="px-3 py-2 border-b border-border bg-bg-tertiary/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Unstaged</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  void runAction(
                    'stage-all',
                    () => window.electronAPI.stageAll(activeTab.path),
                    'Staged all changes',
                    true
                  )
                }
                disabled={unstagedCount === 0 || busyAction !== null}
                className="text-[10px] px-2 py-0.5 rounded border border-green/30 text-green disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Stage All
              </button>
              <button
                onClick={() =>
                  void runAction(
                    'discard-all',
                    () => window.electronAPI.discardAll(activeTab.path),
                    'Discarded unstaged changes',
                    true
                  )
                }
                disabled={unstagedCount === 0 || busyAction !== null}
                className="text-[10px] px-2 py-0.5 rounded border border-red/30 text-red disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Discard All
              </button>
            </div>
          </div>
        </div>
        <ChangedFileList
          tabId={activeTab.id}
          changes={changes}
          tabPath={activeTab.path}
          staged={false}
          onStatusChange={refreshStatus}
          onError={(message) => setActionError(formatActionError(message))}
        />

        <div className="px-3 py-2 border-y border-border bg-bg-tertiary/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Staged</span>
            <button
              onClick={() =>
                void runAction(
                  'unstage-all',
                  () => window.electronAPI.unstageAll(activeTab.path),
                  'Unstaged all changes',
                  true
                )
              }
              disabled={stagedCount === 0 || busyAction !== null}
              className="text-[10px] px-2 py-0.5 rounded border border-yellow/30 text-yellow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Unstage All
            </button>
          </div>
        </div>
        <ChangedFileList
          tabId={activeTab.id}
          changes={changes}
          tabPath={activeTab.path}
          staged={true}
          onStatusChange={refreshStatus}
          onError={(message) => setActionError(formatActionError(message))}
        />

        <div className="px-3 py-3 border-t border-border bg-bg-tertiary/30">
          <textarea
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Commit message"
            rows={2}
            className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => void handleCommit()}
              disabled={stagedCount === 0 || !commitMessage.trim() || busyAction !== null}
              className="flex-1 px-2 py-1.5 rounded text-xs font-medium bg-accent text-white hover:bg-accent-dim disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Commit
            </button>
            <button
              onClick={() => void handleAmendCommit()}
              disabled={stagedCount === 0 || busyAction !== null}
              className="flex-1 px-2 py-1.5 rounded text-xs font-medium bg-yellow/20 border border-yellow/40 text-yellow hover:bg-yellow/30 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Amend last commit (uses message box if provided)"
            >
              Amend
            </button>
            <button
              onClick={() =>
                void runAction(
                  'push',
                  () => window.electronAPI.push(activeTab.path),
                  'Pushed branch'
                )
              }
              disabled={busyAction !== null}
              className="flex-1 px-2 py-1.5 rounded text-xs font-medium bg-bg-primary border border-border text-text-primary hover:bg-bg-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Push
            </button>
            <button
              onClick={() =>
                void runAction(
                  'publish',
                  () => window.electronAPI.publishBranch(activeTab.path),
                  'Published branch upstream'
                )
              }
              disabled={busyAction !== null}
              className="flex-1 px-2 py-1.5 rounded text-xs font-medium bg-green/20 border border-green/40 text-green hover:bg-green/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Publish
            </button>
          </div>
          {(actionError || actionInfo) && (
            <div className={`mt-2 text-xs ${actionError ? 'text-red' : 'text-green'}`}>
              {actionError || actionInfo}
            </div>
          )}
        </div>
      </div>

      {selectedFile && (
        <div className="flex-1 overflow-y-auto">
          <DiffViewer />
        </div>
      )}
    </div>
  )
}
