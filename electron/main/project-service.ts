import { dialog, type BrowserWindow } from 'electron'
import { cp, readdir, rm, stat } from 'fs/promises'
import path from 'path'
import { checkoutBranch, checkoutNewBranch } from './git-service.ts'
import {
  formatSshProjectPath,
  isSshProjectPath,
  normalizeRemotePath,
  parseSshProjectPath,
  runSsh,
  shQuote,
} from './ssh-utils.ts'

export async function selectProjectFolder(win: BrowserWindow): Promise<{ path: string; name: string } | null> {
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
    title: 'Select Project Folder',
  })

  if (result.canceled || !result.filePaths[0]) return null

  const folderPath = result.filePaths[0]
  const name = path.basename(folderPath)
  return { path: folderPath, name }
}

export async function connectSshProject(
  host: string,
  remotePath: string
): Promise<{ path: string; name: string }> {
  const normalizedHost = host.trim()
  const normalizedPath = normalizeRemotePath(remotePath)

  if (!normalizedHost) throw new Error('SSH host is required')
  if (!normalizedPath) throw new Error('Remote path is required')

  const checkCommand = `cd ${shQuote(normalizedPath)} && git rev-parse --is-inside-work-tree`
  const isRepo = await runSsh(normalizedHost, checkCommand)
  if (isRepo !== 'true') {
    throw new Error('Remote path is not a git repository')
  }

  return {
    path: formatSshProjectPath(normalizedHost, normalizedPath),
    name: `${path.posix.basename(normalizedPath)}@${normalizedHost}`,
  }
}

export async function duplicateProject(sourcePath: string, branchName: string): Promise<string> {
  if (isSshProjectPath(sourcePath)) {
    return duplicateRemoteProject(sourcePath, branchName)
  }

  const parentDir = path.dirname(sourcePath)
  const baseName = path.basename(sourcePath)
  const destPath = path.join(parentDir, `${baseName}-${branchName}`)

  const exists = await pathExists(destPath)
  if (!exists) {
    await cp(sourcePath, destPath, {
      recursive: true,
      filter: (src) => {
        const relativePath = path.relative(sourcePath, src)
        if (!relativePath) return true
        return !relativePath.split(path.sep).includes('node_modules')
      },
    })
  }

  try {
    await checkoutBranch(destPath, branchName)
  } catch {
    await checkoutNewBranch(destPath, branchName)
  }

  return destPath
}

async function duplicateRemoteProject(sourcePath: string, branchName: string): Promise<string> {
  const target = parseSshProjectPath(sourcePath)
  if (!target) throw new Error(`Invalid SSH source path: ${sourcePath}`)

  const parentDir = path.posix.dirname(target.remotePath)
  const baseName = path.posix.basename(target.remotePath)
  const destPath = path.posix.join(parentDir, `${baseName}-${branchName}`)
  const destParent = path.posix.dirname(destPath)

  const command = `
if [ ! -d ${shQuote(`${destPath}/.git`)} ]; then
  mkdir -p ${shQuote(destParent)}
  cp -R ${shQuote(target.remotePath)} ${shQuote(destPath)}
  find ${shQuote(destPath)} -type d -name node_modules -prune -exec rm -rf {} +
fi
cd ${shQuote(destPath)} && (git checkout ${shQuote(branchName)} || git checkout -b ${shQuote(branchName)})
`

  await runSsh(target.host, command)
  return formatSshProjectPath(target.host, destPath)
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath)
    return true
  } catch {
    return false
  }
}

export async function deleteProjectCopy(projectPath: string): Promise<void> {
  if (isSshProjectPath(projectPath)) {
    const target = parseSshProjectPath(projectPath)
    if (!target) throw new Error(`Invalid SSH project path: ${projectPath}`)
    await runSsh(target.host, `rm -rf -- ${shQuote(target.remotePath)}`)
    return
  }

  await rm(projectPath, { recursive: true, force: true })
}

export async function listProjectCopies(sourcePath: string): Promise<string[]> {
  if (isSshProjectPath(sourcePath)) {
    return listRemoteProjectCopies(sourcePath)
  }

  const parentDir = path.dirname(sourcePath)
  const baseName = path.basename(sourcePath)
  const prefix = `${baseName}-`

  const entries = await readdir(parentDir, { withFileTypes: true })
  const branches = new Set<string>()

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith(prefix)) continue

    const rootPath = path.join(parentDir, entry.name)
    const repoPaths = await findRepoRoots(rootPath)

    for (const repoPath of repoPaths) {
      const relative = path.relative(parentDir, repoPath)
      if (!relative.startsWith(prefix)) continue

      const branchName = relative.slice(prefix.length).split(path.sep).join('/')
      if (branchName) {
        branches.add(branchName)
      }
    }
  }

  return Array.from(branches).sort((a, b) => a.localeCompare(b))
}

async function listRemoteProjectCopies(sourcePath: string): Promise<string[]> {
  const target = parseSshProjectPath(sourcePath)
  if (!target) throw new Error(`Invalid SSH source path: ${sourcePath}`)

  const parentDir = path.posix.dirname(target.remotePath)
  const baseName = path.posix.basename(target.remotePath)
  const prefix = `${baseName}-`

  const command = `
parent=${shQuote(parentDir)}
prefix=${shQuote(prefix)}
find "$parent" -type d -name .git 2>/dev/null | while IFS= read -r gitdir; do
  repo="\${gitdir%/.git}"
  case "$repo" in
    "$parent/$prefix"*)
      rel="\${repo#"$parent/$prefix"}"
      [ -n "$rel" ] && printf '%s\\n' "$rel"
      ;;
  esac
done | sort -u
`

  const output = await runSsh(target.host, command)
  if (!output) return []
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

async function findRepoRoots(rootPath: string): Promise<string[]> {
  const roots: string[] = []

  const walk = async (currentPath: string): Promise<void> => {
    const gitPath = path.join(currentPath, '.git')
    if (await pathExists(gitPath)) {
      roots.push(currentPath)
      return
    }

    const entries = await readdir(currentPath, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await walk(path.join(currentPath, entry.name))
      }
    }
  }

  await walk(rootPath)
  return roots
}
