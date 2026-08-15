import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  playPoints,
  formatAverage,
  parseRack,
  defiShareText,
  extractFormOf,
  isInflectionDef,
  linkifyDef,
  topWords,
  wikiUrl,
  clampPercent,
  loadScores,
  rememberScore,
  scoreChartSvg,
} from '../web/game.js'
import { loadHistory, rememberWord, historyLabel } from '../web/history.js'

const dir = await mkdtemp(join(tmpdir(), 'ods9-game-'))
const { recordPercent, gameStats, resetGameStatsForTests, handleOdsGame, seedUserForTests, sessionCookieForTests } = await import('../scripts/ods-game.mjs')

test('score moyen uses a French decimal comma', () => {
  assert.equal(formatAverage(38.5), 'Score moyen 38,5 %')
  assert.equal(formatAverage(40), 'Score moyen 40 %')
  assert.equal(formatAverage(null), 'Score moyen —')
})

test('shared rack is letters only', () => {
  assert.equal(parseRack('lie-irat!'), 'LIEIRAT')
  assert.equal(parseRack('abcdefghij'), 'ABCDEFG')
})

test('WhatsApp défi does not reveal the answer', () => {
  const text = defiShareText('LIEIRAT', 19)
  assert.match(text, /L I E I R A T/)
  assert.match(text, /19 %/)
  assert.doesNotMatch(text, /AJOUREE|LITERAI|meilleur mot/i)
})

test('top words keep the five best and still include the played word', () => {
  const catalog = [
    { word: 'LISEREZ', pts: 66 },
    { word: 'RELISEZ', pts: 66 },
    { word: 'LIEREZ', pts: 15 },
    { word: 'RELISE', pts: 6 },
    { word: 'LISERE', pts: 6 },
    { word: 'SIREZ', pts: 14 },
  ]
  const top = topWords(catalog, { word: 'RELISEZ', pts: 66 }, 5)
  assert.deepEqual(
    top.map((w) => w.word),
    ['LISEREZ', 'RELISEZ', 'LIEREZ', 'RELISE', 'LISERE']
  )
  const withMine = topWords(catalog.slice(0, 5), { word: 'SIREZ', pts: 14 }, 5)
  assert.equal(withMine.at(-1).word, 'SIREZ')
  assert.equal(withMine.length, 6)
})

test('definitions keep a Wiktionnaire URL and link content words', () => {
  assert.equal(wikiUrl('LISEREZ', 'liserer'), 'https://fr.wiktionary.org/wiki/liserer')
  const escape = (s) => String(s).replace(/&/g, '&amp;')
  const html = linkifyDef("Garnir d’un liseré ou d’un lisérage.", escape)
  assert.match(html, /data-form-of="liseré"/)
  assert.match(html, /data-form-of="lisérage"/)
  assert.doesNotMatch(html, /data-form-of="ou"/)
  const inflection = linkifyDef("Deuxième personne du pluriel de l’indicatif présent du verbe taler.", escape)
  assert.match(inflection, /data-form-of="taler"/)
  assert.doesNotMatch(inflection, /data-form-of="personne"/)
})

test('inflection glosses expose the source lemma', () => {
  assert.equal(
    extractFormOf("Deuxième personne du pluriel de l’indicatif présent du verbe taler."),
    'taler'
  )
  assert.equal(extractFormOf('Pluriel de chat.'), 'chat')
  assert.equal(extractFormOf("Sorte de table sur laquelle les bouchers débitent la viande."), '')
  assert.equal(isInflectionDef("Deuxième personne du pluriel de l’impératif du verbe taler."), true)
  assert.equal(isInflectionDef('Sorte de table sur laquelle les bouchers débitent la viande.'), false)
})

test('session history keeps unique words, newest first', () => {
  const mem = {
    data: null,
    getItem() {
      return this.data
    },
    setItem(_k, v) {
      this.data = v
    },
  }
  rememberWord({ word: 'ETAL', pts: 4, src: 'defi' }, mem)
  rememberWord({ word: 'TALEZ', pts: 14, src: 'defi' }, mem)
  rememberWord({ word: 'etal', pts: 4, src: 'defi' }, mem)
  const rows = loadHistory(mem)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].word, 'ETAL')
  assert.equal(rows[1].word, 'TALEZ')
  assert.equal(historyLabel('defi'), 'Défi')
})

test('local défi scores stay in order and clamp to 0–100', () => {
  const mem = {
    data: null,
    getItem() {
      return this.data
    },
    setItem(_k, v) {
      this.data = v
    },
  }
  assert.equal(clampPercent(140), 100)
  assert.equal(clampPercent(-4), 0)
  rememberScore(9, mem)
  rememberScore(68, mem)
  rememberScore(101, mem)
  const rows = loadScores(mem)
  assert.deepEqual(rows.map((r) => r.p), [9, 68, 100])
})

test('score chart plots each percent on a 0–100 line', () => {
  const empty = scoreChartSvg([])
  assert.match(empty, /class="axis mid"/)
  assert.doesNotMatch(empty, /class="line"/)
  const svg = scoreChartSvg([{ p: 0 }, { p: 50 }, { p: 100 }])
  assert.match(svg, /class="line"/)
  assert.match(svg, /class="area"/)
  assert.match(svg, /class="dot last"/)
  assert.match(svg, />100</)
  assert.match(svg, /M[\d.]+ 31\.0/)
  assert.match(svg, /L[\d.]+ 5\.0/)
})

test('a 7-letter play gets the bingo bonus', () => {
  assert.equal(playPoints('WHISKEY', 24), 74)
  assert.equal(playPoints('WOK', 21), 21)
  assert.equal(playPoints('', 0), 0)
})

test('game average is the mean of submitted percentages', async () => {
  resetGameStatsForTests(join(dir, 'stats.json'))
  await recordPercent(40)
  await recordPercent(80)
  const snap = await gameStats()
  assert.equal(snap.plays, 2)
  assert.equal(snap.average, 60)
})

test('game percent is clamped 0–100', async () => {
  resetGameStatsForTests(join(dir, 'clamp.json'))
  await recordPercent(140)
  await recordPercent(-10)
  const snap = await gameStats()
  assert.equal(snap.plays, 2)
  assert.equal(snap.average, 50)
})

test('daily trail generates deterministic challenges from same seed', async () => {
  resetGameStatsForTests(
    join(dir, 'trail-test.json'),
    join(dir, 'trail-salt.txt'),
    join(dir, 'trail-leaderboard.json'),
    join(dir, 'trail-auth.json')
  )
  const mockReq1 = { method: 'GET', headers: {} }
  const mockReq2 = { method: 'GET', headers: {} }
  let resp1, resp2
  const mockRes1 = {
    writeHead: () => {},
    end: (data) => { resp1 = JSON.parse(data) },
  }
  const mockRes2 = {
    writeHead: () => {},
    end: (data) => { resp2 = JSON.parse(data) },
  }
  const json = (res, status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(data))
  }
  const url1 = new URL('http://localhost/api/game/trail')
  const url2 = new URL('http://localhost/api/game/trail')
  
  await handleOdsGame(mockReq1, mockRes1, url1, { json })
  await handleOdsGame(mockReq2, mockRes2, url2, { json })
  
  assert.equal(resp1.ok, true)
  assert.equal(resp2.ok, true)
  assert.equal(resp1.trailId, resp2.trailId)
  assert.equal(resp1.rack, resp2.rack)
  assert.equal(resp1.category, resp2.category)
})

test('leaderboard returns top 50 entries', async () => {
  resetGameStatsForTests(
    join(dir, 'board-test.json'),
    join(dir, 'board-salt.txt'),
    join(dir, 'board-leaderboard.json'),
    join(dir, 'board-auth.json')
  )
  const mockReq = { method: 'GET', headers: {} }
  let resp
  const mockRes = {
    writeHead: () => {},
    end: (data) => { resp = JSON.parse(data) },
  }
  const json = (res, status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(data))
  }
  const url = new URL('http://localhost/api/game/board')
  
  await handleOdsGame(mockReq, mockRes, url, { json })
  
  assert.equal(resp.ok, true)
  assert.ok(Array.isArray(resp.top))
  assert.equal(resp.me, null)
})

test('compete endpoint rejects without session', async () => {
  resetGameStatsForTests(
    join(dir, 'compete-test.json'),
    join(dir, 'compete-salt.txt'),
    join(dir, 'compete-leaderboard.json'),
    join(dir, 'compete-auth.json')
  )
  const body = JSON.stringify({ percent: 80 })
  let bodyIndex = 0
  const mockReq = {
    method: 'POST',
    headers: {},
    [Symbol.asyncIterator]: async function* () {
      if (bodyIndex === 0) {
        bodyIndex++
        yield Buffer.from(body)
      }
    },
  }
  let resp
  const mockRes = {
    writeHead: () => {},
    end: (data) => { resp = JSON.parse(data) },
  }
  const json = (res, status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(data))
  }
  const url = new URL('http://localhost/api/game/compete')
  
  await handleOdsGame(mockReq, mockRes, url, { json })
  
  assert.equal(resp.ok, false)
  assert.equal(resp.error, 'login_required')
})

test('auth/google rejects a fake id token', async () => {
  resetGameStatsForTests(
    join(dir, 'auth-test.json'),
    join(dir, 'auth-salt.txt'),
    join(dir, 'auth-leaderboard.json'),
    join(dir, 'auth-db.json')
  )
  const body = JSON.stringify({ idToken: 'fake-token' })
  let bodyIndex = 0
  const mockReq = {
    method: 'POST',
    headers: {},
    [Symbol.asyncIterator]: async function* () {
      if (bodyIndex === 0) {
        bodyIndex++
        yield Buffer.from(body)
      }
    },
  }
  let respStatus
  let resp
  const mockRes = {
    writeHead: (status) => { respStatus = status },
    end: (data) => { resp = JSON.parse(data) },
  }
  const json = (res, status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(data))
  }
  const url = new URL('http://localhost/api/auth/google')
  
  await handleOdsGame(mockReq, mockRes, url, { json })
  
  assert.equal(respStatus, 401)
  assert.equal(resp.ok, false)
  assert.equal(resp.error, 'invalid_token')
})

test('trail generation works with real lexicon', async () => {
  resetGameStatsForTests(
    join(dir, 'trail-real.json'),
    join(dir, 'trail-real-salt.txt'),
    join(dir, 'trail-real-leaderboard.json'),
    join(dir, 'trail-real-auth.json')
  )
  const mockReq = { method: 'GET', headers: {} }
  let resp
  let respStatus
  const mockRes = {
    writeHead: (status) => { respStatus = status },
    end: (data) => { resp = JSON.parse(data) },
  }
  const json = (res, status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(data))
  }
  const url = new URL('http://localhost/api/game/trail')
  
  await handleOdsGame(mockReq, mockRes, url, { json })
  
  if (!resp.ok) {
    console.error('Trail test failed:', respStatus, resp)
  }
  assert.equal(resp.ok, true)
  assert.ok(resp.trailId)
  assert.ok(resp.rack)
  assert.ok(resp.category)
  assert.ok(resp.rack.length >= 4 && resp.rack.length <= 7)
  assert.match(resp.rack, /^[A-Z]+$/)
  assert.ok(['bingo', 'long', 'hard'].includes(resp.category))
})

test('history requires login', async () => {
  resetGameStatsForTests(
    join(dir, 'hist-anon.json'),
    join(dir, 'hist-anon-salt.txt'),
    join(dir, 'hist-anon-board.json'),
    join(dir, 'hist-anon-auth.json')
  )
  let resp
  const json = (res, status, data) => {
    resp = { status, ...data }
  }
  await handleOdsGame({ method: 'GET', headers: {} }, { writeHead() {}, end() {} }, new URL('http://localhost/api/game/history'), { json })
  assert.equal(resp.ok, false)
  assert.equal(resp.error, 'login_required')
})

test('signed-in history stores a word and returns stats', async () => {
  resetGameStatsForTests(
    join(dir, 'hist-user.json'),
    join(dir, 'hist-user-salt.txt'),
    join(dir, 'hist-user-board.json'),
    join(dir, 'hist-user-auth.json')
  )
  seedUserForTests('user-1', { name: 'Ada' })
  const cookie = sessionCookieForTests('user-1')
  const body = JSON.stringify({ word: 'CHER', pts: 9, src: 'dico' })
  let bodyIndex = 0
  let resp
  const json = (res, status, data) => {
    resp = data
  }
  await handleOdsGame(
    {
      method: 'POST',
      headers: { cookie },
      [Symbol.asyncIterator]: async function* () {
        if (bodyIndex++ === 0) yield Buffer.from(body)
      },
    },
    { writeHead() {}, end() {} },
    new URL('http://localhost/api/game/history'),
    { json }
  )
  assert.equal(resp.ok, true)
  assert.equal(resp.history[0].word, 'CHER')
  assert.equal(resp.stats.words, 1)
})

test.after(async () => {
  await rm(dir, { recursive: true, force: true })
})
