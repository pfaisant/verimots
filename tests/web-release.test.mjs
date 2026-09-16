import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import * as tiles from '../web/tiles.js'
import * as kids from '../web/kids.js'
import { rememberScore, rememberTrainingRound, parseRack, lexiconFileName, initGame } from '../web/game.js'
import { loadHistory, clearHistory, mergeHistory } from '../web/history.js'
import { loadFavorites, toggleFavorite } from '../web/favorites.js'

const source = name => readFile(new URL(`../web/${name}`, import.meta.url), 'utf8')
const noImports = text => text.replace(/^import\s[\s\S]*?from\s+'[^']+'\r?\n/gm, '')
const memoryStore = initial => {
  const data = new Map(Object.entries(initial || {}))
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }
}

async function globals(values, fn) {
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  try {
    for (const [key, descriptor] of Object.entries(values)) Object.defineProperty(globalThis, key, { configurable: true, ...descriptor })
    return await fn()
  } finally {
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  }
}

async function competitive(env = {}) {
  const context = vm.createContext({ AbortController, URLSearchParams, setTimeout, clearTimeout, ...env })
  vm.runInContext((await source('competitive.js')).replace(/^export /gm, ''), context)
  return vm.runInContext('({ getGameMode, setGameMode, initGoogleSignIn, checkSession, getCurrentUser, logout, fetchHistory, saveHistoryWord, clearCloudHistory })', context)
}

test('game modes remain usable when session storage is blocked or full', async () => {
  for (const storage of [undefined, { getItem: () => 'kids', setItem: () => { throw new Error('quota') } }]) {
    const api = await competitive({ sessionStorage: storage })
    api.setGameMode('training')
    assert.equal(api.getGameMode(), 'training')
    api.setGameMode('unknown')
    assert.equal(api.getGameMode(), 'defi')
  }
})

test('finishing solo and training rounds survives a denied localStorage getter', async () => {
  await globals({ localStorage: { get: () => { throw new Error('denied') } } }, () => {
    assert.equal(rememberScore(75).at(-1).p, 75)
    assert.equal(rememberTrainingRound({ found: 2, total: 3, solved: false }).plays, 1)
  })
})

test('clearing history never resurrects legacy session history', async () => {
  const key = 'ods9-session-v1'
  const local = memoryStore()
  const session = memoryStore({ [key]: JSON.stringify([{ word: 'CHAT', pts: 9, at: 1 }]) })
  await globals({ localStorage: { value: local }, sessionStorage: { value: session } }, () => {
    assert.equal(loadHistory()[0].word, 'CHAT')
    clearHistory()
    assert.deepEqual(loadHistory(), [])
    assert.equal(session.getItem(key), null)
    session.setItem(key, JSON.stringify([{ word: 'CHIEN', at: 2 }]))
    assert.deepEqual(loadHistory(), [], 'an explicit empty local history wins over an old session')
  })
})

test('stored favorites and cloud history are bounded, deduplicated and normalized', () => {
  const rows = Array.from({ length: 240 }, (_, i) => ({ word: `AB${String.fromCharCode(65 + Math.floor(i / 26), 65 + i % 26)}`, at: i, pts: 1 }))
  const bad = [{ word: 'A'.repeat(21) }, null, { word: 'ABAA', at: 999, pts: 'Infinity' }]
  const store = memoryStore({ 'verimots-favorites-v1': JSON.stringify([...bad, ...rows]) })
  const favorites = loadFavorites(store)
  assert.equal(favorites.length, 200)
  assert.equal(new Set(favorites.map(row => row.word)).size, 200)
  assert.equal(favorites[0].pts, 0)
  assert.equal(toggleFavorite('A'.repeat(21), 1, store).length, 200)
  const history = mergeHistory([...bad, ...rows], memoryStore())
  assert.equal(history.length, 80)
  assert.equal(history[0].word, 'ABAA')
  assert.equal(history[0].pts, 0)
  assert.equal(history[0].at, 999)
})

test('failed logout keeps the confirmed account until the server clears its cookie', async () => {
  let failing = false
  const api = await competitive({ fetch: async url => {
    if (url.endsWith('/me')) return { status: 200, json: async () => ({ ok: true, user: { sub: 'account' } }) }
    if (failing) throw new Error('offline')
    return { status: 200, json: async () => ({ ok: true }) }
  } })
  await api.checkSession()
  failing = true
  assert.equal((await api.logout()).ok, false)
  assert.equal(api.getCurrentUser().sub, 'account')
  failing = false
  assert.equal((await api.logout()).ok, true)
  assert.equal(api.getCurrentUser(), null)
})

test('history requests stop when their network deadline expires', async () => {
  const api = await competitive({ fetch: async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
  }) })
  assert.equal((await api.fetchHistory({ timeoutMs: 5 })).ok, false)
  assert.equal((await api.saveHistoryWord({ word: 'CHAT' }, { timeoutMs: 5 })).ok, false)
  assert.equal((await api.clearCloudHistory({ timeoutMs: 5 })).ok, false)
})

test('history writes carry their owner and refuse a changed browser account', async () => {
  const writes = []
  let account = 'account-a'
  const api = await competitive({ fetch: async (url, options) => {
    if (url.endsWith('/me')) return { status: 200, json: async () => ({ ok: true, user: { sub: account } }) }
    writes.push(options)
    return { status: 200, json: async () => ({ ok: true }) }
  } })
  await api.checkSession()
  assert.equal((await api.saveHistoryWord({ word: 'CHAT' })).ok, true)
  assert.equal(JSON.parse(writes[0].body).owner, 'account-a')
  assert.equal((await api.clearCloudHistory()).ok, true)
  assert.equal(writes[1].headers['X-Verimots-Owner'], 'account-a')
  account = 'account-b'
  await api.checkSession()
  assert.equal((await api.saveHistoryWord({ word: 'CHAT' }, { owner: 'account-a' })).error, 'session_changed')
  assert.equal((await api.clearCloudHistory({ owner: 'account-a' })).status, 409)
  assert.equal(writes.length, 2, 'a stale caller must not make either request')
})

test('simultaneous Google sign-in mounts share one script and can retry failure', async () => {
  const scripts = []
  const timers = new Map()
  let timerId = 0
  const window = {}
  const api = await competitive({
    window,
    setTimeout: fn => { timers.set(++timerId, fn); return timerId },
    clearTimeout: id => timers.delete(id),
    document: { createElement: () => ({ remove() { this.removed = true } }), head: { appendChild: script => scripts.push(script) } },
  })
  const first = api.initGoogleSignIn()
  const second = api.initGoogleSignIn()
  assert.equal(scripts.length, 1)
  const rejected = Promise.allSettled([first, second])
  timers.values().next().value()
  assert.ok((await rejected).every(result => result.status === 'rejected'))
  assert.equal(scripts[0].removed, true)
  const retry = api.initGoogleSignIn()
  window.google = { accounts: { id: {} } }
  scripts[1].onload()
  await retry
  assert.equal(timers.size, 0)
})

async function worker(fetchOverride) {
  const pending = new Map()
  let id = 0
  const self = { postMessage: message => pending.get(message.id)(message) }
  const context = vm.createContext({
    ...tiles, ...kids, self, Response, Blob, DecompressionStream, TextDecoder, AbortController, setTimeout, clearTimeout,
    fetch: fetchOverride || (async path => new Response(await readFile(new URL(`../web/${path}`, import.meta.url)))),
  })
  vm.runInContext(noImports(await source('worker.js')), context)
  return message => new Promise(resolve => {
    pending.set(++id, value => { pending.delete(value.id); resolve(value) })
    self.onmessage({ data: { id, ...message } })
  })
}

test('Spanish and Catalan pattern searches match tiles, including digraph wildcards', async () => {
  const ask = await worker()
  let result = await ask({ type: 'find', lang: 'es', mode: 'pattern', q: 'CHO??' })
  assert.equal(result.type, 'find')
  assert.ok(result.words.includes('CHORRO'))
  result = await ask({ type: 'find', lang: 'ca', mode: 'pattern', q: 'COL·LE??' })
  assert.ok(result.words.includes('COL·LEGI'))
  result = await ask({ type: 'find', lang: 'ca', mode: 'pattern', q: 'A?' })
  assert.ok(result.words.includes('ANY'))
  result = await ask({ type: 'find', lang: 'ca', mode: 'pattern', q: '[' })
  assert.equal(result.type, 'find', 'unexpected punctuation cannot break the worker queue')
})

test('kids opening racks retain all eight tiles and their seed answer', async () => {
  const ask = await worker()
  const result = await ask({ type: 'kids', lang: 'es', rack: 'ANIMALES', seed: 'ANIMALES' })
  assert.equal(result.rack, 'ANIMALES')
  assert.ok(result.groups.some(group => group.words.some(entry => entry.word === 'ANIMALES')))
  assert.equal(parseRack('ANIMALES', 8), 'ANIMALES')
  assert.equal(parseRack('ANIMALES'), 'ANIMALE', 'ordinary challenge links retain the seven-tile limit')
  assert.equal(lexiconFileName('disc'), 'verimots-ca-disc.txt')
})

test('a failed compressed lexicon falls back to plain text and handles CRLF lines', async () => {
  const paths = []
  const ask = await worker(async path => {
    paths.push(path)
    if (path.endsWith('.gz')) throw new Error('download failed')
    return new Response('CHAT\r\nCHIEN\r\n')
  })
  const result = await ask({ type: 'check', lang: 'fr', word: 'CHAT' })
  assert.equal(result.ok, true)
  assert.deepEqual(paths, ['data/ods9.txt.gz', 'data/ods9.txt'])
})

function gameDocument() {
  const elements = new Map()
  const classList = () => ({ add() {}, remove() {}, toggle() {}, contains() { return false } })
  const get = id => {
    if (!elements.has(id)) elements.set(id, {
      id, value: '', hidden: false, disabled: false, dataset: {}, style: { setProperty() {}, removeProperty() {} },
      classList: classList(), handlers: {}, isConnected: true,
      addEventListener(name, fn) { this.handlers[name] = fn },
      setAttribute(name, value) { this[name] = value }, removeAttribute(name) { delete this[name] },
      querySelector() { return null }, querySelectorAll() { return [] }, focus() {},
    })
    return elements.get(id)
  }
  return { get, document: { getElementById: get, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, body: { classList: classList() } } }
}

function gameGlobals(document) {
  return {
    document: { value: document },
    location: { value: { search: '', origin: 'https://example.test', pathname: '/' } },
    localStorage: { value: memoryStore() },
    MutationObserver: { value: class { observe() {} disconnect() {} } },
  }
}

test('a delayed word probe cannot score the same input on a later rack', async () => {
  const { get, document } = gameDocument()
  let resolveProbe
  const played = []
  let draws = 0
  await globals(gameGlobals(document), async () => {
    const game = initGame({
      ready: () => true, normalize: value => String(value).toUpperCase(), escapeHtml: value => String(value), tilesHtml: () => '',
      isCompetitive: () => false, isKids: () => false, isTraining: () => false, onPlayed: entry => played.push(entry),
      ask: async type => {
        if (type === 'probe') return new Promise(resolve => { resolveProbe = resolve })
        return { rack: ++draws === 1 ? 'CHAT' : 'CHIEN', groups: [{ words: [{ word: 'CHIEN', score: 10 }] }] }
      },
    })
    await game.open()
    get('game-q').value = 'CHAT'
    get('game-form').handlers.submit({ preventDefault() {} })
    assert.equal(typeof resolveProbe, 'function')
    await game.deal()
    get('game-q').value = 'CHAT'
    resolveProbe({ formable: true, valid: true, score: 9 })
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(played.length, 0)
    assert.equal(get('game-q').disabled, false)
  })
})

test('a failed deal exposes a retry that completes without reloading the page', async () => {
  const { get, document } = gameDocument()
  let failed = true
  await globals(gameGlobals(document), async () => {
    const game = initGame({
      ready: () => true, normalize: String, escapeHtml: String, tilesHtml: () => '',
      isCompetitive: () => false, isKids: () => false, isTraining: () => false,
      ask: async () => {
        if (failed) throw new Error('worker failed')
        return { rack: 'CHAT', groups: [{ words: [{ word: 'CHAT', score: 9 }] }] }
      },
    })
    await game.open()
    assert.equal(get('game-next').hidden, false)
    failed = false
    await get('game-next').handlers.click()
    assert.equal(get('game-q').disabled, false)
    assert.equal(get('game-next').hidden, true)
  })
})

async function serviceWorker(options = {}) {
  const listeners = {}, deleted = [], writes = []
  const text = await source('sw.js')
  const version = text.match(/const CACHE = '([^']+)'/)[1]
  const cache = {
    match: async () => options.cached ? new Response(options.cached) : undefined,
    put: async key => { if (options.failWrite) throw new Error('quota'); writes.push(key) },
    addAll: async () => {},
  }
  vm.runInNewContext(text, {
    URL, Response,
    self: { location: { origin: 'https://example.test' }, addEventListener: (name, fn) => { listeners[name] = fn }, clients: { claim: async () => {} } },
    caches: { open: async () => cache, keys: async () => ['unrelated-app', 'verimots-v1', version], delete: async key => deleted.push(key) },
    fetch: options.fetch || (async () => new Response('network')),
  })
  const dispatch = async (name, request) => {
    const work = []
    let response
    listeners[name]({ request, waitUntil: promise => work.push(promise), respondWith: promise => { response = promise } })
    const result = await response
    await Promise.all(work)
    return result
  }
  return { dispatch, deleted, writes }
}

test('service worker installation waits and activation preserves other apps caches', async () => {
  const sw = await serviceWorker()
  await sw.dispatch('install')
  await sw.dispatch('activate')
  assert.deepEqual(sw.deleted, ['verimots-v1'])
})

test('service worker serves cached pages on server errors and tolerates cache write failures', async () => {
  const request = { method: 'GET', mode: 'navigate', url: 'https://example.test/?lang=es' }
  const offline = await serviceWorker({ cached: 'offline shell', fetch: async () => new Response('error', { status: 503 }) })
  assert.equal(await (await offline.dispatch('fetch', request)).text(), 'offline shell')
  const quota = await serviceWorker({ failWrite: true })
  assert.equal(await (await quota.dispatch('fetch', request)).text(), 'network')
  const saved = await serviceWorker()
  await saved.dispatch('fetch', request)
  assert.deepEqual(saved.writes, ['https://example.test/'], 'navigation queries do not create unbounded copies')
})
