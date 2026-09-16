import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const response = (status, data) => ({ status, ok: status < 400, json: async () => data })
function setup() {
  const events = [], calls = []
  const state = { reply: async () => response(200, { ok: true, user: { sub: 'alice', name: 'Alice' } }) }
  const context = vm.createContext({
    URLSearchParams, AbortController, setTimeout, clearTimeout,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail } },
    document: { dispatchEvent: event => events.push(event) },
    fetch: async (url, options) => { calls.push({ url, options }); return state.reply(url, options) },
  })
  const source = readFileSync(new URL('../web/competitive.js', import.meta.url), 'utf8')
  vm.runInContext(source.replace(/^export /gm, ''), context)
  const api = vm.runInContext('({checkSession, getCurrentUser, ensureGuestSession, submitCompete, logout})', context)
  return { api, state, calls, events }
}

test('transient session errors retain the account; an explicit 401 updates account UI', async () => {
  const { api, state, events } = setup()
  await api.checkSession()
  state.reply = async () => { throw new Error('offline') }
  assert.equal((await api.checkSession()).sub, 'alice')
  state.reply = async () => response(503, { ok: false })
  assert.equal((await api.checkSession()).sub, 'alice')
  state.reply = async () => response(401, { ok: false, error: 'not_logged_in' })
  assert.equal(await api.checkSession(), null)
  assert.equal(api.getCurrentUser(), null)
  assert.equal(events.at(-1).type, 'verimots-session')
  assert.equal(events.at(-1).detail, null)
})

test('a rejected score clears the stale account and does not repeat the write', async () => {
  const { api, state, calls } = setup()
  await api.checkSession()
  state.reply = async () => response(401, { ok: false, error: 'login_required' })
  const result = await api.submitCompete(75, 'PAIN', 'fr', { rack: 'RINPUAM', owner: 'alice' })
  assert.equal(result.error, 'login_required')
  assert.equal(api.getCurrentUser(), null)
  const scores = calls.filter(call => call.url === '/api/game/compete')
  assert.equal(scores.length, 1)
  assert.equal(JSON.parse(scores[0].options.body).owner, 'alice')
})

test('a score from another account never transfers into the new session', async () => {
  const { api, calls } = setup()
  await api.checkSession()
  const result = await api.submitCompete(75, 'PAIN', 'fr', { owner: 'bob' })
  assert.equal(result.error, 'session_changed')
  assert.equal(calls.filter(call => call.url === '/api/game/compete').length, 0)
})

test('a score request times out without retrying or signing the user out', async () => {
  const { api, state, calls } = setup()
  await api.checkSession()
  state.reply = (_, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true })
  })
  const result = await api.submitCompete(75, 'PAIN', 'fr', { timeoutMs: 10 })
  assert.equal(result.error, 'network_error')
  assert.equal(api.getCurrentUser().sub, 'alice')
  assert.equal(calls.filter(call => call.url === '/api/game/compete').length, 1)
})

test('anonymous session creation is shared between simultaneous callers', async () => {
  const { api, state, calls } = setup()
  let resolve
  state.reply = () => new Promise(done => { resolve = done })
  const a = api.ensureGuestSession(), b = api.ensureGuestSession()
  resolve(response(200, { ok: true, user: { sub: 'guest-1', guest: true } }))
  assert.equal((await a).sub, 'guest-1')
  assert.equal((await b).sub, 'guest-1')
  assert.equal(calls.length, 1)
})

test('a late session read cannot restore an account after sign-out', async () => {
  const { api, state } = setup()
  await api.checkSession()
  let resolve
  state.reply = url => url === '/api/auth/me' ? new Promise(done => { resolve = done }) : response(200, { ok: true })
  const stale = api.checkSession()
  await api.logout()
  resolve(response(200, { ok: true, user: { sub: 'alice' } }))
  assert.equal(await stale, null)
  assert.equal(api.getCurrentUser(), null)
})
