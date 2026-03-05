import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import {
  DEFAULT_CLI_TYPE,
  getCliCommand,
  isChatCliType,
  normalizeCliType,
} from '../../lib/cli-tools.ts'
import { useAppStore } from '../../stores/useAppStore.ts'
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
const SSH_PROJECT_PREFIX = 'ssh://'

export function useTerminal({ tabId, cwd, cliType, active }: UseTerminalOptions) {
  const containerRef = useRef<HTMLDivElement>(null)
  const customCliTools = useAppStore((s) => s.customCliTools)
  const defaultCliType = useAppStore((s) => s.defaultCliType)
  const safeDefaultCliType = normalizeCliType(defaultCliType, customCliTools, DEFAULT_CLI_TYPE)
  const safeCliType = cliType
    ? normalizeCliType(cliType, customCliTools, safeDefaultCliType)
    : undefined
  const cliCommand = getCliCommand(safeCliType, customCliTools)
  const isChatCli = safeCliType ? isChatCliType(safeCliType) : false
  const isSshSession = cwd.startsWith(SSH_PROJECT_PREFIX)

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
  }, [tabId, safeCliType])

  const startPty = useCallback(() => {
    if (ptyCreated.has(tabId)) return

    ptyCreated.add(tabId)
    void window.electronAPI
      .ptyCreate(tabId, cwd, safeCliType, cliCommand)
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
  }, [tabId, cwd, safeCliType, cliCommand])

  const writeCprToPty = useCallback((data: string) => {
    if (!ptyCreated.has(tabId)) return
    window.electronAPI.ptyWrite(tabId, data)
  }, [tabId])

  const writeToPty = useCallback(
    (data: string, options?: { allowEscWithoutPty?: boolean }) => {
      const allowEscWithoutPty = options?.allowEscWithoutPty ?? false

      if (!ptyCreated.has(tabId)) {
        // Ignore terminal response/control sequences (e.g. ESC[1;1R, ESC[?1;2c)
        // when no PTY is attached; replaying them into a new shell causes garbage commands.
        if (!allowEscWithoutPty && data.startsWith('\u001b')) {
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
    },
    [tabId, startPty]
  )

  // Create PTY once and wire data (stable - no active dependency)
  useEffect(() => {
    const { term } = getOrCreate()

    term.attachCustomKeyEventHandler((event) => {
      // xterm collapses Shift+Enter to Enter. Chat CLIs expect a modified-enter
      // escape sequence to insert a newline instead of submitting.
      if (
        isChatCli &&
        event.type === 'keydown' &&
        event.key === 'Enter' &&
        event.shiftKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey
      ) {
        event.preventDefault()
        writeToPty('\u001b[13;2u', { allowEscWithoutPty: true })
        return false
      }

      return true
    })

    // Respond to CPR (CSI 6 n) requests so prompt-toolkit based CLIs can
    // query cursor position and avoid degraded fallback behavior.
    const cprHandler = term.parser?.registerCsiHandler
      ? term.parser.registerCsiHandler({ final: 'n' }, (params) => {
        if (params.length === 1 && params[0] === 6) {
          const row = term.buffer.active.cursorY + 1
          const col = term.buffer.active.cursorX + 1
          writeCprToPty(`\u001b[${row};${col}R`)
          return true
        }
        return false
      })
      : null

    // Terminal → PTY
    const onData = term.onData((data) => {
      writeToPty(data)
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
      cprHandler?.dispose()
      onData.dispose()
      onResize.dispose()
      cleanupData()
      cleanupExit()
      // Kill PTY on unmount (component removed, not tab switch)
      void window.electronAPI.ptyKill(tabId)
      cleanupTerminal(tabId)
    }
  }, [tabId, cwd, safeCliType, getOrCreate, isChatCli, writeToPty, writeCprToPty])

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

  useEffect(() => {
    if (!isSshSession) return

    const container = containerRef.current
    if (!container) return

    const { term } = getOrCreate()

    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items
      if (!items || items.length === 0) return

      const imageItem = Array.from(items).find((item) => item.type.startsWith('image/'))
      if (!imageItem) return

      const imageFile = imageItem.getAsFile()
      if (!imageFile) {
        term.writeln('\r\n[Failed to paste image: Clipboard image could not be read.]\r\n')
        return
      }

      event.preventDefault()
      event.stopPropagation()

      void imageFile
        .arrayBuffer()
        .then((buffer) =>
          window.electronAPI.ptyPasteImage(
            tabId,
            cwd,
            new Uint8Array(buffer),
            imageFile.type || undefined
          )
        )
        .then((result) => {
          if (result.ok) return
          term.writeln(`\r\n[Failed to paste image: ${result.error ?? 'Unknown error'}]\r\n`)
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : String(error)
          term.writeln(`\r\n[Failed to paste image: ${message}]\r\n`)
        })
    }

    container.addEventListener('paste', handlePaste, true)
    return () => {
      container.removeEventListener('paste', handlePaste, true)
    }
  }, [isSshSession, tabId, cwd, getOrCreate])

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
