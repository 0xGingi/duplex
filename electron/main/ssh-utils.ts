import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const exec = promisify(execFile)

export interface SshProjectPath {
  host: string
  remotePath: string
}

export function isSshProjectPath(projectPath: string): boolean {
  return projectPath.startsWith('ssh://')
}

export function parseSshProjectPath(projectPath: string): SshProjectPath | null {
  if (!isSshProjectPath(projectPath)) return null

  const raw = projectPath.slice('ssh://'.length)
  if (!raw) return null

  let host = ''
  let remotePath = ''

  const marker = raw.indexOf(':/')
  if (marker >= 0) {
    host = raw.slice(0, marker)
    remotePath = raw.slice(marker + 1)
  } else {
    const slash = raw.indexOf('/')
    if (slash <= 0) return null
    host = raw.slice(0, slash)
    remotePath = raw.slice(slash)
  }

  const normalized = normalizeRemotePath(remotePath)
  if (!host || !normalized) return null

  return { host, remotePath: normalized }
}

export function normalizeRemotePath(inputPath: string): string {
  const trimmed = inputPath.trim().replace(/\\/g, '/')
  if (!trimmed) return ''

  const normalized = path.posix.normalize(trimmed.startsWith('/') ? trimmed : `/${trimmed}`)
  if (normalized === '/') return normalized
  return normalized.replace(/\/+$/, '')
}

export function formatSshProjectPath(host: string, remotePath: string): string {
  return `ssh://${host}:${normalizeRemotePath(remotePath)}`
}

export function shQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

export async function runSsh(host: string, command: string): Promise<string> {
  const { stdout } = await exec('ssh', [host, 'sh', '-lc', command], {
    maxBuffer: 20 * 1024 * 1024,
  })
  return stdout.trim()
}
