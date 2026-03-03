import { describe, expect, it } from 'bun:test'
import {
  buildMissingCliMessage,
  extractCommandExecutable,
  resolveCliCommand,
} from './cli-command.ts'

describe('cli-command resolution', () => {
  it('prefers explicit cliCommand over built-in type', () => {
    expect(resolveCliCommand('codex', '  custom-run --flag  ')).toBe('custom-run --flag')
  })

  it('falls back to built-in command for built-in cliType', () => {
    expect(resolveCliCommand('claude')).toBe('claude')
    expect(resolveCliCommand('opencode')).toBe('opencode')
  })

  it('returns undefined for custom cliType without explicit command', () => {
    expect(resolveCliCommand('custom:tool-1')).toBeUndefined()
  })
})

describe('cli-command executable parsing', () => {
  it('extracts executable from simple command', () => {
    expect(extractCommandExecutable('mytool --chat --fast')).toBe('mytool')
  })

  it('extracts executable from quoted command', () => {
    expect(extractCommandExecutable('"./my tool/bin/runner" --chat')).toBe('./my tool/bin/runner')
  })

  it('returns undefined for blank command', () => {
    expect(extractCommandExecutable('   ')).toBeUndefined()
  })
})

describe('cli-command missing tool messages', () => {
  it('formats local missing command message', () => {
    expect(buildMissingCliMessage({ scope: 'local', executable: 'foo' })).toBe(
      '[CLI command not found on this machine: foo]'
    )
  })

  it('formats remote missing command message', () => {
    expect(buildMissingCliMessage({ scope: 'remote', host: 'user@server', executable: 'foo' })).toBe(
      '[CLI command not found on remote host (user@server): foo]'
    )
  })
})
