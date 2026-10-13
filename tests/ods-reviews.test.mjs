import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import {
  recordMiss,
  gradeReview,
  deleteReview,
  dueReviews,
  reviewCounts,
  mergeReviews,
  cleanReview,
  pruneReviews,
  reviewKey,
  REVIEW_STEPS,
  REVIEW_LIMIT,
  DAY_MS,
} from '../web/review-core.js'
import {
  handleOdsGame,
  resetGameStatsForTests,
  seedUserForTests,
  sessionCookieForTests,
  reviewFileFor,
} from '../scripts/ods-game.mjs'

const T0 = Date.UTC(2026, 9, 6, 9, 0, 0)
let seq = 0
const rnd = () => ((seq = (seq * 9301 + 49297) % 233280) / 233280)

function bingoMiss(over = {}) {
  return {
    game: 'bingo', rack: 'KOBXEUJ', lang: 'fr', dict: 'ods', edition: 'fise',
    targets: [{ w: 'JUKEBOX', p: 84 }], played: { w: 'BOXE', p: 23 }, ...over,
  }
}

test('a missed draw is due at once, with the missed word as the goal', () => {
  const { items, item } = recordMiss([], bingoMiss(), T0, rnd)
  assert.equal(items.length, 1)
  assert.equal(item.due, T0)
  assert.equal(item.step, 0)
  assert.deepEqual(item.targets, [{ w: 'JUKEBOX', p: 84 }])
  assert.deepEqual(item.played, { w: 'BOXE', p: 23 })
  assert.deepEqual(dueReviews(items, T0).map((r) => r.id), [item.id])
})

test('the same tiles in another order are the same draw; a combination keeps its preset', () => {
  const first = recordMiss([], bingoMiss(), T0, rnd)
  const again = recordMiss(first.items, bingoMiss({ rack: 'JUEXBOK', targets: [{ w: 'JUKEBOX', p: 84 }] }), T0 + 5000, rnd)
  assert.equal(again.items.length, 1)
  assert.equal(again.item.id, first.item.id)
  const combi = recordMiss(again.items, { ...bingoMiss(), game: 'combi', preset: 'seven', min: 7, max: 7 }, T0, rnd)
  assert.equal(combi.items.length, 2)
  assert.notEqual(reviewKey(combi.item), reviewKey(first.item))
})

test('spaced successes walk 1, 3, 7 and 21 days, then the draw is mastered', () => {
  let { item } = recordMiss([], bingoMiss(), T0, rnd)
  let now = T0
  for (const days of REVIEW_STEPS) {
    item = gradeReview(item, 'ok', now)
    assert.equal(item.due, now + days * DAY_MS)
    assert.equal(item.mastered, false)
    now = item.due
  }
  item = gradeReview(item, 'ok', now)
  assert.equal(item.mastered, true)
  assert.equal(item.reps, REVIEW_STEPS.length + 1)
  assert.equal(reviewCounts([item], now).mastered, 1)
  assert.equal(dueReviews([item], now + 365 * DAY_MS).length, 0)
})

test('a hint keeps the step and brings the draw back tomorrow; a shown answer starts over', () => {
  let { item } = recordMiss([], bingoMiss(), T0, rnd)
  item = gradeReview(item, 'ok', T0)
  item = gradeReview(item, 'help', item.due)
  assert.equal(item.step, 1)
  assert.equal(item.last, 'help')
  const missed = gradeReview(item, 'miss', item.due)
  assert.equal(missed.step, 0)
  assert.equal(missed.lapses, 1)
  assert.equal(missed.due, item.due + DAY_MS)
})

test('replaying before the due day never moves the schedule, but a miss still counts', () => {
  let { item } = recordMiss([], bingoMiss(), T0, rnd)
  item = gradeReview(item, 'ok', T0)
  const early = gradeReview(item, 'ok', T0 + 3600_000)
  assert.equal(early.due, item.due)
  assert.equal(early.step, item.step)
  // Due tomorrow 09:00: the end-of-day cutoff makes it ready tomorrow morning.
  const morning = item.due - 2 * 3600_000
  const ready = gradeReview(item, 'ok', morning, item.due + 3600_000)
  assert.equal(ready.step, item.step + 1)
  const lapse = gradeReview(item, 'miss', T0 + 3600_000)
  assert.equal(lapse.step, 0)
})

test('validation drops unknown games, bad racks, empty targets and caps targets at 12', () => {
  assert.equal(cleanReview({ ...bingoMiss(), id: 'abcdef1', game: 'chess' }), null)
  assert.equal(cleanReview({ ...bingoMiss(), id: 'abcdef1', rack: 'A<b>' }), null)
  assert.equal(cleanReview({ ...bingoMiss(), id: 'abcdef1', targets: [] }), null)
  assert.equal(cleanReview({ ...bingoMiss(), id: 'x' }), null)
  const many = Array.from({ length: 20 }, (_, i) => ({ w: 'MOT' + 'ABCDEFGHIJKLMNOPQRST'[i], p: i }))
  assert.equal(cleanReview({ ...bingoMiss(), id: 'abcdef1', targets: many }).targets.length, 12)
  const combi = cleanReview({ ...bingoMiss(), id: 'abcdef2', game: 'combi', rack: 'AE?RST', preset: 'joker', min: 7, max: 7, bonus: 3 })
  assert.equal(combi.rack, 'AE?RST')
  assert.equal(combi.preset, 'joker')
})

test('merge: latest change wins, deletions travel, duplicate draws collapse', () => {
  const a = recordMiss([], bingoMiss(), T0, rnd).item
  const later = gradeReview(a, 'ok', T0 + 1000)
  assert.equal(mergeReviews([a], [later])[0].step, 1)
  assert.equal(mergeReviews([later], [a])[0].step, 1)
  const gone = deleteReview([later], a.id, T0 + 2000)
  const merged = mergeReviews([later], gone)
  assert.equal(merged.filter((r) => !r.deleted).length, 0)
  assert.equal(merged.find((r) => r.id === a.id).deleted, true)
  // Two devices recorded the same draw under two ids: one survives.
  const other = recordMiss([], bingoMiss({ rack: 'XOBKEJU' }), T0 + 500, rnd).item
  assert.notEqual(other.id, a.id)
  assert.equal(mergeReviews([a], [other]).length, 1)
})

test('pruning keeps the newest misses and drops mastered draws first', () => {
  let items = []
  for (let i = 0; i < REVIEW_LIMIT + 5; i++) {
    const rack = ('ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i % 26] + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(i / 26) % 26] + 'EST').slice(0, 5)
    const made = cleanReview({ ...bingoMiss({ rack: rack + 'RA' }), id: `id${String(i).padStart(6, '0')}`, missedAt: T0 + i, updatedAt: T0 + i, mastered: i < 3 })
    items.push(made)
  }
  items = pruneReviews(items, T0 + 10_000)
  assert.equal(items.length, REVIEW_LIMIT)
  assert.equal(items.filter((r) => r.mastered).length, 0)
  assert.equal(items.some((r) => r.id === 'id000003'), false)
})

// ---- server ---------------------------------------------------------------

function jsonHelper() {
  return (res, status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(data))
  }
}

async function api(method, path, cookie, payload = null) {
  const raw = payload == null ? '' : JSON.stringify(payload)
  let sent = false
  const req = {
    method,
    headers: cookie ? { cookie } : {},
    [Symbol.asyncIterator]: async function* () {
      if (!sent && raw) {
        sent = true
        yield Buffer.from(raw)
      }
    },
  }
  let status = 0
  let body = null
  const res = { writeHead(code) { status = code }, end(data) { body = JSON.parse(data) } }
  await handleOdsGame(req, res, new URL(`http://localhost${path}`), { json: jsonHelper() })
  return { status, body }
}

test('server: Google accounts sync their list; guests and other owners are refused', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ods-reviews-'))
  try {
    resetGameStatsForTests(join(dir, 'game.json'), join(dir, 'salt.txt'), join(dir, 'board.json'), join(dir, 'auth.json'))
    seedUserForTests('irene', { name: 'Irène' })
    seedUserForTests('guest:abc123', { name: 'user100001', guest: true })
    const cookie = sessionCookieForTests('irene')
    assert.equal((await api('GET', '/api/game/reviews', null)).status, 401)
    assert.equal((await api('POST', '/api/game/reviews', sessionCookieForTests('guest:abc123'), { items: [] })).status, 403)
    assert.equal((await api('POST', '/api/game/reviews', cookie, { owner: 'bob', items: [] })).status, 409)
    assert.equal((await api('PUT', '/api/game/reviews', cookie)).status, 405)

    const phone = recordMiss([], bingoMiss(), T0, rnd).items
    const first = await api('POST', '/api/game/reviews', cookie, { owner: 'irene', items: [...phone, { id: 'bad', rack: '<script>' }] })
    assert.equal(first.status, 200)
    assert.equal(first.body.items.length, 1)
    const stored = JSON.parse(await readFile(reviewFileFor('irene'), 'utf8'))
    assert.equal(stored.items[0].targets[0].w, 'JUKEBOX')
    assert.equal(reviewFileFor('irene').includes('irene'), false)

    // A second device adds its own miss and later deletes the first one.
    const tablet = recordMiss(first.body.items, bingoMiss({ rack: 'AEINRST', targets: [{ w: 'TANIERES', p: 9 }] }), T0 + 60_000, rnd).items
    const both = await api('POST', '/api/game/reviews', cookie, { owner: 'irene', items: tablet })
    assert.equal(both.body.items.filter((r) => !r.deleted).length, 2)
    const deleted = deleteReview(both.body.items, phone[0].id, T0 + 120_000)
    await api('POST', '/api/game/reviews', cookie, { owner: 'irene', items: deleted })
    // The phone still holds the old copy: the deletion wins over it.
    const back = await api('POST', '/api/game/reviews', cookie, { owner: 'irene', items: phone })
    assert.deepEqual(back.body.items.filter((r) => !r.deleted).map((r) => r.rack), ['AEINRST'])
    const read = await api('GET', '/api/game/reviews', cookie)
    assert.equal(read.body.items.length, 2)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('server: an unreadable review file is reported, never overwritten', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ods-reviews-'))
  try {
    resetGameStatsForTests(join(dir, 'game.json'), join(dir, 'salt.txt'), join(dir, 'board.json'), join(dir, 'auth.json'))
    seedUserForTests('paul', { name: 'Paul' })
    const file = reviewFileFor('paul')
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, '{ not json')
    const out = await api('POST', '/api/game/reviews', sessionCookieForTests('paul'), { owner: 'paul', items: recordMiss([], bingoMiss(), T0, rnd).items })
    assert.equal(out.status, 500)
    assert.equal(await readFile(file, 'utf8'), '{ not json')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
