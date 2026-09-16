#!/usr/bin/env node
// Plan first. Applying a plan refuses source or destination edits made since it.
import { createHash, randomBytes } from 'node:crypto'
import { constants } from 'node:fs'
import { copyFile, mkdir, readFile, readdir, realpath, stat, writeFile, rename, lstat, rm } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const MODULES = ['ods-game.mjs', 'ods-define.mjs', 'http-safety.mjs']
const omitted = name => {
  const lower = name.toLowerCase()
  return (name.startsWith('.') && name !== '.well-known')
    || ['node_modules', 'build', 'dist', 'coverage', 'local.properties', 'archive', 'archives', 'backup', 'backups'].includes(lower)
    || /\.(apk|aab|keystore|jks|jkskeystore|iml|zip|tgz|tar|7z|rar)(?:$|\.)|\.bak/.test(lower)
}
export async function digest(file) {
  try { return createHash('sha256').update(await readFile(file)).digest('hex') }
  catch (error) { if (error.code === 'ENOENT') return null; throw error }
}
function contained(root, path) {
  const rel = relative(root, path)
  return rel !== '..' && !rel.startsWith('../') && !rel.startsWith('..\\') && !isAbsolute(rel)
}
async function safePath(root, rel) {
  if (typeof rel !== 'string' || !rel || isAbsolute(rel)) throw new Error('Invalid relative path')
  const file = resolve(root, rel)
  if (!contained(root, file)) throw new Error(`Path escapes destination: ${rel}`)
  let part = file
  while (part !== root) {
    try { if ((await lstat(part)).isSymbolicLink()) throw new Error(`Refusing symlink: ${rel}`) }
    catch (error) { if (error.code !== 'ENOENT') throw error }
    part = dirname(part)
  }
  return file
}
async function walk(root, prefix = '') {
  const files = []
  for (const item of await readdir(join(root, prefix), { withFileTypes: true })) {
    if (omitted(item.name)) continue
    const path = prefix ? `${prefix}/${item.name}` : item.name
    if (item.isSymbolicLink()) throw new Error(`Refusing source symlink: ${path}`)
    if (item.isDirectory()) files.push(...await walk(root, path))
    else if (item.isFile()) files.push(path)
  }
  return files.sort()
}
export async function planSync(source, target) {
  source = await realpath(source)
  target = await realpath(target)
  if (source === target || contained(source, target) || contained(target, source)) throw new Error('Source and deployment must be separate checkouts')
  const pairs = []
  for (const [from, to] of [['web', 'dashboard/s'], ['landing', 'dashboard/verimots'], ['android', 'android/ods9']]) {
    for (const file of await walk(join(source, from))) pairs.push({ source: `${from}/${file}`, destination: `${to}/${file}` })
  }
  for (const file of MODULES) pairs.push({ source: `scripts/${file}`, destination: `scripts/${file}` })
  const files = []
  for (const pair of pairs) {
    const from = await safePath(source, pair.source)
    const to = await safePath(target, pair.destination)
    const sourceHash = await digest(from), beforeHash = await digest(to)
    if (!sourceHash) throw new Error(`Missing source ${pair.source}`)
    if (sourceHash !== beforeHash) files.push({ ...pair, sourceHash, beforeHash })
  }
  return { version: 1, createdAt: new Date().toISOString(), source, target, files }
}
async function noSymlinkAncestors(file) {
  let part = file
  while (true) {
    try { if ((await lstat(part)).isSymbolicLink()) throw new Error(`Refusing symlink: ${part}`) }
    catch (error) { if (error.code !== 'ENOENT') throw error }
    const parent = dirname(part)
    if (parent === part) return
    part = parent
  }
}

export async function applySync(plan, backup) {
  if (plan.version !== 1 || !Array.isArray(plan.files)) throw new Error('Invalid sync plan')
  const source = await realpath(plan.source), target = await realpath(plan.target)
  if (contained(source, target) || contained(target, source)) throw new Error('Overlapping checkouts')
  backup = resolve(backup)
  await noSymlinkAncestors(backup)
  if (contained(source, backup) || contained(target, backup)) throw new Error('Backup must be outside both checkouts')
  const allowed = await planSync(source, target)
  const mappings = new Map(allowed.files.map(file => [file.destination, file]))
  const prepared = []
  const seen = new Set()
  for (const file of plan.files) {
    const current = mappings.get(file.destination)
    if (seen.has(file.destination) || !current || current.source !== file.source || current.sourceHash !== file.sourceHash || current.beforeHash !== file.beforeHash) {
      throw new Error(`Changed since planning or invalid mapping: ${file.destination}`)
    }
    seen.add(file.destination)
    prepared.push({ ...file, from: await safePath(source, file.source), to: await safePath(target, file.destination) })
  }
  // A lock serializes this helper's deployments. Other writers are detected by
  // hashes immediately before replacement; coordinate edits during deployment.
  const lock = join(target, '.verimots-sync.lock')
  await writeFile(lock, JSON.stringify({ pid: process.pid, at: new Date().toISOString(), backup }), { flag: 'wx', mode: 0o600 })
  try {
    await mkdir(backup, { recursive: true, mode: 0o700 })
    await noSymlinkAncestors(backup)
    backup = await realpath(backup)
    if (!(await stat(backup)).isDirectory() || (await readdir(backup)).length) throw new Error('Backup must be an empty directory')
    if (contained(source, backup) || contained(target, backup)) throw new Error('Backup must be outside both checkouts')
    await writeFile(join(backup, 'plan.json'), JSON.stringify(plan, null, 2), { flag: 'wx', mode: 0o600 })
    // Copy and verify every rollback file before changing any deployed file.
    for (const file of prepared) {
      await safePath(target, file.destination)
      if (await digest(file.to) !== file.beforeHash || await digest(file.from) !== file.sourceHash) throw new Error(`Concurrent edit: ${file.destination}`)
      if (file.beforeHash) {
        const saved = await safePath(backup, file.destination)
        await mkdir(dirname(saved), { recursive: true, mode: 0o700 })
        await copyFile(file.to, saved, constants.COPYFILE_EXCL)
        if (await digest(saved) !== file.beforeHash) throw new Error(`Backup verification failed: ${file.destination}`)
      }
    }
    for (const file of prepared) {
      await safePath(source, file.source)
      await safePath(target, file.destination)
      await mkdir(dirname(file.to), { recursive: true })
      const temporary = file.to + `.verimots-sync-${process.pid}-${randomBytes(8).toString('hex')}`
      let ownedTemporary = false
      try {
        await copyFile(file.from, temporary, constants.COPYFILE_EXCL)
        ownedTemporary = true
        if (await digest(temporary) !== file.sourceHash) throw new Error(`Source changed while copying: ${file.source}`)
        await safePath(target, file.destination)
        if (await digest(file.to) !== file.beforeHash) throw new Error(`Concurrent edit: ${file.destination}`)
        await rename(temporary, file.to)
      } finally {
        if (ownedTemporary) await rm(temporary, { force: true })
      }
    }
    for (const file of prepared) if (await digest(file.to) !== file.sourceHash) throw new Error(`Verification failed: ${file.destination}`)
    return prepared.length
  } finally {
    await rm(lock, { force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
  if (option('--apply')) {
    if (!option('--backup')) throw new Error('--apply requires --backup outside both checkouts')
    const plan = JSON.parse(await readFile(option('--apply'), 'utf8'))
    console.log(`Synced and verified ${await applySync(plan, option('--backup'))} files. Restart the host after backend changes.`)
  } else {
    if (!option('--target') || !option('--plan')) throw new Error('Usage: --target <AiConglomerate> --plan <plan.json>; then --apply <plan.json> --backup <directory>')
    const plan = await planSync(ROOT, resolve(option('--target')))
    await writeFile(option('--plan'), JSON.stringify(plan, null, 2), { flag: 'wx' })
    console.log(`${plan.files.length} changed files. Plan saved to ${option('--plan')}. No deployment changed.`)
    for (const file of plan.files) console.log(file.destination)
  }
}
