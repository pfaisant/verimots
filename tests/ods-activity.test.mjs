import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  handleOdsGame, resetGameStatsForTests, seedUserForTests,
  sessionCookieForTests, adoptGuestForTests, seedLeaderboardForTests, isoWeekTrailId, boardDateRange,
} from '../scripts/ods-game.mjs'

const dir = await mkdtemp(join(tmpdir(), 'ods-activity-'))
after(() => rm(dir, { recursive: true, force: true }))
let fixture = 0
let authFile

function reset() {
  const prefix = join(dir, String(++fixture))
  authFile = `${prefix}-auth.json`
  resetGameStatsForTests(`${prefix}-stats.json`, `${prefix}-salt`, `${prefix}-boards.json`, authFile)
}

async function request(method, path, sub = null, body = null) {
  let status, payload, responseHeaders
  const req = {
    method,
    headers: sub ? { cookie: sessionCookieForTests(sub) } : {},
    async *[Symbol.asyncIterator]() {
      if (body !== null) yield Buffer.from(JSON.stringify(body))
    },
  }
  const res = {
    writeHead(code, headers) { status = code; responseHeaders = headers },
    end(raw) { payload = raw ? JSON.parse(raw) : null },
  }
  const json = (target, code, data, headers = {}) => {
    target.writeHead(code, headers)
    target.end(JSON.stringify(data))
  }
  assert.equal(await handleOdsGame(req, res, new URL(path, 'http://localhost'), { json }), true)
  return { status, body: payload, headers: responseHeaders }
}

const activity = (sub, overrides = {}) => request('POST', '/api/game/activity', sub, {
  id: 'event-1', category: 'checks', lang: 'fr', word: 'CHAT', ...overrides,
})

test('activity requires a valid session and validates categories, ids, language and dictionary words', async () => {
  reset()
  seedUserForTests('alice')
  assert.equal((await activity(null)).status, 401)
  assert.equal((await activity('missing')).status, 401)
  assert.equal((await activity('alice', { owner: 'another-account' })).status, 409)
  assert.equal((await request('GET', '/api/game/activity', 'alice')).status, 405)
  for (const body of [
    { category: 'invented' }, { lang: 'xx' }, { id: '' }, { id: '<bad>' },
    { word: 'CHAT!!!' }, { word: 'ZZZZZZZZZZZZZZZ' },
  ]) {
    assert.equal((await activity('alice', body)).status, 400, JSON.stringify(body))
  }
  const board = await request('GET', '/api/game/board?category=checks&lang=any&scope=all')
  assert.equal(board.body.total, 0)
  assert.equal((await request('GET', '/api/game/board?category=invented')).status, 400)
})

test('valid check counters are retry safe, language scoped and independent from history', async () => {
  reset()
  seedUserForTests('alice', { name: 'Alice' })
  assert.equal((await activity('alice')).body.count, 1)
  assert.equal((await activity('alice')).body.duplicate, true)
  assert.equal((await activity('alice', { id: 'event-2' })).body.count, 2)
  assert.equal((await activity('alice', { id: 'event-en', lang: 'en', word: 'CAT' })).status, 200)
  await request('DELETE', '/api/game/history', 'alice')
  for (const scope of ['day', 'week', 'all']) {
    const board = (await request('GET', `/api/game/board?category=checks&lang=any&scope=${scope}`, 'alice')).body
    assert.equal(board.unit, 'words')
    assert.equal(board.category, 'checks')
    assert.equal(board.total, 2)
    assert.deepEqual(board.mine.map((row) => [row.lang, row.count]), [['fr', 2], ['en', 1]])
    assert.equal(board.me.count, 2)
    assert.equal(board.top[0].pseudo, 'Alice')
    assert.ok(board.trackingSince)
    assert.doesNotMatch(JSON.stringify(board), /"sub"|"word"|"history"|CHAT|event-1/)
  }
  const me = await request('GET', '/api/auth/me', 'alice')
  assert.equal(me.body.user.stats.words, 0)
  assert.equal(me.body.user.stats.checks, 3)
  const stored = JSON.parse(await readFile(authFile, 'utf8')).users.alice
  assert.equal(stored.activity.totals.checks.fr.count, 2)
  assert.doesNotMatch(JSON.stringify(stored.activity), /CHAT|event-1/)
})

test('find and training accept only formable words, once per round even with a new event id', async () => {
  reset()
  seedUserForTests('alice')
  const base = { category: 'find', rack: 'CHATS', roundId: 'round-1' }
  assert.equal((await activity('alice', { category: 'find' })).body.error, 'invalid_round')
  assert.equal((await activity('alice', { ...base, rack: 'BEBE' })).body.error, 'word_not_on_rack')
  assert.equal((await activity('alice', base)).body.count, 1)
  assert.equal((await activity('alice', { ...base, id: 'second-id' })).body.duplicate, true)
  assert.equal((await activity('alice', { ...base, id: 'third-id', word: 'CHATS' })).body.count, 2)
  const changedRack = await activity('alice', { ...base, id: 'fourth-id', rack: 'CHIENS', word: 'CHIEN' })
  assert.equal(changedRack.body.error, 'round_rack_changed')
  assert.equal((await activity('alice', { ...base, id: 'fifth-id', roundId: 'round-2' })).body.count, 3)
  assert.equal((await activity('alice', { ...base, id: 'sixth-id', category: 'training' })).body.count, 1)
  const find = await request('GET', '/api/game/board?category=find&lang=fr&scope=all', 'alice')
  const training = await request('GET', '/api/game/board?category=training&lang=fr&scope=all', 'alice')
  assert.equal(find.body.me.count, 3)
  assert.equal(training.body.me.count, 1)
  const me = await request('GET', '/api/auth/me', 'alice')
  assert.equal(me.body.user.stats.findWords, 3)
  assert.equal(me.body.user.stats.trainingWords, 1)
  assert.equal(me.body.user.stats.points, 0, 'practice must not fabricate ranked Bingo points')
})

test('activity verifies displayed Spanish and Catalan tiles and blanks', async () => {
  reset()
  seedUserForTests('alice')
  for (const [id, lang, word, rack] of [
    ['es', 'es', 'AÑO', '?ÑO'],
    ['es-digraph', 'es', 'CHICO', 'CHICO'],
    ['ca', 'ca', 'COL·LEGI', 'COL·LEGI'],
  ]) {
    const out = await activity('alice', { id, category: 'find', lang, word, rack, roundId: id })
    assert.equal(out.status, 200, `${word}: ${JSON.stringify(out.body)}`)
  }
})

test('activity follows the selected English dictionary and Spanish tile edition', async () => {
  reset()
  seedUserForTests('alice')
  assert.equal((await activity('alice', { id: 'wow', lang: 'en', dict: 'wow24', word: 'ACAI' })).status, 200)
  assert.equal((await activity('alice', { id: 'csw-no', lang: 'en', dict: 'csw', word: 'ACAI' })).body.error, 'word_not_in_dictionary')
  assert.equal((await activity('alice', { id: 'csw', lang: 'en', dict: 'csw', word: 'ABAC' })).status, 200)
  assert.equal((await activity('alice', { id: 'wrong-lang', lang: 'fr', dict: 'wow24' })).body.error, 'invalid_dictionary')
  assert.equal((await activity('alice', { id: 'wrong-dict', dict: '__proto__' })).body.error, 'invalid_dictionary')
  // A lookup can be valid even when the chosen tile set cannot form the word.
  assert.equal((await activity('alice', { id: 'lookup-k', lang: 'es', word: 'BIKINI' })).status, 200)
  const spanish = { category: 'find', lang: 'es', word: 'BIKINI', rack: 'BIKINI', roundId: 'spanish-round' }
  assert.equal((await activity('alice', { ...spanish, id: 'fise' })).body.error, 'invalid_rack')
  assert.equal((await activity('alice', { ...spanish, id: 'na', edition: 'na' })).status, 200)
  // CH consumes one FISE tile, but two North-American tiles.
  const digraph = { category: 'find', lang: 'es', word: 'CHICO', rack: 'C·HICO', roundId: 'digraph-round' }
  assert.equal((await activity('alice', { ...digraph, id: 'fise-ch' })).body.error, 'word_not_on_rack')
  assert.equal((await activity('alice', { ...digraph, id: 'na-ch', edition: 'na' })).status, 200)
})

test('concurrent activity events and duplicate retries preserve all increments', async () => {
  reset()
  seedUserForTests('alice')
  const results = await Promise.all(Array.from({ length: 40 }, (_, i) => activity('alice', { id: `check-${i % 20}` })))
  assert.equal(results.filter((out) => !out.body.duplicate).length, 20)
  const board = await request('GET', '/api/game/board?category=checks&lang=fr&scope=all', 'alice')
  assert.equal(board.body.me.count, 20)
  const stored = JSON.parse(await readFile(authFile, 'utf8')).users.alice
  assert.equal(stored.activity.totals.checks.fr.count, 20)
})

test('activity all-time totals include earlier days while today and this week stay current', async () => {
  reset()
  const oldStamp = '2020-01-01T12:00:00.000Z'
  seedUserForTests('alice', { activity: {
    version: 1, startedAt: oldStamp,
    totals: { checks: { fr: { count: 12, timestamp: oldStamp } } },
    days: { '2020-01-01': { checks: { fr: { count: 12, timestamp: oldStamp } } } }, recent: [],
  } })
  for (const scope of ['day', 'week']) {
    assert.equal((await request('GET', `/api/game/board?category=checks&lang=fr&scope=${scope}`, 'alice')).body.total, 0)
  }
  await activity('alice')
  for (const scope of ['day', 'week']) {
    assert.equal((await request('GET', `/api/game/board?category=checks&lang=fr&scope=${scope}`, 'alice')).body.me.count, 1)
  }
  assert.equal((await request('GET', '/api/game/board?category=checks&lang=fr&scope=all', 'alice')).body.me.count, 13)
})

test('a player outside the first 100 rows still gets their own activity standing', async () => {
  reset()
  const stamp = '2026-09-01T10:00:00.000Z'
  for (let i = 0; i < 105; i++) seedUserForTests(`player-${i}`, {
    name: `Player ${i}`, activity: {
      version: 1, startedAt: stamp, totals: { checks: { fr: { count: 200 - i, timestamp: stamp } } }, days: {}, recent: [],
    },
  })
  const board = (await request('GET', '/api/game/board?category=checks&lang=fr&scope=all', 'player-104')).body
  assert.equal(board.total, 105)
  assert.equal(board.top.length, 100)
  assert.equal(board.me.rank, 105)
  assert.equal(board.me.count, 96)
})

test('Google adoption retains both account and guest activity, including retry keys', async () => {
  reset()
  seedUserForTests('guest:device', { guest: true, name: 'Guest' })
  seedUserForTests('google', { name: 'Alice' })
  await activity('guest:device', { id: 'guest-check' })
  await activity('google', { id: 'account-check' })
  assert.equal(await adoptGuestForTests('guest:device', 'google', 'Alice'), true)
  const board = (await request('GET', '/api/game/board?category=checks&lang=fr&scope=all', 'google')).body
  assert.equal(board.total, 1)
  assert.equal(board.me.count, 2)
  assert.equal(board.me.pseudo, 'Alice')
  assert.equal((await activity('google', { id: 'guest-check' })).body.duplicate, true)
  assert.equal((await activity('guest:device', { id: 'late-check' })).status, 401)
})

test('existing Bingo query parameters remain compatible with named categories', async () => {
  reset()
  const bingo = (await request('GET', '/api/game/board?lang=fr')).body
  assert.equal(bingo.category, 'bingo')
  assert.equal(bingo.unit, 'points')
  assert.equal(bingo.total, 0)
  const legacyKids = (await request('GET', '/api/game/board?lang=fr&kids=1')).body
  const namedKids = (await request('GET', '/api/game/board?lang=fr&category=kids')).body
  assert.deepEqual(legacyKids, namedKids)
  assert.equal(namedKids.category, 'kids')
  assert.equal(namedKids.kids, true)
})

test('combined board sums all five activity types without adding ranked points', async () => {
  reset()
  const stamp = new Date().toISOString()
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date())
  const week = isoWeekTrailId()
  const categories = {
    checks: { fr: { count: 2, timestamp: stamp }, en: { count: 1, timestamp: stamp } },
    find: { fr: { count: 1, timestamp: stamp } },
    training: { fr: { count: 2, timestamp: stamp } },
  }
  seedUserForTests('alice', { name: 'Alice', activity: { version: 1, startedAt: stamp, totals: categories, days: { [day]: categories }, recent: [] } })
  seedUserForTests('bob', { name: 'Bob' })
  seedLeaderboardForTests(week, [
    { sub: 'alice', pseudo: 'Old Alice', plays: 5, sumPercent: 490, timestamp: stamp, days: { [day]: { plays: 2, sumPercent: 200, timestamp: stamp } } },
    { sub: 'bob', pseudo: 'Bob', plays: 1, sumPercent: 100, timestamp: stamp, days: { [day]: { plays: 1, timestamp: stamp } } },
  ])
  seedLeaderboardForTests(`${week}-kids`, [{ sub: 'alice', pseudo: 'Alice', plays: 3, sumPercent: 300, timestamp: stamp, days: { [day]: { plays: 1, timestamp: stamp } } }])
  seedLeaderboardForTests(`${week}-en`, [{ sub: 'alice', pseudo: 'Alice', plays: 2, sumPercent: 200, timestamp: stamp, days: { [day]: { plays: 2, timestamp: stamp } } }])
  const board = (await request('GET', '/api/game/board?category=combined&lang=any&scope=all', 'alice')).body
  assert.equal(board.category, 'combined')
  assert.equal(board.unit, 'activities')
  assert.equal(board.total, 3)
  assert.deepEqual(board.top.map(row => [row.pseudo, row.lang, row.count]), [['Alice', 'fr', 13], ['Alice', 'en', 3], ['Bob', 'fr', 1]])
  assert.deepEqual(board.me.breakdown, { checks: 2, find: 1, training: 2, bingo: 5, kids: 3 })
  assert.equal(board.me.unit, 'activities')
  assert.equal(board.mine.length, 2)
  assert.doesNotMatch(JSON.stringify(board), /"sub"|"points"|"percent"|"history"/)
  const weekBoard = (await request('GET', '/api/game/board?category=combined&lang=fr&scope=week', 'alice')).body
  assert.equal(weekBoard.me.count, 13)
  assert.equal(weekBoard.total, 2)
  const daily = (await request('GET', '/api/game/board?category=combined&lang=fr&scope=day', 'alice')).body
  assert.equal(daily.me.count, 8)
  assert.deepEqual(daily.me.breakdown, { checks: 2, find: 1, training: 2, bingo: 2, kids: 1 })
  assert.equal((await activity('alice', { category: 'combined' })).status, 400, 'clients cannot post a fabricated combined total')
})

test('combined all-time includes recorded legacy games without fabricating their daily activity', async () => {
  reset()
  const stamp = new Date().toISOString()
  const week = isoWeekTrailId()
  seedUserForTests('alice', { name: 'Alice' })
  seedLeaderboardForTests('2020-W01', [{ sub: 'alice', pseudo: 'Alice', plays: 10, sumPercent: 950, timestamp: '2020-01-02T12:00:00.000Z' }])
  seedLeaderboardForTests('2020-W01-kids', [{ sub: 'alice', pseudo: 'Alice', plays: 7, sumPercent: 600, timestamp: '2020-01-02T12:00:00.000Z' }])
  seedLeaderboardForTests('2020-01-01', [{ sub: 'alice', pseudo: 'Alice', plays: 4, sumPercent: 400, timestamp: '2020-01-01T12:00:00.000Z' }])
  seedLeaderboardForTests(week, [{ sub: 'alice', pseudo: 'Alice', plays: 9, sumPercent: 900, timestamp: stamp }])
  const all = (await request('GET', '/api/game/board?category=combined&lang=fr&scope=all', 'alice')).body
  assert.equal(all.me.count, 30)
  assert.deepEqual(all.me.breakdown, { checks: 0, find: 0, training: 0, bingo: 23, kids: 7 })
  assert.equal(all.trackingSince, null, 'untracked history is not assigned a made-up start date')
  const current = (await request('GET', '/api/game/board?category=combined&lang=fr&scope=week', 'alice')).body
  assert.equal(current.me.count, 9)
  const daily = (await request('GET', '/api/game/board?category=combined&lang=fr&scope=day', 'alice')).body
  assert.equal(daily.me, null)
  assert.equal(daily.total, 0)
})

test('combined reads remain consistent during concurrent check and Bingo writes', { timeout: 5000 }, async () => {
  reset()
  seedUserForTests('alice', { name: 'Alice' })
  await Promise.all([
    activity('alice'),
    request('POST', '/api/game/compete', 'alice', { lang: 'fr', pass: true }),
    ...Array.from({ length: 20 }, () => request('GET', '/api/game/board?category=combined&lang=any&scope=all', 'alice')),
  ])
  const board = (await request('GET', '/api/game/board?category=combined&lang=fr&scope=all', 'alice')).body
  assert.equal(board.me.count, 2)
  assert.deepEqual(board.me.breakdown, { checks: 1, find: 0, training: 0, bingo: 1, kids: 0 })
})


test('rolling board dates include today in Paris and survive DST and year boundaries', () => {
  assert.deepEqual(boardDateRange('7d', new Date('2026-03-29T22:30:00Z')), { start: '2026-03-24', end: '2026-03-30' })
  assert.deepEqual(boardDateRange('30d', new Date('2026-01-01T00:00:00Z')), { start: '2025-12-03', end: '2026-01-01' })
})

test('rolling filters cover every category, include boundary dates and exclude old/future days', async () => {
  reset()
  const today = boardDateRange('30d').end
  const dateAt = offset => {
    const d = new Date(`${today}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() - offset)
    return d.toISOString().slice(0, 10)
  }
  const activityDays = {}, weeks = new Map()
  for (const offset of [0, 6, 7, 29, 30, -1]) {
    const date = dateAt(offset), timestamp = `${date}T12:00:00Z`
    activityDays[date] = Object.fromEntries(['checks','find','training'].map(category => [category, { fr: { count: 1, timestamp } }]))
    const week = isoWeekTrailId(new Date(timestamp))
    const days = weeks.get(week) || {}
    days[date] = { plays: 1, sumPercent: 80, percent: 80, timestamp }
    weeks.set(week, days)
  }
  seedUserForTests('alice', { name: 'Alice', activity: { version: 1, startedAt: `${dateAt(30)}T12:00:00Z`, totals: {}, days: activityDays, recent: [] } })
  for (const [week, days] of weeks) {
    for (const suffix of ['', '-kids']) seedLeaderboardForTests(week + suffix, [{ sub: 'alice', pseudo: 'Alice', plays: Object.keys(days).length, sumPercent: Object.keys(days).length * 80, days }])
  }
  for (const [scope, expected] of [['7d',2],['30d',4]]) {
    for (const category of ['checks','find','training','bingo','kids','combined']) {
      for (const lang of ['fr','any']) {
        const { status, body } = await request('GET', `/api/game/board?category=${category}&lang=${lang}&scope=${scope}`, 'alice')
        assert.equal(status,200)
        assert.equal(body.scope,scope)
        assert.equal(body.total,1)
        assert.equal(body.me[category==='bingo'||category==='kids'?'plays':'count'],category==='combined'?expected*5:expected, `${scope}/${category}/${lang}`)
        if(category==='bingo'||category==='kids') assert.equal(body.me.points,expected*80)
      }
    }
  }
})

test('rolling ranked filters keep language standings separate and do not guess dates for legacy aggregates', async () => {
  reset()
  const timestamp = new Date().toISOString(), day = boardDateRange('7d').end
  const week = isoWeekTrailId(new Date())
  seedUserForTests('alice')
  seedLeaderboardForTests(week, [{ sub:'alice',pseudo:'Alice',plays:1,percent:60,timestamp },{ sub:'legacy',pseudo:'Legacy',plays:4,sumPercent:400,timestamp }])
  seedLeaderboardForTests(`${week}-en`, [{sub:'alice',pseudo:'Alice',plays:2,sumPercent:180,days:{[day]:{plays:2,sumPercent:180,timestamp}}}])
  const {body} = await request('GET','/api/game/board?category=bingo&lang=any&scope=7d','alice')
  assert.equal(body.total,2)
  assert.deepEqual(body.mine.map(row=>row.lang),['en','fr'])
  assert.deepEqual(body.mine.map(row=>row.points),[180,60])
})
