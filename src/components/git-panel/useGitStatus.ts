import { useEffect, useRef } from 'react'
import { useTabStore } from '../../stores/useTabStore.ts'
import { useGitStore } from '../../stores/useGitStore.ts'

const POLL_INTERVAL = 4000

export function useGitStatus() {
  const activeTabId = useTabStore((s) => s.activeTabId)
  const tabs = useTabStore((s) => s.tabs)
  const setStatus = useGitStore((s) => s.setStatus)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    const activeTab = tabs.find((t) => t.id === activeTabId)
    if (!activeTab) return

    const poll = async () => {
      try {
        const status = await window.electronAPI.getGitStatus(activeTab.path)
        setStatus(activeTab.id, status)
      } catch {
        // Ignore errors silently
      }
    }

    // Immediate poll
    poll()

    // Set up interval
    intervalRef.current = setInterval(poll, POLL_INTERVAL)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [activeTabId, tabs, setStatus])
}
