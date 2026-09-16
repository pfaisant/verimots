import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const flush = () => new Promise(resolve => setImmediate(resolve))
function setup() {
  const calls = [], documentEvents = new Map(), windowEvents = new Map()
  const state = { now: 100000, user: null, session: async () => null, history: async () => {} }
  const document = { hidden: false, getElementById: () => null, addEventListener: (type, fn) => documentEvents.set(type, fn) }
  const context = vm.createContext({
    Date: { now: () => state.now }, Promise, document,
    window: { addEventListener: (type, fn) => windowEvents.set(type, fn), scrollTo() {} },
    nav: 'game', ready: false, LANGS: [], brandSub: null, hint: null, advanced: false,
    initLang() {}, polishIcons() {}, initAlphaBtnOption() {}, readUrl() {}, syncChrome() {}, paintApkLink() {}, paintHistBtn() {},
    showPanel: name => calls.push(['panel', name]), enterGame: () => calls.push(['game']),
    loadMeta: async () => { calls.push(['meta']) },
    ask: async () => { calls.push(['lexicon']); return { count: 100 } },
    renderLists() {}, renderStudy() {}, setLive() {}, paintAboutCount() {}, paintLevel() {}, run() {}, mountBoardPage() {},
    liveCount: String, getLang: () => 'fr', t: value => value, writeUrl() {},
    checkSession: () => { calls.push(['session']); return state.session() },
    syncCloudHistory: () => { calls.push(['history']); return state.history() },
    getCurrentUser: () => state.user,
    game: { setUser: user => { calls.push(['account', user]); state.user = user } },
    console,
  })
  const source = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8')
  const lifecycleStart = source.indexOf('let accountSessionRequest =')
  vm.runInContext(source.slice(lifecycleStart, source.indexOf('\nfunction boardSplit(', lifecycleStart)), context)
  const bootStart = source.indexOf('async function boot()')
  vm.runInContext(source.slice(bootStart, source.indexOf("\nif ('serviceWorker'", bootStart)), context)
  const navStart = source.indexOf('function setNav(name)')
  vm.runInContext(source.slice(navStart, source.indexOf('\n// Share the Board', navStart)), context)
  const api = vm.runInContext('({boot, refreshAccount, setNav})', context)
  return { api, calls, state, context, document, documentEvents, windowEvents }
}

test('local UI and dictionary boot while session lookup remains unresolved', async () => {
  const ui = setup()
  ui.state.session = () => new Promise(() => {})
  const boot = ui.api.boot()
  await flush()
  assert.equal(ui.context.ready, true)
  assert.ok(ui.calls.find(call => call[0] === 'lexicon'))
  assert.ok(ui.calls.findIndex(call => call[0] === 'panel') < ui.calls.findIndex(call => call[0] === 'session'))
  await boot
})

test('cloud history cannot delay startup or block later session checks', async () => {
  const ui = setup()
  ui.state.session = async () => ({ sub: 'alice' })
  ui.state.history = () => new Promise(() => {})
  const boot = ui.api.boot()
  await flush()
  assert.equal(ui.context.ready, true)
  await boot
  assert.equal(ui.calls.filter(call => call[0] === 'history').length, 1)
  ui.state.now += 31000
  ui.state.session = async () => null
  await ui.api.refreshAccount()
  assert.equal(ui.state.user, null)
  assert.equal(ui.calls.filter(call => call[0] === 'session').length, 2)
})

test('Infos and resume refresh the session without duplicate or rapid requests', async () => {
  const ui = setup()
  await ui.api.boot()
  ui.api.setNav('info')
  ui.documentEvents.get('visibilitychange')()
  ui.windowEvents.get('pageshow')({ persisted: true })
  await flush()
  assert.equal(ui.calls.filter(call => call[0] === 'session').length, 1)
  ui.state.now += 31000
  let resolve
  ui.state.session = () => new Promise(done => { resolve = done })
  ui.api.setNav('info')
  ui.documentEvents.get('visibilitychange')()
  ui.windowEvents.get('pageshow')({ persisted: true })
  assert.equal(ui.calls.filter(call => call[0] === 'session').length, 2)
  resolve({ sub: 'alice' })
  await flush()
  assert.equal(ui.state.user.sub, 'alice')
  ui.state.now += 31000
  ui.document.hidden = true
  ui.documentEvents.get('visibilitychange')()
  assert.equal(ui.calls.filter(call => call[0] === 'session').length, 2)
})
