import { spawnSync } from 'node:child_process'
import type { BuiltinCliType, CliType } from '../../src/types/index.ts'
import { shQuote } from './ssh-utils.ts'

const BUILTIN_CLI_COMMANDS: Record<BuiltinCliType, string> = {
  claude: 'claude',
  codex: 'codex',
  kimi: 'kimi',
  opencode: 'opencode',
}

export function isBuiltinCliType(value: CliType): value is BuiltinCliType {
  return value === 'claude' || value === 'codex' || value === 'kimi' || value === 'opencode'
}

export function resolveCliCommand(cliType?: CliType, cliCommand?: string): string | undefined {
  const custom = cliCommand?.trim()
  if (custom) return custom
  if (cliType && isBuiltinCliType(cliType)) return BUILTIN_CLI_COMMANDS[cliType]
  return undefined
}

export function extractCommandExecutable(command?: string): string | undefined {
  const input = command?.trim()
  if (!input) return undefined

  const match = input.match(/^(["'])([^"']+)\1|^([^\s]+)/)
  const token = match ? (match[2] ?? match[3]) : undefined
  const executable = token?.trim()
  return executable || undefined
}

export function checkLocalExecutableAvailable(executable: string): boolean {
  if (process.platform === 'win32') {
    const result = spawnSync('where', [executable], { stdio: 'ignore' })
    return result.status === 0
  }

  const shell = process.env.SHELL || '/bin/bash'
  const result = spawnSync(shell, ['-ilc', `command -v ${shQuote(executable)} >/dev/null 2>&1`], {
    stdio: 'ignore',
  })
  return result.status === 0
}

export function checkLocalCliCommand(command: string): { ok: boolean; executable?: string; error?: string } {
  const executable = extractCommandExecutable(command)
  if (!executable) {
    return { ok: false, error: 'Command is required' }
  }
  if (!checkLocalExecutableAvailable(executable)) {
    return {
      ok: false,
      executable,
      error: buildMissingCliMessage({ scope: 'local', executable }),
    }
  }
  return { ok: true, executable }
}

export function buildMissingCliMessage(params: {
  scope: 'local' | 'remote'
  executable: string
  host?: string
}): string {
  if (params.scope === 'remote') {
    const host = params.host ? ` (${params.host})` : ''
    return `[CLI command not found on remote host${host}: ${params.executable}]`
  }
  return `[CLI command not found on this machine: ${params.executable}]`
}
