import { type FormEvent, useEffect, useState } from 'react'
import { useAppStore } from '../../stores/useAppStore.ts'
import { useTabStore } from '../../stores/useTabStore.ts'
import type { Project, RecentSshProject } from '../../types/index.ts'

const RECENT_SSH_PROJECTS_KEY = 'recentSshProjects'
const MAX_RECENT_SSH_PROJECTS = 8

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

function normalizeRecentSshProjects(value: unknown): RecentSshProject[] {
  if (!Array.isArray(value)) return []

  const deduped = new Map<string, RecentSshProject>()

  for (const entry of value) {
    let host = ''
    let remotePath = ''
    let lastUsedAt = Date.now()

    if (typeof entry === 'string') {
      const parsed = parseSshProjectPath(entry)
      if (!parsed) continue
      host = parsed.host
      remotePath = parsed.remotePath
    } else if (entry && typeof entry === 'object') {
      const candidate = entry as Partial<RecentSshProject>
      host = typeof candidate.host === 'string' ? candidate.host.trim() : ''
      remotePath = typeof candidate.remotePath === 'string' ? normalizeRemotePath(candidate.remotePath) : ''
      if (typeof candidate.lastUsedAt === 'number' && Number.isFinite(candidate.lastUsedAt)) {
        lastUsedAt = candidate.lastUsedAt
      }
    }

    if (!host || !remotePath) continue

    const key = `${host}::${remotePath}`
    const existing = deduped.get(key)
    if (!existing || existing.lastUsedAt < lastUsedAt) {
      deduped.set(key, { host, remotePath, lastUsedAt })
    }
  }

  return Array.from(deduped.values())
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
    .slice(0, MAX_RECENT_SSH_PROJECTS)
}

function upsertRecentSshProject(
  recentProjects: RecentSshProject[],
  host: string,
  remotePath: string
): RecentSshProject[] {
  const normalizedHost = host.trim()
  const normalizedRemotePath = normalizeRemotePath(remotePath)
  if (!normalizedHost || !normalizedRemotePath) return recentProjects

  const now = Date.now()
  const withoutCurrent = recentProjects.filter(
    (entry) => !(entry.host === normalizedHost && entry.remotePath === normalizedRemotePath)
  )

  return [{ host: normalizedHost, remotePath: normalizedRemotePath, lastUsedAt: now }, ...withoutCurrent]
    .slice(0, MAX_RECENT_SSH_PROJECTS)
}

export default function ProjectSelector() {
  const [error, setError] = useState('')
  const [showSshForm, setShowSshForm] = useState(false)
  const [sshHost, setSshHost] = useState('')
  const [sshRemotePath, setSshRemotePath] = useState('')
  const [isConnectingSsh, setIsConnectingSsh] = useState(false)
  const [recentSshProjects, setRecentSshProjects] = useState<RecentSshProject[]>([])
  const project = useAppStore((s) => s.project)
  const setProject = useAppStore((s) => s.setProject)
  const addTab = useTabStore((s) => s.addTab)
  const tabs = useTabStore((s) => s.tabs)
  const resetTabs = useTabStore((s) => s.resetTabs)

  const openProject = async (result: { path: string; name: string }) => {
    const branch = await window.electronAPI.getGitBranch(result.path)
    const remote = await window.electronAPI.getGitRemote(result.path)

    await Promise.allSettled([
      ...tabs.map((tab) => window.electronAPI.ptyKill(tab.id)),
    ])

    resetTabs()

    const proj: Project = {
      id: crypto.randomUUID(),
      name: result.name,
      path: result.path,
      branch,
      remote,
    }

    setProject(proj)
    await window.electronAPI.storeSet('lastProjectPath', result.path)

    addTab({
      id: crypto.randomUUID(),
      projectId: proj.id,
      name: branch,
      branch,
      cliType: 'codex',
      path: result.path,
      isOriginal: true,
    })
  }

  useEffect(() => {
    let active = true

    const loadRecentSshProjects = async () => {
      const stored = await window.electronAPI.storeGet<unknown>(RECENT_SSH_PROJECTS_KEY)
      if (!active) return
      setRecentSshProjects(normalizeRecentSshProjects(stored))
    }

    void loadRecentSshProjects()

    return () => {
      active = false
    }
  }, [])

  const handleSelectLocal = async () => {
    setError('')
    try {
      const result = await window.electronAPI.selectProjectFolder()
      if (!result) return
      await openProject(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open local project')
    }
  }

  const handleSelectSsh = () => {
    setError('')
    setShowSshForm(true)
  }

  const handleCancelSsh = () => {
    setError('')
    setShowSshForm(false)
    setSshHost('')
    setSshRemotePath('')
  }

  const connectSshProject = async (host: string, remotePath: string) => {
    const normalizedHost = host.trim()
    const normalizedPath = normalizeRemotePath(remotePath)

    if (!normalizedHost || !normalizedPath) {
      setError('SSH host and remote path are required')
      return
    }

    setIsConnectingSsh(true)
    setError('')

    try {
      const result = await window.electronAPI.connectSshProject(normalizedHost, normalizedPath)
      await openProject(result)

      const parsed = parseSshProjectPath(result.path)
      const nextRecentProjects = upsertRecentSshProject(
        recentSshProjects,
        parsed?.host ?? normalizedHost,
        parsed?.remotePath ?? normalizedPath
      )

      setRecentSshProjects(nextRecentProjects)
      await window.electronAPI.storeSet(RECENT_SSH_PROJECTS_KEY, nextRecentProjects)

      setShowSshForm(false)
      setSshHost('')
      setSshRemotePath('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect SSH project')
    } finally {
      setIsConnectingSsh(false)
    }
  }

  const handleConnectSsh = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await connectSshProject(sshHost, sshRemotePath)
  }

  const handleOpenRecentSsh = async (recent: RecentSshProject) => {
    setSshHost(recent.host)
    setSshRemotePath(recent.remotePath)
    await connectSshProject(recent.host, recent.remotePath)
  }

  return (
    <div>
      <div className="w-full px-3 py-2 text-left rounded-md hover:bg-bg-hover transition-colors group">
        {project ? (
          <div>
            <div className="text-sm font-medium text-text-primary truncate">{project.name}</div>
            <div className="text-xs text-text-muted truncate">{project.path}</div>
          </div>
        ) : (
          <div className="text-sm text-text-secondary group-hover:text-text-primary">
            Select Project...
          </div>
        )}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1">
        <button
          onClick={() => void handleSelectLocal()}
          className="px-2 py-1 text-xs rounded bg-bg-tertiary border border-border text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
        >
          Local
        </button>
        <button
          onClick={handleSelectSsh}
          className="px-2 py-1 text-xs rounded bg-bg-tertiary border border-border text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
        >
          SSH
        </button>
      </div>

      {showSshForm && (
        <form className="mt-2 space-y-1.5" onSubmit={(event) => void handleConnectSsh(event)}>
          <input
            type="text"
            value={sshHost}
            onChange={(event) => setSshHost(event.target.value)}
            placeholder="user@server"
            className="w-full px-2 py-1 text-xs rounded bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            autoFocus
            disabled={isConnectingSsh}
          />
          <input
            type="text"
            value={sshRemotePath}
            onChange={(event) => setSshRemotePath(event.target.value)}
            placeholder="/absolute/remote/path"
            className="w-full px-2 py-1 text-xs rounded bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            disabled={isConnectingSsh}
          />
          <div className="grid grid-cols-2 gap-1">
            <button
              type="submit"
              disabled={isConnectingSsh}
              className="px-2 py-1 text-xs rounded bg-accent/20 border border-accent/40 text-accent hover:bg-accent/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConnectingSsh ? 'Connecting...' : 'Connect'}
            </button>
            <button
              type="button"
              onClick={handleCancelSsh}
              disabled={isConnectingSsh}
              className="px-2 py-1 text-xs rounded bg-bg-tertiary border border-border text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
          {recentSshProjects.length > 0 && (
            <div className="pt-1.5 border-t border-border">
              <div className="text-[10px] uppercase tracking-wide text-text-muted mb-1">Recent SSH</div>
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {recentSshProjects.map((recent) => (
                  <button
                    key={`${recent.host}:${recent.remotePath}`}
                    type="button"
                    onClick={() => void handleOpenRecentSsh(recent)}
                    disabled={isConnectingSsh}
                    className="w-full text-left px-2 py-1 rounded bg-bg-tertiary border border-border hover:bg-bg-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={`${recent.host}:${recent.remotePath}`}
                  >
                    <div className="text-xs text-text-primary truncate">{recent.host}</div>
                    <div className="text-[10px] text-text-muted truncate">{recent.remotePath}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      )}

      {error && (
        <div className="mt-2 text-xs text-red truncate" title={error}>
          {error}
        </div>
      )}
    </div>
  )
}
