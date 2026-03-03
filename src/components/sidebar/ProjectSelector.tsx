import { type FormEvent, useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_CLI_TYPE,
  getCliOptions,
  getCliSelectActiveClass,
  getCliTabLabel,
  normalizeCliType,
  toCustomCliType,
} from '../../lib/cli-tools.ts'
import { useAppStore } from '../../stores/useAppStore.ts'
import { useTabStore } from '../../stores/useTabStore.ts'
import { useGitStore } from '../../stores/useGitStore.ts'
import type { CliType, Project, RecentSshProject } from '../../types/index.ts'

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
  const [showCliSettings, setShowCliSettings] = useState(false)
  const [sshHost, setSshHost] = useState('')
  const [sshRemotePath, setSshRemotePath] = useState('')
  const [isConnectingSsh, setIsConnectingSsh] = useState(false)
  const [recentSshProjects, setRecentSshProjects] = useState<RecentSshProject[]>([])
  const [customCliName, setCustomCliName] = useState('')
  const [customCliCommand, setCustomCliCommand] = useState('')
  const [customCliError, setCustomCliError] = useState('')
  const [editingToolId, setEditingToolId] = useState<string | null>(null)
  const [editingToolName, setEditingToolName] = useState('')
  const [editingToolCommand, setEditingToolCommand] = useState('')
  const [editingToolError, setEditingToolError] = useState('')
  const project = useAppStore((s) => s.project)
  const setProject = useAppStore((s) => s.setProject)
  const defaultCliType = useAppStore((s) => s.defaultCliType)
  const customCliTools = useAppStore((s) => s.customCliTools)
  const setDefaultCliType = useAppStore((s) => s.setDefaultCliType)
  const setCustomCliTools = useAppStore((s) => s.setCustomCliTools)
  const addTab = useTabStore((s) => s.addTab)
  const setTabs = useTabStore((s) => s.setTabs)
  const tabs = useTabStore((s) => s.tabs)
  const resetTabs = useTabStore((s) => s.resetTabs)
  const clearGitState = useGitStore((s) => s.clearAll)
  const cliOptions = useMemo(() => getCliOptions(customCliTools), [customCliTools])

  const openProject = async (result: { path: string; name: string }) => {
    const branch = await window.electronAPI.getGitBranch(result.path)
    if (!branch || branch === 'unknown') {
      throw new Error('Selected path is not a git repository')
    }
    const remote = await window.electronAPI.getGitRemote(result.path)

    await Promise.allSettled([
      ...tabs.map((tab) => window.electronAPI.ptyKill(tab.id)),
    ])

    clearGitState()
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
      cliType: normalizeCliType(defaultCliType, customCliTools, DEFAULT_CLI_TYPE),
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

  const handleDefaultCliChange = (nextCliType: CliType) => {
    setDefaultCliType(normalizeCliType(nextCliType, customCliTools, DEFAULT_CLI_TYPE))
  }

  const handleAddCustomCliTool = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCustomCliError('')

    const name = customCliName.trim()
    const command = customCliCommand.trim()

    if (!name) {
      setCustomCliError('Tool name is required')
      return
    }
    if (!command) {
      setCustomCliError('Command is required')
      return
    }
    if (cliOptions.some((option) => option.name.toLowerCase() === name.toLowerCase())) {
      setCustomCliError('Tool name already exists')
      return
    }

    try {
      const availability = await window.electronAPI.checkCliCommand(command)
      if (!availability.ok) {
        setCustomCliError(availability.error ?? 'Command is not available on this machine')
        return
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setCustomCliError(message || 'Failed to validate command')
      return
    }

    setCustomCliTools([
      ...customCliTools,
      { id: crypto.randomUUID(), name, command },
    ])
    setCustomCliName('')
    setCustomCliCommand('')
  }

  const handleStartEditCustomCliTool = (toolId: string) => {
    const tool = customCliTools.find((entry) => entry.id === toolId)
    if (!tool) return

    setEditingToolId(tool.id)
    setEditingToolName(tool.name)
    setEditingToolCommand(tool.command)
    setEditingToolError('')
  }

  const handleCancelEditCustomCliTool = () => {
    setEditingToolId(null)
    setEditingToolName('')
    setEditingToolCommand('')
    setEditingToolError('')
  }

  const handleSaveCustomCliTool = async (toolId: string) => {
    const name = editingToolName.trim()
    const command = editingToolCommand.trim()

    if (!name) {
      setEditingToolError('Tool name is required')
      return
    }
    if (!command) {
      setEditingToolError('Command is required')
      return
    }

    const editedCliType = toCustomCliType(toolId)
    if (cliOptions.some((option) => option.id !== editedCliType && option.name.toLowerCase() === name.toLowerCase())) {
      setEditingToolError('Tool name already exists')
      return
    }

    try {
      const availability = await window.electronAPI.checkCliCommand(command)
      if (!availability.ok) {
        setEditingToolError(availability.error ?? 'Command is not available on this machine')
        return
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setEditingToolError(message || 'Failed to validate command')
      return
    }

    setCustomCliTools(customCliTools.map((tool) => (
      tool.id === toolId
        ? { ...tool, name, command }
        : tool
    )))
    handleCancelEditCustomCliTool()
  }

  const handleRemoveCustomCliTool = (toolId: string) => {
    const removedTool = customCliTools.find((tool) => tool.id === toolId)
    if (!removedTool) return

    const removedCliType = toCustomCliType(toolId)
    const nextCustomTools = customCliTools.filter((tool) => tool.id !== toolId)
    const fallbackDefault = normalizeCliType(defaultCliType, nextCustomTools, DEFAULT_CLI_TYPE)
    const affectedTabs = tabs.filter((tab) => tab.cliType === removedCliType)

    if (affectedTabs.length > 0) {
      const fallbackLabel = getCliTabLabel(fallbackDefault, nextCustomTools)
      const tabPreview = affectedTabs
        .slice(0, 5)
        .map((tab) => `- ${tab.branch}`)
        .join('\n')
      const extraCount = affectedTabs.length > 5 ? `\n...and ${affectedTabs.length - 5} more` : ''
      const defaultNote = defaultCliType === removedCliType
        ? `\nYour default CLI will also switch to "${fallbackLabel}".`
        : ''
      const confirmed = window.confirm(
        `"${removedTool.name}" is used by ${affectedTabs.length} open tab(s).\n\n` +
        `Those tabs will switch to "${fallbackLabel}".${defaultNote}\n\n` +
        `${tabPreview}${extraCount}\n\n` +
        'Remove this tool?'
      )
      if (!confirmed) return
    }

    setCustomCliTools(nextCustomTools)
    if (defaultCliType !== fallbackDefault) {
      setDefaultCliType(fallbackDefault)
    }

    const nextTabs = tabs.map((tab) =>
      tab.cliType === removedCliType
        ? { ...tab, cliType: fallbackDefault }
        : tab
    )
    if (nextTabs.some((tab, index) => tab !== tabs[index])) {
      setTabs(nextTabs)
    }

    if (editingToolId === toolId) {
      handleCancelEditCustomCliTool()
    }
  }

  useEffect(() => {
    if (!editingToolId) return
    if (customCliTools.some((tool) => tool.id === editingToolId)) return
    setEditingToolId(null)
    setEditingToolName('')
    setEditingToolCommand('')
    setEditingToolError('')
  }, [editingToolId, customCliTools])

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

      <div className="mt-2">
        <button
          onClick={() => setShowCliSettings((open) => !open)}
          className="w-full px-2 py-1 text-xs rounded bg-bg-tertiary border border-border text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors text-left"
        >
          CLI Settings
        </button>
      </div>

      {showCliSettings && (
        <div className="mt-2 p-2 rounded bg-bg-tertiary border border-border space-y-2">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-text-muted mb-1">Default CLI</div>
            <select
              value={normalizeCliType(defaultCliType, customCliTools, DEFAULT_CLI_TYPE)}
              onChange={(event) => handleDefaultCliChange(event.target.value as CliType)}
              className={`w-full px-2 py-1 text-xs rounded bg-bg-primary border focus:outline-none ${getCliSelectActiveClass(
                normalizeCliType(defaultCliType, customCliTools, DEFAULT_CLI_TYPE)
              )}`}
            >
              {cliOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>

          <form className="space-y-1.5" onSubmit={(event) => void handleAddCustomCliTool(event)}>
            <div className="text-[10px] uppercase tracking-wide text-text-muted">Add Custom CLI</div>
            <input
              type="text"
              value={customCliName}
              onChange={(event) => setCustomCliName(event.target.value)}
              placeholder="Display name"
              className="w-full px-2 py-1 text-xs rounded bg-bg-primary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
            <input
              type="text"
              value={customCliCommand}
              onChange={(event) => setCustomCliCommand(event.target.value)}
              placeholder="Command (for example: mycli)"
              className="w-full px-2 py-1 text-xs rounded bg-bg-primary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
            <button
              type="submit"
              className="w-full px-2 py-1 text-xs rounded bg-accent/20 border border-accent/40 text-accent hover:bg-accent/30 transition-colors"
            >
              Add Tool
            </button>
          </form>

          {customCliTools.length > 0 && (
            <div className="pt-1.5 border-t border-border">
              <div className="text-[10px] uppercase tracking-wide text-text-muted mb-1">Custom Tools</div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {customCliTools.map((tool) => {
                  const isEditing = editingToolId === tool.id
                  return (
                    <div
                      key={tool.id}
                      className="px-2 py-1 rounded bg-bg-primary border border-border"
                    >
                      {isEditing ? (
                        <div className="space-y-1">
                          <input
                            type="text"
                            value={editingToolName}
                            onChange={(event) => {
                              setEditingToolName(event.target.value)
                              if (editingToolError) setEditingToolError('')
                            }}
                            placeholder="Display name"
                            className="w-full px-1.5 py-1 text-xs rounded bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                          />
                          <input
                            type="text"
                            value={editingToolCommand}
                            onChange={(event) => {
                              setEditingToolCommand(event.target.value)
                              if (editingToolError) setEditingToolError('')
                            }}
                            placeholder="Command"
                            className="w-full px-1.5 py-1 text-xs rounded bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                          />
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => void handleSaveCustomCliTool(tool.id)}
                              className="px-1.5 py-0.5 text-[10px] rounded border border-accent/40 text-accent hover:bg-accent/20 transition-colors"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEditCustomCliTool}
                              className="px-1.5 py-0.5 text-[10px] rounded border border-border text-text-secondary hover:text-text-primary transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs text-text-primary truncate">{tool.name}</div>
                            <div className="text-[10px] text-text-muted truncate">{tool.command}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleStartEditCustomCliTool(tool.id)}
                            className="px-1.5 py-0.5 text-[10px] rounded border border-border text-text-secondary hover:text-text-primary transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomCliTool(tool.id)}
                            className="px-1.5 py-0.5 text-[10px] rounded border border-red/40 text-red hover:bg-red/20 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {customCliError && (
            <div className="text-xs text-red truncate" title={customCliError}>
              {customCliError}
            </div>
          )}
          {editingToolError && (
            <div className="text-xs text-red truncate" title={editingToolError}>
              {editingToolError}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-2 text-xs text-red truncate" title={error}>
          {error}
        </div>
      )}
    </div>
  )
}
