import { useState } from 'react'
import { useAppStore } from '../../stores/useAppStore.ts'
import { useTabStore } from '../../stores/useTabStore.ts'
import type { Project } from '../../types/index.ts'

export default function ProjectSelector() {
  const [error, setError] = useState('')
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

  const handleSelectSsh = async () => {
    setError('')
    const host = window.prompt('SSH host (e.g. user@server):')?.trim()
    if (!host) return
    const remotePath = window.prompt('Remote project path (absolute):')?.trim()
    if (!remotePath) return

    try {
      const result = await window.electronAPI.connectSshProject(host, remotePath)
      await openProject(result)
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
          onClick={() => void handleSelectSsh()}
          className="px-2 py-1 text-xs rounded bg-bg-tertiary border border-border text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
        >
          SSH
        </button>
      </div>

      {error && (
        <div className="mt-2 text-xs text-red truncate" title={error}>
          {error}
        </div>
      )}
    </div>
  )
}
