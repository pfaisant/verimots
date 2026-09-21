import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { handoffUrls, validState } from '../web/android-auth.js'

const STATE = 'aB01_-'.repeat(8)
const TOKEN = 'test-session-token'
const APK_URL = 'https://downloads.pfa87.cc/verimots.apk'
const LAUNCH_URL = 'intent://auth#Intent;scheme=verimots;package=cc.pfa87.verimots;end'
const source = readFileSync(new URL('../web/android-auth.js', import.meta.url), 'utf8')
const response = (ok, data) => ({ ok, json: async () => data })

function setup({ page = 'start', query = '?lang=en', hash = '', sdk = false, blockIntent = false, reply } = {}) {
  const file = page === 'done' ? 'auth-android-done.html' : 'auth-android.html'
  let currentUrl = new URL(`https://verimots.example/${file}${query}${hash}`)
  const html = readFileSync(new URL(`../web/${file}`, import.meta.url), 'utf8')
  const nodes = new Map()
  for (const [, attrs, id] of html.matchAll(/<[^>]+\s([^>]*\bid="([^"]+)"[^>]*)>/g)) {
    const listeners = new Map()
    nodes.set(id, {
      hidden: /\bhidden\b/.test(attrs), textContent: '', href: '',
      addEventListener: (type, callback) => listeners.set(type, callback),
      click: async () => listeners.get('click')?.({ preventDefault() {} }),
    })
  }
  const scripts = [], calls = [], renders = [], initializations = [], navigations = [], historyCalls = []
  const timers = new Map()
  let nextTimer = 0
  const location = {
    get search() { return currentUrl.search },
    get hash() { return currentUrl.hash },
    get pathname() { return currentUrl.pathname },
    get href() { return currentUrl.href },
    set href(value) {
      navigations.push({
        type: 'assign', value,
        openVisible: nodes.get('open')?.hidden === false,
        openHref: nodes.get('open')?.href,
      })
      if (blockIntent && value.startsWith('intent:')) throw new Error('Intent launch blocked')
      currentUrl = new URL(value, currentUrl)
    },
    replace(value) {
      navigations.push({ type: 'replace', value })
      currentUrl = new URL(value, currentUrl)
    },
  }
  const google = { accounts: { id: {
    initialize: options => initializations.push(options),
    renderButton: (node, options) => renders.push({ node, options }),
  } } }
  const document = {
    documentElement: { lang: '' }, title: '', body: { dataset: { auth: page } },
    getElementById: id => nodes.get(id) ?? null,
    createElement: tag => ({ tag, remove() { this.removed = true } }),
    head: { appendChild: script => scripts.push(script) },
  }
  const context = vm.createContext({
    URL, URLSearchParams, AbortSignal, document, location,
    history: { replaceState: (...args) => {
      historyCalls.push(args)
      currentUrl = new URL(args[2], currentUrl)
    } },
    window: sdk ? { google } : {}, google: sdk ? google : undefined,
    setTimeout: (callback, delay) => {
      const id = ++nextTimer
      timers.set(id, { callback, delay })
      return id
    },
    clearTimeout: id => timers.delete(id),
    fetch: async (url, options) => {
      calls.push({ url, options })
      return reply ? reply(url, options) : response(true, { ok: true, sessionToken: TOKEN })
    },
  })
  vm.runInContext(source.replace(/^export /gm, ''), context)
  return {
    document, nodes, scripts, calls, renders, initializations, navigations, historyCalls, location,
    async signIn() {
      assert.equal(initializations.length, 1)
      await initializations[0].callback({ credential: 'test-google-id-token' })
    },
    async runTimers() {
      for (const [id, timer] of [...timers]) {
        timers.delete(id)
        await timer.callback()
      }
    },
  }
}

function assertNoLogin(page) {
  assert.equal(page.scripts.length, 0, 'invalid requests must not load the Google SDK')
  assert.equal(page.calls.length, 0, 'invalid requests must not call the authentication API')
  assert.equal(page.initializations.length, 0)
  assert.equal(page.renders.length, 0)
}

function assertUpdateLink(page) {
  const update = page.nodes.get('update')
  assert.ok(update, 'the page must provide an update link')
  assert.equal(update.hidden, false)
  assert.equal(update.href, APK_URL)
  assert.ok(update.textContent.length > 0)
}

function assertSafeRecovery(page) {
  assertNoLogin(page)
  assertUpdateLink(page)
  const open = page.nodes.get('open')
  assert.equal(open.hidden, false)
  assert.equal(open.href, LAUNCH_URL)
  assert.ok(open.textContent.length > 0)
  assert.doesNotMatch(open.href, /token=|state=/)
}

for (const [lang, updateWords] of Object.entries({
  fr: /mettez|mise à jour|mettre à jour/i,
  en: /update/i,
  es: /actualiza|actualizaci[oó]n/i,
  ca: /actualitza|actualitzaci[oó]/i,
})) {
  test(`an older APK without state gets a localized update path (${lang})`, async () => {
    const page = setup({ query: `?lang=${lang}` })
    assert.equal(page.document.documentElement.lang, lang)
    assert.match(page.nodes.get('msg').textContent, updateWords)
    assert.match(page.nodes.get('msg').textContent, /Verimots/)
    assertUpdateLink(page)
    assertNoLogin(page)
    await page.nodes.get('retry').click()
    assertNoLogin(page)
  })
}

test('an unsupported language uses French recovery copy', () => {
  const page = setup({ query: '?lang=unknown' })
  assert.equal(page.document.documentElement.lang, 'fr')
  assert.match(page.nodes.get('msg').textContent, /mettez|mise à jour|mettre à jour/i)
  assertUpdateLink(page)
  assertNoLogin(page)
})

test('malformed nonempty states expose only safe recovery links', async () => {
  for (const state of ['short', 'a'.repeat(39), 'a'.repeat(129), 'a'.repeat(40) + ';package=other', 'a'.repeat(40) + '\n']) {
    const page = setup({ query: `?lang=en&state=${encodeURIComponent(state)}` })
    assertSafeRecovery(page)
    await page.nodes.get('retry').click()
    assertNoLogin(page)
  }
})

test('valid state initializes the localized Google sign-in button', () => {
  const page = setup({ query: `?lang=es&state=${STATE}`, sdk: true })
  assert.equal(page.initializations.length, 1)
  assert.ok(page.initializations[0].client_id.endsWith('.apps.googleusercontent.com'))
  assert.equal(page.renders.length, 1)
  assert.equal(page.renders[0].node, page.nodes.get('google-btn'))
  assert.equal(page.renders[0].options.locale, 'es')
  assert.equal(page.nodes.get('retry').hidden, true)
  assert.equal(page.nodes.get('open').hidden, true)
  assert.equal(page.calls.length, 0)
})

test('valid state loads Google SDK and SDK failures offer a retry', async () => {
  const page = setup({ query: `?lang=en&state=${STATE}` })
  assert.equal(page.scripts.length, 1)
  assert.equal(page.scripts[0].src, 'https://accounts.google.com/gsi/client')
  page.scripts[0].onerror()
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(page.nodes.get('retry').hidden, false)
  assert.match(page.nodes.get('status').textContent, /could not|try again/i)
  assert.equal(page.calls.length, 0)
})

test('successful login preserves a manual handoff before attempting automatic launch', async () => {
  const page = setup({ query: `?lang=ca&state=${STATE}`, sdk: true })
  await page.signIn()
  assert.equal(page.calls.length, 1)
  assert.equal(page.calls[0].url, '/api/auth/google')
  assert.equal(page.calls[0].options.method, 'POST')
  assert.deepEqual(JSON.parse(page.calls[0].options.body), { idToken: 'test-google-id-token' })
  const urls = handoffUrls(TOKEN, STATE, 'ca')
  const launch = page.navigations.find(navigation => navigation.value.startsWith('intent:'))
  assert.ok(launch, 'successful sign-in must try to open the app')
  assert.equal(launch.value, urls.app)
  assert.equal(launch.openVisible, true, 'manual return must exist before the browser launch attempt')
  assert.equal(launch.openHref, urls.app)
  await page.runTimers()
  assert.ok(page.navigations.some(navigation => navigation.type === 'replace' && navigation.value === urls.fallback))
})

test('a blocked automatic launch retains the authenticated link and fragment fallback', async () => {
  const page = setup({ query: `?lang=en&state=${STATE}`, sdk: true, blockIntent: true })
  await page.signIn()
  const urls = handoffUrls(TOKEN, STATE, 'en')
  assert.equal(page.nodes.get('open').hidden, false)
  assert.equal(page.nodes.get('open').href, urls.app)
  assert.equal(page.nodes.get('retry').hidden, true, 'browser launch failure must not require Google sign-in again')
  assert.doesNotMatch(page.nodes.get('status').textContent, /could not sign in/i)
  await page.runTimers()
  assert.ok(page.navigations.some(navigation => navigation.type === 'replace' && navigation.value === urls.fallback))
  assert.equal(page.calls.length, 1)
})

test('API errors do not hand off a session and offer sign-in retry', async () => {
  for (const reply of [
    async () => response(false, { ok: false }),
    async () => response(true, { ok: false }),
    async () => response(true, { ok: true }),
    async () => { throw new Error('offline') },
  ]) {
    const page = setup({ query: `?lang=en&state=${STATE}`, sdk: true, reply })
    await page.signIn()
    assert.equal(page.nodes.get('retry').hidden, false)
    assert.equal(page.nodes.get('open').hidden, true)
    assert.match(page.nodes.get('status').textContent, /could not sign in/i)
    assert.equal(page.navigations.length, 0)
  }
})

test('valid done fragments are scrubbed while preserving the manual authenticated handoff', () => {
  const page = setup({
    page: 'done', query: '?lang=fr&token=obsolete-query-token',
    hash: `#${new URLSearchParams({ token: TOKEN, state: STATE })}`,
  })
  assert.equal(page.historyCalls.length, 1)
  assert.equal(page.location.href, 'https://verimots.example/auth-android-done.html?lang=fr')
  assert.equal(page.nodes.get('open').hidden, false)
  assert.equal(page.nodes.get('open').href, handoffUrls(TOKEN, STATE, 'fr').app)
  assertNoLogin(page)
})

test('invalid done callbacks scrub credentials and offer credential-free recovery', () => {
  for (const { query, hash } of [
    { query: `?lang=en&token=${TOKEN}&state=${STATE}`, hash: '' },
    { query: '?lang=en', hash: '' },
    { query: '?lang=en', hash: `#token=${TOKEN}&state=short` },
    { query: '?lang=en', hash: `#state=${STATE}` },
    { query: '?lang=en', hash: `#token=${'x'.repeat(8193)}&state=${STATE}` },
  ]) {
    const page = setup({ page: 'done', query, hash })
    assert.equal(page.location.href, 'https://verimots.example/auth-android-done.html?lang=en')
    assertSafeRecovery(page)
  }
})

test('handoff links bind credentials to our package and keep the fallback token out of HTTP URLs', () => {
  const token = 'token&state=forged#Intent;package=other;+/'
  const urls = handoffUrls(token, STATE, 'en')
  assert.match(urls.app, /^intent:\/\/auth\?[^#]+#Intent;scheme=verimots;package=cc\.pfa87\.verimots;end$/)
  const credentials = new URLSearchParams(urls.app.slice('intent://auth?'.length).split('#')[0])
  assert.equal(credentials.get('token'), token)
  assert.equal(credentials.get('state'), STATE)
  const fallback = new URL(urls.fallback, 'https://verimots.example')
  assert.equal(fallback.pathname, '/auth-android-done.html')
  assert.equal(fallback.search, '?lang=en')
  assert.equal(new URLSearchParams(fallback.hash.slice(1)).get('token'), token)
  assert.equal(new URLSearchParams(fallback.hash.slice(1)).get('state'), STATE)
})

test('handoff validation rejects missing, oversized, and malformed credentials', () => {
  for (const state of [null, '', 'a'.repeat(39), 'a'.repeat(129), 'a'.repeat(40) + '!']) {
    assert.equal(validState(state), false)
    assert.throws(() => handoffUrls(TOKEN, state, 'en'), /invalid_handoff/)
  }
  for (const token of [null, '', 'x'.repeat(8193)]) {
    assert.throws(() => handoffUrls(token, STATE, 'en'), /invalid_handoff/)
  }
  assert.equal(validState('a'.repeat(40)), true)
  assert.equal(validState('a'.repeat(128)), true)
})
