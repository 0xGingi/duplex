import type {
  BuiltinCliType,
  CliSettings,
  CliType,
  CustomCliTool,
} from '../types/index.ts'

export const DEFAULT_CLI_TYPE: BuiltinCliType = 'codex'

interface BuiltinCliToolDefinition {
  id: BuiltinCliType
  name: string
  tabLabel: string
  command: string
  chatCli: boolean
}

export const BUILTIN_CLI_TOOLS: readonly BuiltinCliToolDefinition[] = [
  { id: 'claude', name: 'Claude', tabLabel: 'Claude Code', command: 'claude', chatCli: true },
  { id: 'codex', name: 'Codex', tabLabel: 'Codex', command: 'codex', chatCli: true },
  { id: 'kimi', name: 'Kimi', tabLabel: 'Kimi Code', command: 'kimi', chatCli: true },
  { id: 'opencode', name: 'OpenCode', tabLabel: 'OpenCode', command: 'opencode', chatCli: true },
]

const builtinToolById = new Map(BUILTIN_CLI_TOOLS.map((tool) => [tool.id, tool]))

export function isBuiltinCliType(value: unknown): value is BuiltinCliType {
  return typeof value === 'string' && builtinToolById.has(value as BuiltinCliType)
}

export function isCustomCliType(value: unknown): value is `custom:${string}` {
  return typeof value === 'string' && value.startsWith('custom:') && value.length > 'custom:'.length
}

export function toCustomCliType(toolId: string): CliType {
  return `custom:${toolId}` as CliType
}

export function getCustomCliId(cliType: string): string | null {
  if (!isCustomCliType(cliType)) return null
  return cliType.slice('custom:'.length)
}

export function getCliOptions(customTools: CustomCliTool[]): Array<{ id: CliType; name: string }> {
  return [
    ...BUILTIN_CLI_TOOLS.map((tool) => ({ id: tool.id as CliType, name: tool.name })),
    ...customTools.map((tool) => ({ id: toCustomCliType(tool.id), name: tool.name })),
  ]
}

export function getCliCommand(cliType: CliType | undefined, customTools: CustomCliTool[]): string | undefined {
  if (!cliType) return undefined

  if (isBuiltinCliType(cliType)) {
    return builtinToolById.get(cliType)?.command
  }

  const customId = getCustomCliId(cliType)
  const customTool = customId ? customTools.find((tool) => tool.id === customId) : undefined
  return customTool?.command
}

export function getCliTabLabel(cliType: CliType, customTools: CustomCliTool[]): string {
  if (isBuiltinCliType(cliType)) {
    return builtinToolById.get(cliType)?.tabLabel ?? 'Codex'
  }

  const customId = getCustomCliId(cliType)
  const customTool = customId ? customTools.find((tool) => tool.id === customId) : undefined
  return customTool?.name ?? 'Missing Tool'
}

export function getCliIndicatorClass(cliType: CliType): string {
  if (cliType === 'claude') return 'bg-accent'
  if (cliType === 'codex') return 'bg-green'
  if (cliType === 'kimi') return 'bg-cyan'
  if (cliType === 'opencode') return 'bg-yellow'
  return 'bg-border'
}

export function getCliSelectActiveClass(cliType: CliType): string {
  if (cliType === 'claude') return 'border-accent/40 text-accent'
  if (cliType === 'codex') return 'border-green/40 text-green'
  if (cliType === 'kimi') return 'border-cyan/40 text-cyan'
  if (cliType === 'opencode') return 'border-yellow/40 text-yellow'
  return 'border-border text-text-primary'
}

export function isValidCliType(cliType: unknown, customTools: CustomCliTool[]): cliType is CliType {
  if (typeof cliType !== 'string') return false
  if (isBuiltinCliType(cliType)) return true
  const customId = getCustomCliId(cliType)
  return customId !== null && customTools.some((tool) => tool.id === customId)
}

export function normalizeCliType(
  cliType: unknown,
  customTools: CustomCliTool[],
  fallback: CliType = DEFAULT_CLI_TYPE
): CliType {
  return isValidCliType(cliType, customTools) ? cliType : fallback
}

export function normalizeCustomCliTools(value: unknown): CustomCliTool[] {
  if (!Array.isArray(value)) return []

  const deduped = new Map<string, CustomCliTool>()
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const candidate = entry as Partial<CustomCliTool>

    const id = typeof candidate.id === 'string' ? candidate.id.trim() : ''
    const name = typeof candidate.name === 'string' ? candidate.name.trim() : ''
    const command = typeof candidate.command === 'string' ? candidate.command.trim() : ''
    if (!id || !name || !command) continue

    deduped.set(id, { id, name, command })
  }

  return Array.from(deduped.values())
}

export function normalizeCliSettings(value: unknown): CliSettings {
  const candidate = value && typeof value === 'object' ? (value as Partial<CliSettings>) : {}
  const customTools = normalizeCustomCliTools(candidate.customTools)
  const defaultCliType = normalizeCliType(candidate.defaultCliType, customTools, DEFAULT_CLI_TYPE)
  return { defaultCliType, customTools }
}

export function isChatCliType(cliType: CliType): boolean {
  return isBuiltinCliType(cliType) ? (builtinToolById.get(cliType)?.chatCli ?? false) : false
}
