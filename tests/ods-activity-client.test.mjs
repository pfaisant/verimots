import test from 'node:test'
import assert from 'node:assert/strict'
import { createActivityRecorder } from '../web/activity.js'

const KEY = 'verimots-activity-queue-v1'
const event = (id = 'check-1') => ({ id, category: 'checks', lang: 'fr', dict: 'ods', word: 'CHAT' })
const response = (status = 200, body = { ok: true }) => ({ status, ok: status >= 200 && status < 300, json: async () => body })
function setup(t, overrides = {}) {
  const saved = new Map()
  const state = { user: { sub: 'alice' }, online: true, time: Date.now(), sent: [], send: async () => response() }
  const recorder = createActivityRecorder({
    getUser: () => state.user,
    ensureUser: async () => state.user,
    storage: () => ({ getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) }),
    now: () => state.time, online: () => state.online,
    request: async (url, opts) => { state.sent.push({ url, ...opts, event: opts.body ? JSON.parse(opts.body) : null }); return state.send(url, opts) },
    timeoutMs: 20, ...overrides,
  })
  t.after(recorder.dispose)
  return { state, recorder, saved, rows: () => JSON.parse(saved.get(KEY) || '[]') }
}

test('a network retry preserves the event id and owner until acknowledged', async t => {
  const { state, recorder, rows } = setup(t)
  state.send = async () => { throw new Error('offline') }
  assert.equal(await recorder.record(event()), false)
  assert.equal(rows().length, 1)
  state.send = async () => response()
  assert.equal(await recorder.flush(), true)
  assert.equal(rows().length, 0)
  assert.deepEqual(state.sent.map(row => [row.event.id, row.event.owner]), [['check-1', 'alice'], ['check-1', 'alice']])
})

test('offline events remain assigned to their original account across an account switch', async t => {
  const { state, recorder, rows } = setup(t)
  state.online = false
  await recorder.record(event())
  state.user = { sub: 'bob' }
  state.online = true
  assert.equal(await recorder.flush(), false)
  assert.equal(state.sent.length, 0)
  await recorder.record(event('bob-check'))
  assert.equal(state.sent[0].event.owner, 'bob')
  assert.deepEqual(rows().map(row => row.owner), ['alice'])
  state.user = { sub: 'alice' }
  await recorder.flush()
  assert.equal(state.sent[1].event.owner, 'alice')
  assert.equal(rows().length, 0)
})

test('unknown offline visitors do not donate earlier events to a later login', async t => {
  const { state, recorder, rows } = setup(t)
  state.user = null
  state.online = false
  assert.equal(await recorder.record(event()), false)
  state.user = { sub: 'bob' }
  state.online = true
  await recorder.flush()
  assert.equal(state.sent.length, 0)
  assert.equal(rows().length, 0)
})

test('server account-change rejection retains the event instead of retrying under a different identity', async t => {
  const { state, recorder, rows } = setup(t)
  state.send = async () => response(409)
  await recorder.record(event())
  assert.equal(rows().length, 1)
  state.user = { sub: 'bob' }
  await recorder.flush()
  assert.equal(state.sent.length, 1)
})

test('permanently invalid events do not block later valid events', async t => {
  const { state, recorder, rows } = setup(t)
  state.online = false
  await recorder.record(event('invalid'))
  await recorder.record(event('valid'))
  state.online = true
  state.send = async (_, opts) => response(JSON.parse(opts.body).id === 'invalid' ? 400 : 200)
  await recorder.flush()
  assert.deepEqual(state.sent.map(row => row.event.id), ['invalid', 'valid'])
  assert.equal(rows().length, 0)
})

test('a request timeout retains the event and releases the queue for a later retry', async t => {
  const { state, recorder, rows } = setup(t)
  state.send = async (_, opts) => new Promise((resolve, reject) => {
    opts.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
  })
  assert.equal(await recorder.record(event()), false)
  assert.equal(rows().length, 1)
  state.send = async () => response()
  assert.equal(await recorder.flush(), true)
  assert.equal(rows().length, 0)
})

test('queue storage is bounded and does not replay events older than a week', async t => {
  const { state, recorder, rows } = setup(t)
  state.online = false
  for (let i = 0; i < 205; i++) await recorder.record(event(`check-${i}`))
  assert.equal(rows().length, 200)
  assert.equal(rows()[0].event.id, 'check-5')
  state.time += 8 * 86400_000
  state.online = true
  await recorder.flush()
  assert.equal(state.sent.length, 0)
})

test('existing queue reloads only after the current cookie identifies its owner', async t => {
  const { state, recorder, saved, rows } = setup(t)
  saved.set(KEY, JSON.stringify([{ owner: 'alice', event: event(), at: state.time }]))
  state.user = null
  state.send = async url => url === '/api/auth/me' ? response(200, { ok: true, user: { sub: 'alice' } }) : response()
  await recorder.flush()
  assert.deepEqual(state.sent.map(row => row.url), ['/api/auth/me', '/api/game/activity'])
  assert.equal(state.sent[1].event.owner, 'alice')
  assert.equal(rows().length, 0)
})
