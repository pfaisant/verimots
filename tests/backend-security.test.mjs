import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { createHmac } from 'node:crypto'
import { clientIp, createRateLimiter, isCrossOriginMutation } from '../scripts/http-safety.mjs'
import {
  handleOdsGame, resetGameStatsForTests, seedUserForTests, sessionCookieForTests,
  recordPercent, gameStats, isoWeekTrailId, seedLeaderboardForTests,
  mergeGoogleUserForTests, adoptGuestForTests, officialPlays,
} from '../scripts/ods-game.mjs'
import { createVerimotsServer } from '../scripts/serve.mjs'

const dir = await mkdtemp(join(tmpdir(), 'verimots-security-'))
let counter = 0
let paths

test.beforeEach(() => {
  const prefix = join(dir, String(++counter))
  paths = { stats: prefix + '.json', salt: prefix + '-salt.txt', board: prefix + '-board.json', auth: prefix + '-auth.json' }
  resetGameStatsForTests(paths.stats, paths.salt, paths.board, paths.auth)
})
test.after(() => rm(dir, { recursive: true, force: true }))

async function request(path, { method = 'GET', cookie, body, headers = {} } = {}) {
  let status, result, responseHeaders
  const raw = body === undefined ? '' : JSON.stringify(body)
  const req = {
    method, headers: { ...(cookie ? { cookie } : {}), ...headers },
    async *[Symbol.asyncIterator]() { if (raw) yield Buffer.from(raw) },
  }
  await handleOdsGame(req, {}, new URL(path, 'http://localhost'), {
    json(_res, code, data, extra) { status = code; result = data; responseHeaders = extra },
  })
  return { status, body: result, headers: responseHeaders }
}

function signedPayload(value) {
  const payload = JSON.stringify(value)
  return Buffer.from(payload).toString('base64url') + '.' + createHmac('sha256', 'test-session-secret').update(payload).digest('hex')
}

test('session cookies require an exact name and reject duplicate/extended tokens', async () => {
  seedUserForTests('ada')
  const cookie = sessionCookieForTests('ada')
  assert.equal((await request('/api/auth/me', { cookie })).status, 200)
  for (const invalid of ['prefix_' + cookie, cookie + '.ignored', cookie + '; ' + cookie]) {
    assert.equal((await request('/api/auth/me', { cookie: invalid })).status, 401)
  }
})

test('signed sessions require a finite future expiry and string subject', async () => {
  seedUserForTests('ada')
  for (const value of [{ sub: 'ada' }, { sub: 'ada', exp: 'never' }, { sub: 'ada', exp: Date.now() - 1 }, { sub: { toString: 'ada' }, exp: Date.now() + 60_000 }]) {
    assert.equal((await request('/api/auth/me', { cookie: 'ods9_session=' + signedPayload(value) })).status, 401)
  }
})

test('logout revokes the token on disk while a new session remains valid', async () => {
  const guest = await request('/api/auth/guest', { method: 'POST' })
  const cookie = 'ods9_session=' + guest.body.sessionToken
  const sibling = sessionCookieForTests(guest.body.user.sub)
  const result = await request('/api/auth/logout', { method: 'POST', cookie })
  assert.equal(result.status, 200)
  assert.match(result.headers['Set-Cookie'], /Max-Age=0/)
  assert.equal((await request('/api/auth/me', { cookie })).status, 401)
  assert.equal((await request('/api/auth/me', { cookie: sibling })).status, 200)
  const saved = JSON.parse(await readFile(paths.auth, 'utf8'))
  assert.equal(Object.keys(saved.revokedSessions).length, 1)
  assert.ok(!JSON.stringify(saved.revokedSessions).includes(guest.body.sessionToken))
})

test('cross-site mutations are rejected before creating accounts or writing scores', async () => {
  const rejected = await request('/api/auth/guest', { method: 'POST', headers: { origin: 'https://example.org' } })
  assert.equal(rejected.status, 403)
  assert.equal((await request('/api/auth/guest', { method: 'POST', headers: { origin: 'http://localhost' } })).status, 200)
  assert.equal(isCrossOriginMutation({ method: 'POST', headers: { 'sec-fetch-site': 'cross-site' } }, new URL('http://localhost')), true)
})

test('client IP headers are only trusted behind the configured proxy', () => {
  assert.equal(clientIp({ headers: { 'x-forwarded-for': '1.2.3.4' }, socket: { remoteAddress: '203.0.113.2' } }), '203.0.113.2')
  assert.equal(clientIp({ headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }, socket: { remoteAddress: '127.0.0.1' } }), '1.2.3.4')
  assert.equal(clientIp({ headers: { 'cf-connecting-ip': 'attacker-selected-name' }, socket: { remoteAddress: '127.0.0.1' } }), '127.0.0.1')
})

test('rate limiter caps both attempts and unique keys, and recovers after expiry', () => {
  const allow = createRateLimiter(2, 100, 2)
  assert.equal(allow('a', 0), true)
  assert.equal(allow('a', 1), true)
  assert.equal(allow('a', 2), false)
  assert.equal(allow('b', 2), true)
  assert.equal(allow('c', 3), false)
  assert.equal(allow('c', 103), true)
})

test('ranked mutations are rate limited per account', async () => {
  seedUserForTests('fast')
  const cookie = sessionCookieForTests('fast')
  for (let i = 0; i < 30; i++) assert.equal((await request('/api/game/compete', { method: 'POST', cookie, body: { pass: true } })).status, 200)
  assert.equal((await request('/api/game/compete', { method: 'POST', cookie, body: { pass: true } })).status, 429)
  const board = await request('/api/game/board', { cookie })
  assert.equal(board.body.me.plays, 30)
})

test('JSON endpoints reject scalar and array bodies', async () => {
  seedUserForTests('ada')
  const cookie = sessionCookieForTests('ada')
  for (const body of [null, [], 'hello', 1]) {
    assert.equal((await request('/api/game/history', { method: 'POST', cookie, body })).status, 400)
    assert.equal((await request('/api/game/score', { method: 'POST', body })).status, 400)
  }
})

test('statistics reject coercion and preserve concurrent submissions on disk', async () => {
  for (const value of [null, '', true, '90', Infinity, NaN]) await assert.rejects(recordPercent(value))
  const writes = await Promise.allSettled(Array.from({ length: 20 }, () => recordPercent(25)))
  for (const result of writes) assert.equal(result.status, 'fulfilled', result.reason?.message)
  assert.equal((await gameStats()).plays, 20)
  assert.equal((await gameStats()).average, 25)
  const stored = JSON.parse(await readFile(paths.stats, 'utf8'))
  assert.equal(stored.plays, 20)
  assert.equal(stored.sumPercent, 500)
})

test('failed statistics persistence does not count a play or poison later saves', async () => {
  await mkdir(paths.stats)
  await assert.rejects(recordPercent(100))
  assert.equal((await gameStats()).plays, 0)
  await rm(paths.stats, { recursive: true })
  await recordPercent(20)
  assert.equal((await gameStats()).plays, 1)
})

test('parallel first trails share the same persisted salt and generated rack', async () => {
  const [a, b, c] = await Promise.all([officialPlays(isoWeekTrailId()), officialPlays(isoWeekTrailId()), officialPlays(isoWeekTrailId(new Date(), 'en'))])
  assert.equal(a.rack, b.rack)
  assert.deepEqual(a.plays, b.plays)
  assert.ok(c.rack.length > 0)
  assert.match((await readFile(paths.salt, 'utf8')).trim(), /^[a-f0-9]{64}$/)
})

test('prototype property board IDs return an empty board instead of throwing', async () => {
  for (const id of ['__proto__', 'constructor', 'toString']) {
    const result = await request('/api/game/board?trailId=' + id)
    assert.equal(result.status, 200)
    assert.deepEqual(result.body.top, [])
  }
})

test('daily boards do not fabricate scores from a multi-play weekly aggregate', async () => {
  seedLeaderboardForTests(isoWeekTrailId(), [{ sub: 'a', pseudo: 'A', plays: 40, sumPercent: 3200, timestamp: new Date().toISOString() }])
  const day = await request('/api/game/board?scope=day')
  assert.deepEqual(day.body.top, [])
  const week = await request('/api/game/board')
  assert.equal(week.body.top[0].plays, 40)
})

test('guest adoption merges games and totals into an existing account once', async () => {
  const guest = await request('/api/auth/guest', { method: 'POST' })
  const guestCookie = 'ods9_session=' + guest.body.sessionToken
  await mergeGoogleUserForTests('google:ada', 'Ada', '')
  const accountCookie = sessionCookieForTests('google:ada')
  await request('/api/game/compete', { method: 'POST', cookie: guestCookie, body: { pass: true } })
  await request('/api/game/compete', { method: 'POST', cookie: accountCookie, body: { pass: true } })
  assert.equal(await adoptGuestForTests(guest.body.user.sub, 'google:ada', 'Ada'), true)
  assert.equal(await adoptGuestForTests(guest.body.user.sub, 'google:ada', 'Ada'), false)
  const board = await request('/api/game/board', { cookie: accountCookie })
  assert.equal(board.body.top.length, 1)
  assert.equal(board.body.me.plays, 2)
  assert.equal((await request('/api/auth/me', { cookie: accountCookie })).body.user.stats.plays, 2)
  assert.equal((await request('/api/auth/me', { cookie: guestCookie })).status, 401)
})

test('activity retry ledger refuses growth without forgetting existing IDs', async () => {
  const stamp = new Date().toISOString()
  const recent = Array.from({ length: 20_000 }, (_, i) => ({ id: String(i), key: String(i), at: stamp }))
  seedUserForTests('reader', { activity: { version: 1, startedAt: stamp, totals: {}, days: {}, recent } })
  const result = await request('/api/game/activity', { method: 'POST', cookie: sessionCookieForTests('reader'), body: { category: 'checks', lang: 'fr', dict: 'ods', id: 'next', word: 'CHAT' } })
  assert.equal(result.status, 429)
  assert.equal(result.body.error, 'activity_limit')
})

test('standalone host serves app and landing, constrains paths and methods, and drains oversized JSON', async () => {
  const root = join(dir, 'host')
  await mkdir(join(root, 'web'), { recursive: true })
  await mkdir(join(root, 'landing'), { recursive: true })
  await mkdir(join(root, 'web', 'data'), { recursive: true })
  await writeFile(join(root, 'web', 'data', 'ods9.txt.gz'), gzipSync('CHAT\nCHIEN\n'))
  await writeFile(join(root, 'web', 'index.html'), 'APP')
  await writeFile(join(root, 'landing', 'index.html'), 'LANDING')
  await writeFile(join(root, 'private.txt'), 'SECRET')
  const server = createVerimotsServer({ root })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = 'http://127.0.0.1:' + server.address().port
  try {
    assert.equal(await (await fetch(base)).text(), 'APP')
    assert.equal(await (await fetch(base + '/welcome/')).text(), 'LANDING')
    const fallback = await fetch(base + '/data/ods9.txt')
    assert.equal(fallback.status, 200)
    assert.equal(await fallback.text(), 'CHAT\nCHIEN\n')
    assert.equal((await fetch(base + '/data/private.txt')).status, 404)
    const redirect = await fetch(base + '/welcome?lang=ca', { redirect: 'manual' })
    assert.equal(redirect.status, 308)
    assert.equal(redirect.headers.get('location'), '/welcome/?lang=ca')
    const head = await fetch(base, { method: 'HEAD' })
    assert.equal(await head.text(), '')
    assert.equal(head.headers.get('content-length'), '3')
    assert.equal(head.headers.get('x-content-type-options'), 'nosniff')
    assert.equal((await fetch(base, { method: 'POST' })).status, 405)
    assert.equal((await fetch(base + '/..%2fprivate.txt')).status, 403)
    assert.equal((await fetch(base + '/%ZZ')).status, 400)
    assert.equal((await fetch(base + '/.env')).status, 403)
    assert.equal((await fetch(base + '/missing.html')).status, 404)
    assert.equal((await fetch(base + '/api/game/score', { method: 'POST', body: JSON.stringify({ percent: 50, junk: 'x'.repeat(10_000) }) })).status, 400)
  } finally {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  }
})

test('Spanish FISE activity blanks cannot stand for K while NA can', async () => {
  seedUserForTests('spanish')
  const cookie = sessionCookieForTests('spanish')
  const body = { category: 'find', lang: 'es', dict: 'rla', word: 'KILO', rack: '?ILO', roundId: 'round', id: 'fise', edition: 'fise' }
  const fise = await request('/api/game/activity', { method: 'POST', cookie, body })
  assert.equal(fise.status, 400)
  assert.equal(fise.body.error, 'word_not_on_rack')
  const na = await request('/api/game/activity', { method: 'POST', cookie, body: { ...body, id: 'na', edition: 'na' } })
  assert.equal(na.status, 200)
})

test('origin validation uses Host when the embedding server parses against localhost', () => {
  const req = { method: 'POST', headers: { origin: 'https://s.pfa87.cc', host: 's.pfa87.cc' } }
  assert.equal(isCrossOriginMutation(req, new URL('http://localhost/api/auth/guest')), false)
})

test('corrupt persisted state fails closed and is never silently replaced', async () => {
  await writeFile(paths.auth, '{broken-json')
  const previous = process.env.ODS9_AUTH_DB_FILE
  process.env.ODS9_AUTH_DB_FILE = paths.auth
  try {
    const isolated = await import('../scripts/ods-game.mjs?corrupt-auth-test')
    await assert.rejects(isolated.mergeGoogleUserForTests('ada', 'Ada', ''))
    assert.equal(await readFile(paths.auth, 'utf8'), '{broken-json')
  } finally {
    if (previous === undefined) delete process.env.ODS9_AUTH_DB_FILE
    else process.env.ODS9_AUTH_DB_FILE = previous
  }
})

test('Spanish and Catalan beginner scores keep eight-tile dealt racks', async () => {
  const { kidsLong } = await import('../web/kids.js')
  const { encodeTiles } = await import('../web/tiles.js')
  const { scoreKidsPlayOnRack } = await import('../scripts/ods-game.mjs')
  seedUserForTests('beginner')
  const cookie = sessionCookieForTests('beginner')
  for (const lang of ['es', 'ca']) {
    const word = kidsLong(lang).find((word) => encodeTiles(word, lang).length === 8)
    assert.ok(word)
    const direct = await scoreKidsPlayOnRack(lang, word, word)
    assert.equal(direct.ok, true)
    const submitted = await request('/api/game/compete', { method: 'POST', cookie, body: { lang, kids: true, word, rack: word } })
    assert.equal(submitted.status, 200)
  }
})

test('history mutations reject a stale account owner without changing either account', async () => {
  seedUserForTests('bob', { history: [{ word: 'CHIEN', pts: 10, src: 'dico', at: Date.now() }] })
  const cookie = sessionCookieForTests('bob')
  const post = await request('/api/game/history', { method: 'POST', cookie, body: { owner: 'alice', word: 'CHAT' } })
  assert.equal(post.status, 409)
  const cleared = await request('/api/game/history', { method: 'DELETE', cookie, headers: { 'x-verimots-owner': 'alice' } })
  assert.equal(cleared.status, 409)
  assert.deepEqual((await request('/api/game/history', { cookie })).body.history.map((row) => row.word), ['CHIEN'])
  assert.equal((await request('/api/game/history', { method: 'DELETE', cookie, headers: { 'x-verimots-owner': 'bob' } })).status, 200)
  assert.deepEqual((await request('/api/game/history', { cookie })).body.history, [])
})

test('every service-worker shell URL is served successfully by the standalone host', async () => {
  const source = await readFile(new URL('../web/sw.js', import.meta.url), 'utf8')
  const shell = [...source.match(/const SHELL = \[([\s\S]*?)\]/)[1].matchAll(/'([^']+)'/g)].map((match) => match[1])
  const server = createVerimotsServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = 'http://127.0.0.1:' + server.address().port
  try {
    for (const path of shell) {
      const response = await fetch(new URL(path, base), { method: 'HEAD' })
      assert.equal(response.status, 200, path)
    }
  } finally {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  }
})
