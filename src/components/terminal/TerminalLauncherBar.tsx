import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../../stores/useAppStore.ts'
import { useTabStore } from '../../stores/useTabStore.ts'
import type { Tab } from '../../types/index.ts'
import { cleanupTerminal, useTerminal } from './useTerminal.ts'

function getFolderName(folderPath: string): string {
  const parts = folderPath.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? folderPath
}

interface BottomTerminalTab {
  id: string
  sourceTabId: string
  branch: string
  cwd: string
  isPrimary: boolean
}

function createBottomTerminalTab(sourceTab: Tab, isPrimary: boolean): BottomTerminalTab {
  return {
    id: crypto.randomUUID(),
    sourceTabId: sourceTab.id,
    branch: sourceTab.branch,
    cwd: sourceTab.path,
    isPrimary,
  }
}

function BottomTerminalInstance({ terminalId, cwd, active }: {
  terminalId: string
  cwd: string
  active: boolean
}) {
  const { containerRef } = useTerminal({
    tabId: terminalId,
    cwd,
    active,
  })

  useEffect(() => {
    return () => cleanupTerminal(terminalId)
  }, [terminalId])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden bg-[#0d0d14]"
      style={{ display: active ? 'block' : 'none' }}
    />
  )
}

export default function TerminalLauncherBar() {
  const project = useAppStore((s) => s.project)
  const bottomTerminalHeight = useAppStore((s) => s.bottomTerminalHeight)
  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const setActiveTab = useTabStore((s) => s.setActiveTab)
  const [bottomTabs, setBottomTabs] = useState<BottomTerminalTab[]>([])
  const [activeBottomTabId, setActiveBottomTabId] = useState<string | null>(null)

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? tabs[0] ?? null,
    [tabs, activeTabId]
  )

  useEffect(() => {
    if (tabs.length === 0) return
    if (!activeTabId || !tabs.some((tab) => tab.id === activeTabId)) {
      setActiveTab(tabs[0]!.id)
    }
  }, [tabs, activeTabId, setActiveTab])

  // Keep bottom terminal tabs aligned to open branch tabs:
  // one primary bottom tab per branch tab, plus optional extra tabs created by the user.
  useEffect(() => {
    setBottomTabs((prev) => {
      const sourceById = new Map(tabs.map((tab) => [tab.id, tab]))
      const existingPrimaryBySource = new Map(
        prev
          .filter((entry) => entry.isPrimary)
          .map((entry) => [entry.sourceTabId, entry])
      )

      const nextTabs: BottomTerminalTab[] = []

      for (const sourceTab of tabs) {
        const existingPrimary = existingPrimaryBySource.get(sourceTab.id)
        if (existingPrimary) {
          nextTabs.push({
            ...existingPrimary,
            sourceTabId: sourceTab.id,
            branch: sourceTab.branch,
            cwd: sourceTab.path,
            isPrimary: true,
          })
        } else {
          nextTabs.push(createBottomTerminalTab(sourceTab, true))
        }
      }

      for (const entry of prev) {
        if (entry.isPrimary) continue
        const sourceTab = sourceById.get(entry.sourceTabId)
        if (!sourceTab) continue
        nextTabs.push({
          ...entry,
          sourceTabId: sourceTab.id,
          branch: sourceTab.branch,
          cwd: sourceTab.path,
        })
      }

      return nextTabs
    })
  }, [tabs])

  useEffect(() => {
    if (activeTabId === null) return
    const currentBottom = bottomTabs.find((entry) => entry.id === activeBottomTabId)
    if (currentBottom?.sourceTabId === activeTabId) return

    const preferred = bottomTabs.find((entry) => entry.sourceTabId === activeTabId)
    if (preferred) setActiveBottomTabId(preferred.id)
  }, [activeTabId, activeBottomTabId, bottomTabs])

  useEffect(() => {
    if (activeBottomTabId && bottomTabs.some((entry) => entry.id === activeBottomTabId)) return

    const preferred = activeTabId
      ? bottomTabs.find((entry) => entry.sourceTabId === activeTabId)
      : null

    setActiveBottomTabId(preferred?.id ?? bottomTabs[0]?.id ?? null)
  }, [activeBottomTabId, activeTabId, bottomTabs])

  const activeBottomTab = useMemo(
    () => bottomTabs.find((entry) => entry.id === activeBottomTabId) ?? null,
    [bottomTabs, activeBottomTabId]
  )

  const tabLabels = useMemo(() => {
    const totalsBySource = new Map<string, number>()
    for (const entry of bottomTabs) {
      totalsBySource.set(entry.sourceTabId, (totalsBySource.get(entry.sourceTabId) ?? 0) + 1)
    }

    const seenBySource = new Map<string, number>()
    const labels = new Map<string, string>()
    for (const entry of bottomTabs) {
      const index = (seenBySource.get(entry.sourceTabId) ?? 0) + 1
      seenBySource.set(entry.sourceTabId, index)
      const total = totalsBySource.get(entry.sourceTabId) ?? 1
      labels.set(entry.id, total > 1 ? `${entry.branch} (${index})` : entry.branch)
    }
    return labels
  }, [bottomTabs])

  const handleOpenBottomTab = () => {
    if (!activeTab) return
    const next = createBottomTerminalTab(activeTab, false)
    setBottomTabs((prev) => [...prev, next])
    setActiveBottomTabId(next.id)
  }

  const handleSelectBottomTab = (entry: BottomTerminalTab) => {
    setActiveBottomTabId(entry.id)
    if (entry.sourceTabId !== activeTabId) {
      setActiveTab(entry.sourceTabId)
    }
  }

  const handleCloseBottomTab = (entryId: string) => {
    setBottomTabs((prev) => {
      const index = prev.findIndex((entry) => entry.id === entryId)
      if (index < 0) return prev

      const nextTabs = prev.filter((entry) => entry.id !== entryId)
      setActiveBottomTabId((current) => {
        if (current !== entryId) {
          return current && nextTabs.some((entry) => entry.id === current)
            ? current
            : (nextTabs[0]?.id ?? null)
        }
        const fallback = nextTabs[index] ?? nextTabs[index - 1] ?? nextTabs[0]
        return fallback?.id ?? null
      })

      return nextTabs
    })
  }

  return (
    <div
      className="border-t border-border bg-bg-secondary flex flex-col"
      style={{ height: bottomTerminalHeight }}
    >
      <div className="h-9 px-2 border-b border-border flex items-center gap-1">
        <span className="text-[11px] text-text-muted px-2 whitespace-nowrap">Bottom</span>
        <div className="flex-1 min-w-0 overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max">
            {bottomTabs.map((entry) => {
              const isActive = entry.id === activeBottomTab?.id
              const label = tabLabels.get(entry.id) ?? entry.branch
              return (
                <div
                  key={entry.id}
                  className={`group flex items-center rounded border transition-colors ${
                    isActive
                      ? 'bg-bg-active border-border text-text-primary'
                      : 'bg-bg-tertiary border-border text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <button
                    onClick={() => handleSelectBottomTab(entry)}
                    title={entry.cwd}
                    className="max-w-[220px] px-2 py-1 text-xs truncate"
                  >
                    {label}
                  </button>
                  <span className="text-[10px] text-text-muted pr-2">{getFolderName(entry.cwd)}</span>
                  {!entry.isPrimary && (
                    <button
                      onClick={() => handleCloseBottomTab(entry.id)}
                      title="Close terminal tab"
                      className="px-1.5 py-1 text-[11px] text-text-muted hover:text-text-primary"
                    >
                      x
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        <button
          onClick={handleOpenBottomTab}
          disabled={!activeTab}
          title={activeTab ? `Open another terminal for ${activeTab.branch}` : 'Select a branch tab first'}
          className="px-2 py-1 text-xs rounded border border-border bg-bg-tertiary text-text-secondary hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          +
        </button>
      </div>

      {activeBottomTab ? (
        <div className="flex-1 min-h-0 relative overflow-hidden bg-[#0d0d14]">
          {bottomTabs.map((entry) => (
            <BottomTerminalInstance
              key={entry.id}
              terminalId={`__bottom_terminal_branch__:${entry.id}`}
              cwd={entry.cwd}
              active={entry.id === activeBottomTab.id}
            />
          ))}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-xs text-text-muted">
          {project ? 'No branch tabs open' : 'Select a project folder to start a terminal'}
        </div>
      )}
    </div>
  )
}
