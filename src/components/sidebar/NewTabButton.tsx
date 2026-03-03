import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../../stores/useAppStore.ts'
import { useTabStore } from '../../stores/useTabStore.ts'
import type { CliType, Project } from '../../types/index.ts'

function formatActionError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  return raw.replace(/^Error invoking remote method '[^']+': Error:\s*/, '').trim()
}

function normalizeRemotePath(inputPath: string): string {
  const trimmed = inputPath.trim().replace(/\\/g, '/')
  if (!trimmed) return ''
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  const normalized = withLeadingSlash.replace(/\/+/g, '/')
  return normalized === '/' ? normalized : normalized.replace(/\/+$/, '')
}

function parseSshProjectPath(projectPath: string): { host: string; remotePath: string } | null {
  if (!projectPath.startsWith('ssh://')) return null

  const raw = projectPath.slice('ssh://'.length)
  if (!raw) return null

  const marker = raw.indexOf(':/')
  if (marker >= 0) {
    const host = raw.slice(0, marker).trim()
    const remotePath = normalizeRemotePath(raw.slice(marker + 1))
    if (!host || !remotePath) return null
    return { host, remotePath }
  }

  const slash = raw.indexOf('/')
  if (slash <= 0) return null
  const host = raw.slice(0, slash).trim()
  const remotePath = normalizeRemotePath(raw.slice(slash))
  if (!host || !remotePath) return null
  return { host, remotePath }
}

export default function NewTabButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [branchName, setBranchName] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [branches, setBranches] = useState<string[]>([])
  const [branchesLoading, setBranchesLoading] = useState(false)
  const [branchLoadError, setBranchLoadError] = useState('')
  const [cliType, setCliType] = useState<CliType>('codex')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const project = useAppStore((s) => s.project)
  const setProject = useAppStore((s) => s.setProject)
  const addTab = useTabStore((s) => s.addTab)
  const tabs = useTabStore((s) => s.tabs)
  const setActiveTab = useTabStore((s) => s.setActiveTab)

  const openTabBranches = useMemo(
    () => new Set(tabs.filter((tab) => !project || tab.projectId === project.id).map((tab) => tab.branch)),
    [tabs, project]
  )

  const loadRequestRef = useRef(0)

  const fetchBranches = useCallback(async (targetPath: string): Promise<string[]> => {
    const [gitResult, copiedResult] = await Promise.allSettled([
      window.electronAPI.getGitBranches(targetPath),
      window.electronAPI.listProjectCopies(targetPath),
    ])
    const gitBranches = gitResult.status === 'fulfilled' ? gitResult.value : []
    const copiedBranches = copiedResult.status === 'fulfilled' ? copiedResult.value : []
    const merged = [...new Set([...gitBranches, ...copiedBranches])]
    merged.sort((a, b) => a.localeCompare(b))
    return merged
  }, [])

  const loadBranches = useCallback((targetProject: Project) => {
    const requestId = ++loadRequestRef.current
    setBranchesLoading(true)
    setBranchLoadError('')

    void (async () => {
      let resolvedPath = targetProject.path
      let resolvedName = targetProject.name
      let merged = await fetchBranches(resolvedPath)

      if (merged.length === 0 && resolvedPath.startsWith('ssh://')) {
        const sshTarget = parseSshProjectPath(resolvedPath)
        if (sshTarget) {
          try {
            const reconnected = await window.electronAPI.connectSshProject(sshTarget.host, sshTarget.remotePath)
            resolvedPath = reconnected.path
            resolvedName = reconnected.name
            merged = await fetchBranches(resolvedPath)
          } catch (err) {
            if (requestId !== loadRequestRef.current) return
            setBranches([])
            setBranchesLoading(false)
            setBranchLoadError(formatActionError(err) || 'Failed to load SSH branches')
            return
          }
        }
      }

      if (requestId !== loadRequestRef.current) return

      if (resolvedPath !== targetProject.path || resolvedName !== targetProject.name) {
        setProject({
          ...targetProject,
          path: resolvedPath,
          name: resolvedName,
        })
        await window.electronAPI.storeSet('lastProjectPath', resolvedPath)
      }

      setBranches(merged)
      setBranchesLoading(false)
      setBranchLoadError('')
    })()
  }, [fetchBranches, setProject])

  // Prefetch branch list as soon as project is available so the dropdown is ready.
  useEffect(() => {
    if (!project) {
      setBranches([])
      setBranchesLoading(false)
      setBranchLoadError('')
      return
    }
    loadBranches(project)
  }, [project?.id, project?.path, project?.name, loadBranches])

  // Refresh when opening the New Branch UI in case the remote changed.
  useEffect(() => {
    if (!isOpen || !project) return
    loadBranches(project)
  }, [isOpen, project?.id, project?.path, project?.name, loadBranches])

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
          disabled={branchesLoading}
          className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded text-sm text-text-primary focus:outline-none focus:border-accent"
        >
          <option value="" disabled={branchesLoading || branches.length === 0}>
            {branchesLoading
              ? 'Loading branches...'
              : branches.length === 0
                ? 'No existing branches found'
                : 'Open existing branch...'}
          </option>
          {branches.map((branch) => (
            <option key={branch} value={branch}>
              {branch}
              {openTabBranches.has(branch) ? ' (open)' : ''}
            </option>
          ))}
        </select>
        {branchLoadError && (
          <div className="text-[11px] text-red mt-1">{branchLoadError}</div>
        )}
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
