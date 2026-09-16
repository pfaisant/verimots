import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { planSync, applySync, digest } from '../scripts/sync-deployment.mjs'

const root = await realpath(await mkdtemp(join(tmpdir(), 'verimots-sync-')))
let seq = 0
test.after(() => rm(root, { recursive: true, force: true }))
async function put(root, path, content = path) {
  const file = join(root, path)
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, content)
}
async function setup() {
  const dir = join(root, String(++seq))
  const source = join(dir, 'source'), target = join(dir, 'target'), backup = join(dir, 'backup')
  await Promise.all([mkdir(source, { recursive: true }), mkdir(target, { recursive: true })])
  for (const [path, value] of [
    ['web/index.html', 'NEW APP'], ['landing/index.html', 'NEW LANDING'],
    ['android/app/src/main/Main.java', 'NEW JAVA'], ['android/gradle/wrapper/gradle-wrapper.jar', 'WRAPPER'],
    ['scripts/ods-game.mjs', 'GAME'], ['scripts/ods-define.mjs', 'DEFINE'], ['scripts/http-safety.mjs', 'SAFETY'],
  ]) await put(source, path, value)
  await put(target, 'dashboard/s/index.html', 'OLD APP')
  await put(target, 'scripts/serve.mjs', 'UNRELATED PRODUCTION SERVER')
  return { source, target, backup }
}

test('planning makes no destination or backup changes and maps only release source', async () => {
  const { source, target, backup } = await setup()
  const before = await digest(join(target, 'dashboard/s/index.html'))
  const plan = await planSync(source, target)
  assert.equal(await digest(join(target, 'dashboard/s/index.html')), before)
  assert.equal(await digest(join(target, 'scripts/serve.mjs')), await digest(join(target, 'scripts/serve.mjs')))
  await assert.rejects(readdir(backup), { code: 'ENOENT' })
  assert.equal(plan.files.find((file) => file.source === 'landing/index.html').destination, 'dashboard/verimots/index.html')
  assert.ok(plan.files.some((file) => file.destination === 'android/ods9/gradle/wrapper/gradle-wrapper.jar'))
  assert.ok(!plan.files.some((file) => file.destination === 'scripts/serve.mjs'))
})

test('applying verifies new bytes and retains a complete backup of overwritten files', async () => {
  const { source, target, backup } = await setup()
  const plan = await planSync(source, target)
  assert.equal(await applySync(plan, backup), plan.files.length)
  assert.equal(await readFile(join(target, 'dashboard/s/index.html'), 'utf8'), 'NEW APP')
  assert.equal(await readFile(join(backup, 'dashboard/s/index.html'), 'utf8'), 'OLD APP')
  assert.deepEqual(JSON.parse(await readFile(join(backup, 'plan.json'), 'utf8')), plan)
  for (const file of plan.files) assert.equal(await digest(join(target, file.destination)), file.sourceHash)
  assert.equal(await readFile(join(target, 'scripts/serve.mjs'), 'utf8'), 'UNRELATED PRODUCTION SERVER')
  assert.equal((await planSync(source, target)).files.length, 0)
  assert.equal(await digest(join(target, '.verimots-sync.lock')), null)
})

test('changed destination or source is rejected before copying any deployment file', async () => {
  for (const changeSource of [false, true]) {
    const { source, target, backup } = await setup()
    const plan = await planSync(source, target)
    await put(changeSource ? source : target, changeSource ? 'web/index.html' : 'dashboard/s/index.html', 'CONCURRENT EDIT')
    await assert.rejects(applySync(plan, backup), /Changed since planning/)
    assert.equal(await digest(join(target, 'scripts/ods-game.mjs')), null)
    assert.equal(await readFile(join(target, 'dashboard/s/index.html'), 'utf8'), changeSource ? 'OLD APP' : 'CONCURRENT EDIT')
  }
})

test('hidden secrets, generated files and archives are excluded while dictionaries and wrapper remain', async () => {
  const { source, target } = await setup()
  const excluded = ['web/.env', 'web/.env.production', 'web/.local-state/auth.json', 'landing/archive/old.html', 'web/site.zip', 'web/old.tar.gz', 'web/main.js.bak.1', 'android/build/result.json', 'android/local.properties', 'android/key.keystore', 'android/key.jks', 'android/app.apk', 'android/app.aab', 'android/.gradle/cached.bin']
  for (const path of excluded) await put(source, path, 'DO NOT DEPLOY')
  await put(source, 'web/data/ods9.txt.gz', 'DICTIONARY')
  await put(source, 'web/.well-known/assetlinks.json', 'PUBLIC ASSOCIATION')
  const plan = await planSync(source, target)
  assert.ok(excluded.every((path) => !plan.files.some((file) => file.source === path)))
  assert.ok(plan.files.some((file) => file.source === 'web/data/ods9.txt.gz'))
  assert.ok(plan.files.some((file) => file.source === 'web/.well-known/assetlinks.json'))
  assert.ok(plan.files.some((file) => file.source.endsWith('gradle-wrapper.jar')))
})

test('tampered traversal mappings and overlapping checkouts are refused', async () => {
  const { source, target, backup } = await setup()
  const plan = await planSync(source, target)
  for (const destination of ['../escaped.txt', '/absolute.txt', 'dashboard/s/../../unrelated.txt']) {
    await assert.rejects(applySync({ ...plan, files: [{ ...plan.files[0], destination }] }, backup), /invalid mapping/)
  }
  await assert.rejects(planSync(source, source), /separate checkouts/)
  await assert.rejects(applySync(plan, join(source, 'backup')), /outside both checkouts/)
  assert.equal(await readFile(join(target, 'dashboard/s/index.html'), 'utf8'), 'OLD APP')
})

test('deployment lock and non-empty backup prevent overwrites', async () => {
  const { source, target, backup } = await setup()
  const plan = await planSync(source, target)
  await put(target, '.verimots-sync.lock', 'OTHER DEPLOYMENT')
  await assert.rejects(applySync(plan, backup), { code: 'EEXIST' })
  assert.equal(await readFile(join(target, '.verimots-sync.lock'), 'utf8'), 'OTHER DEPLOYMENT')
  await rm(join(target, '.verimots-sync.lock'))
  await put(backup, 'existing.txt', 'PRESERVE')
  await assert.rejects(applySync(plan, backup), /empty directory/)
  assert.equal(await readFile(join(backup, 'existing.txt'), 'utf8'), 'PRESERVE')
  assert.equal(await readFile(join(target, 'dashboard/s/index.html'), 'utf8'), 'OLD APP')
})
