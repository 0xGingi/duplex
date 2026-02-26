import { type FormEvent, useState } from 'react'
import { useAppStore } from '../../stores/useAppStore.ts'
import { useTabStore } from '../../stores/useTabStore.ts'
import type { Project } from '../../types/index.ts'

export default function ProjectSelector() {
  const [error, setError] = useState('')
  const [showSshForm, setShowSshForm] = useState(false)
  const [sshHost, setSshHost] = useState('')
  const [sshRemotePath, setSshRemotePath] = useState('')
  const project = useAppStore((s) => s.project)
  const setProject = useAppStore((s) => s.setProject)
  const addTab = useTabStore((s) => s.addTab)
  const tabs = useTabStore((s) => s.tabs)

  const openProject = async (result: { path: string; name: string }) => {
    const branch = await window.electronAPI.getGitBranch(result.path)
    const remote = await window.electronAPI.getGitRemote(result.path)

    const proj: Project = {
      id: crypto.randomUUID(),
      name: result.name,
      path: result.path,
      branch,
      remote,
    }

    setProject(proj)
    await window.electronAPI.storeSet('lastProjectPath', result.path)

    // Create initial tab for main branch if no tabs exist
    if (tabs.length === 0) {
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
  }

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

  const handleConnectSsh = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    const host = sshHost.trim()
    const remotePath = sshRemotePath.trim()
    if (!host || !remotePath) {
      setError('SSH host and remote path are required')
      return
    }

    try {
      const result = await window.electronAPI.connectSshProject(host, remotePath)
      await openProject(result)
      setShowSshForm(false)
      setSshHost('')
      setSshRemotePath('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect SSH project')
    }
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
          />
          <input
            type="text"
            value={sshRemotePath}
            onChange={(event) => setSshRemotePath(event.target.value)}
            placeholder="/absolute/remote/path"
            className="w-full px-2 py-1 text-xs rounded bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
          <div className="grid grid-cols-2 gap-1">
            <button
              type="submit"
              className="px-2 py-1 text-xs rounded bg-accent/20 border border-accent/40 text-accent hover:bg-accent/30 transition-colors"
            >
              Connect
            </button>
            <button
              type="button"
              onClick={handleCancelSsh}
              className="px-2 py-1 text-xs rounded bg-bg-tertiary border border-border text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
            >
              Cancel
            </button>
          </div>
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
