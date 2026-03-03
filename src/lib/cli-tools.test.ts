import { describe, expect, it } from 'bun:test'
import {
  DEFAULT_CLI_TYPE,
  getCliCommand,
  normalizeCliSettings,
  normalizeCliType,
  normalizeCustomCliTools,
  toCustomCliType,
} from './cli-tools.ts'

describe('cli-tools normalization', () => {
  it('normalizes and deduplicates custom tools', () => {
    const tools = normalizeCustomCliTools([
      { id: 'one', name: 'One', command: 'one' },
      { id: 'two', name: 'Two', command: 'two' },
      { id: 'one', name: 'Override', command: 'override' },
      { id: '', name: 'Invalid', command: 'x' },
      { id: 'three', name: '', command: 'x' },
      { id: 'four', name: 'Four', command: '' },
      null,
    ])

    expect(tools).toEqual([
      { id: 'one', name: 'Override', command: 'override' },
      { id: 'two', name: 'Two', command: 'two' },
    ])
  })

  it('falls back to default when stored default cli is invalid', () => {
    const settings = normalizeCliSettings({
      defaultCliType: 'custom:missing',
      customTools: [{ id: 'tool-1', name: 'My Tool', command: 'mytool' }],
    })

    expect(settings.defaultCliType).toBe(DEFAULT_CLI_TYPE)
    expect(settings.customTools).toEqual([{ id: 'tool-1', name: 'My Tool', command: 'mytool' }])
  })

  it('keeps valid stored custom default cli', () => {
    const settings = normalizeCliSettings({
      defaultCliType: 'custom:tool-1',
      customTools: [{ id: 'tool-1', name: 'My Tool', command: 'mytool' }],
    })

    expect(settings.defaultCliType).toBe('custom:tool-1')
  })

  it('normalizes cli type against available tools', () => {
    const customTools = [{ id: 'tool-1', name: 'My Tool', command: 'mytool' }]
    expect(normalizeCliType('codex', customTools)).toBe('codex')
    expect(normalizeCliType('custom:tool-1', customTools)).toBe('custom:tool-1')
    expect(normalizeCliType('custom:missing', customTools)).toBe(DEFAULT_CLI_TYPE)
  })
})

describe('cli-tools command resolution', () => {
  it('resolves built-in and custom commands', () => {
    const customTools = [{ id: 'tool-1', name: 'My Tool', command: 'mytool --chat' }]
    expect(getCliCommand('codex', customTools)).toBe('codex')
    expect(getCliCommand(toCustomCliType('tool-1'), customTools)).toBe('mytool --chat')
  })

  it('returns undefined for missing custom tool command', () => {
    const customTools = [{ id: 'tool-1', name: 'My Tool', command: 'mytool --chat' }]
    expect(getCliCommand('custom:tool-2', customTools)).toBeUndefined()
  })
})
