import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../../stores/useAppStore.ts'
import { useTabStore } from '../../stores/useTabStore.ts'
import type { CliType } from '../../types/index.ts'

function formatActionError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  return raw.replace(/^Error invoking remote method '[^']+': Error:\s*/, '').trim()
}

export default function NewTabButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [branchName, setBranchName] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [branches, setBranches] = useState<string[]>([])
  const [cliType, setCliType] = useState<CliType>('codex')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const project = useAppStore((s) => s.project)
  const addTab = useTabStore((s) => s.addTab)
  const tabs = useTabStore((s) => s.tabs)
  const setActiveTab = useTabStore((s) => s.setActiveTab)

  const openTabBranches = useMemo(
    () => new Set(tabs.filter((tab) => !project || tab.projectId === project.id).map((tab) => tab.branch)),
    [tabs, project]
  )

  useEffect(() => {
    if (!isOpen || !project) return

    void Promise.allSettled([
      window.electronAPI.getGitBranches(project.path),
      window.electronAPI.listProjectCopies(project.path),
    ])
      .then(([gitResult, copiedResult]) => {
        const gitBranches = gitResult.status === 'fulfilled' ? gitResult.value : []
        const copiedBranches = copiedResult.status === 'fulfilled' ? copiedResult.value : []
        const merged = [...new Set([...gitBranches, ...copiedBranches])]
        merged.sort((a, b) => a.localeCompare(b))
        setBranches(merged)
      })
  }, [isOpen, project])

  const openBranchTab = async (branch: string, cli: CliType) => {
    if (!project || !branch) return

    setLoading(true)
    setError('')

    try {
      const existingTab = tabs.find((tab) => tab.projectId === project.id && tab.branch === branch)
      if (existingTab) {
        setActiveTab(existingTab.id)
        setIsOpen(false)
        return
      }

      const isMainBranch = branch === project.branch
      const destPath = isMainBranch
        ? project.path
        : await window.electronAPI.duplicateProject(project.path, branch)

      addTab({
        id: crypto.randomUUID(),
        projectId: project.id,
        name: branch,
        branch,
        cliType: cli,
        path: destPath,
        isOriginal: isMainBranch,
      })

      setBranchName('')
      setSelectedBranch('')
      setIsOpen(false)
    } catch (err) {
      setError(formatActionError(err) || 'Failed to create branch')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    const sanitized = branchName.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-_./]/g, '')
    if (!sanitized) return
    await openBranchTab(sanitized, cliType)
  }

  const handleOpenSelected = async () => {
    if (!selectedBranch) return
    await openBranchTab(selectedBranch, cliType)
  }

  if (!project) return null

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center gap-2 px-3 py-2 mx-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors text-sm"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        </svg>
        New Branch
      </button>
    )
  }

  return (
    <div className="mx-2 p-3 rounded-md bg-bg-tertiary border border-border">
      <input
        autoFocus
        value={branchName}
        onChange={(e) => setBranchName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleCreate()
          if (e.key === 'Escape') setIsOpen(false)
        }}
        placeholder="Branch name..."
        className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
      />

      <div className="mt-2">
        <select
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
          className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded text-sm text-text-primary focus:outline-none focus:border-accent"
        >
          <option value="">Open existing branch...</option>
          {branches.map((branch) => (
            <option key={branch} value={branch}>
              {branch}
              {openTabBranches.has(branch) ? ' (open)' : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-1 mt-2">
        <button
          onClick={() => setCliType('claude')}
          className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
            cliType === 'claude'
              ? 'bg-accent/20 text-accent border border-accent/40'
              : 'bg-bg-primary text-text-secondary border border-border hover:border-border'
          }`}
        >
          Claude
        </button>
        <button
          onClick={() => setCliType('codex')}
          className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
            cliType === 'codex'
              ? 'bg-green/20 text-green border border-green/40'
              : 'bg-bg-primary text-text-secondary border border-border hover:border-border'
          }`}
        >
          Codex
        </button>
      </div>

      {error && <div className="text-xs text-red mt-2">{error}</div>}

      <div className="flex gap-2 mt-2">
        <button
          onClick={() => void handleOpenSelected()}
          disabled={loading || !selectedBranch}
          className="flex-1 px-2 py-1.5 rounded text-xs font-medium bg-green text-black hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Opening...' : 'Open'}
        </button>
        <button
          onClick={() => setIsOpen(false)}
          className="flex-1 px-2 py-1.5 rounded text-xs text-text-secondary hover:text-text-primary bg-bg-primary border border-border transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleCreate}
          disabled={loading || !branchName.trim()}
          className="flex-1 px-2 py-1.5 rounded text-xs font-medium bg-accent text-white hover:bg-accent-dim disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Creating...' : 'Create'}
        </button>
      </div>
    </div>
  )
}
