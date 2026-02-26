import { execFile } from 'child_process'
import { promisify } from 'util'
import type { GitStatus, GitFileChange } from '../../src/types/index.ts'
import { isSshProjectPath, parseSshProjectPath, runSsh, shQuote } from './ssh-utils.ts'

const exec = promisify(execFile)

async function git(cwd: string, ...args: string[]): Promise<string> {
  if (isSshProjectPath(cwd)) {
    const target = parseSshProjectPath(cwd)
    if (!target) {
      throw new Error(`Invalid SSH project path: ${cwd}`)
    }

    const gitArgs = args.map(shQuote).join(' ')
    const remoteCommand = `cd ${shQuote(target.remotePath)} && git ${gitArgs}`
    return runSsh(target.host, remoteCommand)
  }

  const { stdout } = await exec('git', args, { cwd, maxBuffer: 10 * 1024 * 1024 })
  return stdout.trim()
}

export async function getBranch(cwd: string): Promise<string> {
  try {
    return await git(cwd, 'rev-parse', '--abbrev-ref', 'HEAD')
  } catch {
    return 'unknown'
  }
}

export async function getRemote(cwd: string): Promise<string> {
  try {
    return await git(cwd, 'remote', 'get-url', 'origin')
  } catch {
    return ''
  }
}

export async function listBranches(cwd: string): Promise<string[]> {
  try {
    const output = await git(cwd, 'branch', '--format=%(refname:short)')
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

export async function getStatus(cwd: string): Promise<GitStatus> {
  const branch = await getBranch(cwd)

  let ahead = 0
  let behind = 0
  try {
    const revList = await git(cwd, 'rev-list', '--left-right', '--count', `HEAD...@{upstream}`)
    const parts = revList.split('\t')
    ahead = parseInt(parts[0] || '0', 10)
    behind = parseInt(parts[1] || '0', 10)
  } catch {
    // No upstream configured
  }

  const changes: GitFileChange[] = []
  try {
    const statusOutput = await git(cwd, 'status', '--porcelain=v1')
    if (statusOutput) {
      for (const line of statusOutput.split('\n')) {
        if (!line) continue
        const indexStatus = line[0]!
        const workStatus = line[1]!
        const file = line.slice(3)

        if (indexStatus !== ' ' && indexStatus !== '?') {
          changes.push({
            file,
            status: indexStatus as GitFileChange['status'],
            staged: true,
          })
        }
        if (workStatus !== ' ') {
          changes.push({
            file,
            status: workStatus === '?' ? '?' : workStatus as GitFileChange['status'],
            staged: false,
          })
        }
      }
    }
  } catch {
    // Not a git repo or error
  }

  return { branch, ahead, behind, changes }
}

export async function getFileDiff(cwd: string, file: string): Promise<string> {
  try {
    return await git(cwd, 'diff', '--', file)
  } catch {
    return ''
  }
}

export async function getStagedFileDiff(cwd: string, file: string): Promise<string> {
  try {
    return await git(cwd, 'diff', '--cached', '--', file)
  } catch {
    return ''
  }
}

export async function checkoutNewBranch(cwd: string, branchName: string): Promise<void> {
  await git(cwd, 'checkout', '-b', branchName)
}

export async function checkoutBranch(cwd: string, branchName: string): Promise<void> {
  await git(cwd, 'checkout', branchName)
}

export async function stageFile(cwd: string, file: string): Promise<void> {
  await git(cwd, 'add', '--', file)
}

export async function unstageFile(cwd: string, file: string): Promise<void> {
  try {
    await git(cwd, 'restore', '--staged', '--', file)
  } catch {
    await git(cwd, 'reset', 'HEAD', '--', file)
  }
}

export async function stageAll(cwd: string): Promise<void> {
  await git(cwd, 'add', '-A')
}

export async function unstageAll(cwd: string): Promise<void> {
  try {
    await git(cwd, 'restore', '--staged', '.')
  } catch {
    await git(cwd, 'reset', 'HEAD', '--', '.')
  }
}

export async function commit(cwd: string, message: string): Promise<void> {
  await git(cwd, 'commit', '-m', message)
}

export async function push(cwd: string): Promise<void> {
  await git(cwd, 'push')
}

export async function publishBranch(cwd: string): Promise<void> {
  const branch = await getBranch(cwd)
  await git(cwd, 'push', '-u', 'origin', branch)
}

export async function discardFile(cwd: string, file: string): Promise<void> {
  try {
    await git(cwd, 'restore', '--worktree', '--', file)
  } catch {
    try {
      await git(cwd, 'checkout', '--', file)
    } catch {
      await git(cwd, 'clean', '-f', '--', file)
    }
  }
}

export async function discardAll(cwd: string): Promise<void> {
  try {
    await git(cwd, 'restore', '--worktree', '.')
  } catch {
    await git(cwd, 'checkout', '--', '.')
  }

  try {
    await git(cwd, 'clean', '-fd')
  } catch {
    // Ignore clean failures (e.g. permissions).
  }
}

export async function amendCommit(cwd: string, message?: string): Promise<void> {
  if (message && message.trim()) {
    await git(cwd, 'commit', '--amend', '-m', message.trim())
    return
  }
  await git(cwd, 'commit', '--amend', '--no-edit')
}
