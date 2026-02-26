import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import type { CliType } from '../../types/index.ts'

interface UseTerminalOptions {
  tabId: string
  cwd: string
  cliType?: CliType
  active: boolean
}

// Global map to keep terminal instances alive across tab switches
const terminals = new Map<string, { term: Terminal; fitAddon: FitAddon }>()
// Track which PTYs have been created (avoid double-create)
const ptyCreated = new Set<string>()

export function useTerminal({ tabId, cwd, cliType, active }: UseTerminalOptions) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Create or get terminal instance
  const getOrCreate = useCallback(() => {
    let entry = terminals.get(tabId)
    if (!entry) {
      const term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
        theme: {
          background: '#0d0d14',
          foreground: '#e4e4e8',
          cursor: '#6c8cff',
          cursorAccent: '#0d0d14',
          selectionBackground: '#6c8cff40',
          black: '#1a1a24',
          red: '#f87171',
          green: '#4ade80',
          yellow: '#fbbf24',
          blue: '#6c8cff',
          magenta: '#c084fc',
          cyan: '#22d3ee',
          white: '#e4e4e8',
          brightBlack: '#5e5e6e',
          brightRed: '#fca5a5',
          brightGreen: '#86efac',
          brightYellow: '#fde68a',
          brightBlue: '#93b4ff',
          brightMagenta: '#d8b4fe',
          brightCyan: '#67e8f9',
          brightWhite: '#ffffff',
        },
        allowProposedApi: true,
        scrollback: 10000,
      })
      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      entry = { term, fitAddon }
      terminals.set(tabId, entry)
    }
    return entry
  }, [tabId])

  const startPty = useCallback(() => {
    if (ptyCreated.has(tabId)) return

    ptyCreated.add(tabId)
    void window.electronAPI
      .ptyCreate(tabId, cwd, cliType)
      .then((result: unknown) => {
        if (
          typeof result === 'object' &&
          result !== null &&
          'ok' in result &&
          (result as { ok?: boolean }).ok === false
        ) {
          ptyCreated.delete(tabId)
        }
      })
      .catch(() => {
        // Error is sent back over PTY events by the main process.
        ptyCreated.delete(tabId)
      })
  }, [tabId, cwd, cliType])

  // Create PTY once and wire data (stable - no active dependency)
  useEffect(() => {
    const { term } = getOrCreate()

    // Terminal → PTY
    const onData = term.onData((data) => {
      if (!ptyCreated.has(tabId)) {
        // Ignore terminal response/control sequences (e.g. ESC[1;1R, ESC[?1;2c)
        // when no PTY is attached; replaying them into a new shell causes garbage commands.
        if (data.startsWith('\u001b')) {
          return
        }

        startPty()
        // Replay the first key after PTY boot so the terminal feels responsive.
        setTimeout(() => {
          window.electronAPI.ptyWrite(tabId, data)
        }, 80)
        return
      }

      window.electronAPI.ptyWrite(tabId, data)
    })

    // PTY → Terminal
    const cleanupData = window.electronAPI.onPtyData((id, data) => {
      if (id === tabId) {
        term.write(data)
      }
    })

    const cleanupExit = window.electronAPI.onPtyExit((id, code) => {
      if (id === tabId) {
        ptyCreated.delete(tabId)
        term.writeln(`\r\n[Process exited with code ${code}. Press any key to restart.]`)
      }
    })

    // Resize → PTY
    const onResize = term.onResize(({ cols, rows }) => {
      if (cols < 2 || rows < 2) return
      window.electronAPI.ptyResize(tabId, cols, rows)
    })

    return () => {
      onData.dispose()
      onResize.dispose()
      cleanupData()
      cleanupExit()
      // Kill PTY on unmount (component removed, not tab switch)
      window.electronAPI.ptyKill(tabId)
      ptyCreated.delete(tabId)
    }
  }, [tabId, cwd, cliType, getOrCreate, startPty])

  useEffect(() => {
    if (!active) return
    startPty()
  }, [active, startPty])

  // Open terminal in its container once; keep it mounted across tab switches.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const { term } = getOrCreate()
    if (!term.element) {
      container.innerHTML = ''
      term.open(container)
    }
  }, [getOrCreate])

  // Fit only when active/visible.
  useEffect(() => {
    if (!active || !containerRef.current) return

    const { fitAddon } = getOrCreate()
    const canFit = () => {
      const container = containerRef.current
      if (!container) return false
      return container.clientWidth > 0 && container.clientHeight > 0
    }

    requestAnimationFrame(() => {
      if (!canFit()) return
      fitAddon.fit()
    })

    // ResizeObserver for panel resize
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        if (!canFit()) return
        fitAddon.fit()
      })
    })
    resizeObserver.observe(containerRef.current)

    // Window resize → fit
    const handleWindowResize = () => {
      if (!canFit()) return
      fitAddon.fit()
    }
    window.addEventListener('resize', handleWindowResize)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', handleWindowResize)
    }
  }, [active, getOrCreate])

  return { containerRef }
}

export function cleanupTerminal(tabId: string) {
  const entry = terminals.get(tabId)
  if (entry) {
    entry.term.dispose()
    terminals.delete(tabId)
  }
  ptyCreated.delete(tabId)
}
