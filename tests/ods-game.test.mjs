import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  playPoints,
  letterScore,
  playScore,
  playPercent,
  formatAverage,
  formatBoardPercent,
  formatChartAverage,
  averageScore,
  boardScoreHtml,
  parseRack,
  defiShareText,
  dailyStudySlice,
  dailyStudyText,
  studyListText,
  studyWordText,
  studyDateLabel,
  lexiconFileName,
  utcDayIndex,
  extractFormOf,
  isInflectionDef,
  linkifyDef,
  topWords,
  wikiUrl,
  clampPercent,
  loadScores,
  rememberScore,
  loadTrainingStats,
  rememberTrainingRound,
  scoreChartSvg,
  usedTiles,
} from '../web/game.js'
import { loadHistory, rememberWord, historyLabel, clearHistory } from '../web/history.js'
import { kidsWords, kidsLong } from '../web/kids.js'
import { competeAccepted } from '../web/competitive.js'
import { setLang, setDict, getDict, getLang, defaultDictFor, dictLabel, t } from '../web/i18n.js'

test('rack tile usage assigns unmatched letters to blanks', () => {
  assert.deepEqual([...usedTiles('A?O', 'AÑO')].sort((a, b) => a - b), [0, 1, 2])
  assert.deepEqual([...usedTiles('AA?', 'ABA')].sort((a, b) => a - b), [0, 1, 2])
})

const dir = await mkdtemp(join(tmpdir(), 'ods9-game-'))
const {
  recordPercent,
  gameStats,
  resetGameStatsForTests,
  handleOdsGame,
  isoWeekTrailId,
  officialPlays,
  scoreOfficialPlay,
  seedUserForTests,
  sessionCookieForTests,
  mergeGoogleUserForTests,
} = await import('../scripts/ods-game.mjs')

test('score moyen uses a French decimal comma', () => {
  assert.equal(formatAverage(38.5), 'Score moyen 38,5 %')
  assert.equal(formatAverage(40), 'Score moyen 40,0 %')
  assert.equal(formatAverage(null), 'Score moyen —')
  assert.equal(formatBoardPercent(38.5), '38,5%')
  assert.equal(formatBoardPercent(100), '100,0%')
  assert.equal(formatChartAverage(38.5), '38,5')
  assert.equal(averageScore([{ p: 40 }, { p: 80 }]), 60)
  assert.equal(averageScore([{ p: 100 }, { p: 70 }, { p: 80 }]), 83.3)
  assert.equal(averageScore([]), null)
  assert.match(boardScoreHtml({ percent: 58, plays: 9 }), /58,0%/)
  assert.match(boardScoreHtml({ percent: 58, plays: 9 }), /9 mots/)
  assert.match(boardScoreHtml({ percent: 100, plays: 1 }), /100,0%/)
  assert.match(boardScoreHtml({ percent: 100, plays: 1 }), /1 mot/)
})

test('shared rack is letters only', () => {
  assert.equal(parseRack('lie-irat!'), 'LIEIRAT')
  assert.equal(parseRack('abcdefghij'), 'ABCDEFG')
  assert.equal(parseRack('año?'), 'AÑO')
})

test('WhatsApp défi does not reveal the answer', () => {
  const text = defiShareText('LIEIRAT', 19)
  assert.match(text, /L I E I R A T/)
  assert.match(text, /19 %/)
  assert.doesNotMatch(text, /AJOUREE|LITERAI|meilleur mot/i)
})

test('Kids mode is labelled Beginners', () => {
  setLang('en')
  assert.equal(t('mode_kids'), 'Beginners')
  assert.equal(t('kids_board'), 'Beginners')
  setLang('fr')
  assert.equal(t('mode_kids'), 'Débutants')
  setLang('es')
  assert.equal(t('mode_kids'), 'Principiantes')
  setLang('fr')
})

test('each language dictionary is a community list following a named source', () => {
  setLang('en')
  assert.equal(t('dict_name_ods'), 'ODS')
  assert.equal(t('dict_name_csw'), 'CSW')
  assert.equal(t('dict_name_wow24'), 'WGPO WOW24')
  assert.equal(t('dict_name_rla'), 'RLA-ES')
  assert.equal(t('dict_blurb_ods'), 'Community list following ODS.')
  assert.match(t('dict_blurb_csw'), /Closest public list following CSW/)
  assert.equal(t('dictionaries'), 'Dictionaries')
  assert.match(t('dicts_learn'), /lists in detail/)
  assert.equal(t('dict_blurb_wow24'), 'Community list following WGPO Official Words 2024.')
  assert.equal(t('dict_blurb_rla'), 'Community list following RLA-ES.')
  setLang('fr')
  assert.match(t('dict_blurb_ods'), /communautaire suivant l’ODS/)
  assert.match(t('dict_blurb_wow24'), /WGPO Official Words 2024/)
  setLang('es')
  assert.match(t('dict_blurb_ods'), /comunitaria según ODS/)
  setLang('fr')
})

test('English defaults to WGPO WOW24 and names the list everywhere', () => {
  assert.equal(defaultDictFor('en'), 'wow24')
  setDict('wow24')
  assert.equal(dictLabel(), 'WGPO WOW24')
  assert.equal(t('playable', dictLabel()), 'Playable · WGPO WOW24')
  assert.equal(t('not_in_list', dictLabel()), 'Not in WGPO WOW24')
  assert.equal(t('word_count', '195,383', dictLabel()), '195,383 words · WGPO WOW24')
  setLang('fr')
  assert.equal(dictLabel(), 'ODS9')
  assert.match(t('playable', dictLabel()), /ODS9/)
})

test('English can switch between CSW and WOW24', () => {
  setDict('wow24')
  assert.equal(getLang(), 'en')
  assert.equal(getDict(), 'wow24')
  assert.equal(lexiconFileName('wow24'), 'verimots-en-wow24.txt')
  setLang('fr')
  assert.equal(getDict(), 'ods')
  setLang('en')
  assert.equal(getDict(), 'wow24')
  setDict('csw')
  assert.equal(getDict(), 'csw')
  assert.equal(dictLabel(), 'CSW · YAWL')
  assert.equal(lexiconFileName('csw'), 'verimots-en-csw.txt')
  setDict('yawl')
  assert.equal(getDict(), 'csw')
  setLang('fr')
})

test('daily study slice is deterministic and wraps', () => {
  const list = ['AA', 'AB', 'AD', 'AE', 'AG']
  const day = new Date(2026, 7, 21)
  const a = dailyStudySlice(list, day, 3)
  assert.deepEqual(a, dailyStudySlice(list, day, 3))
  assert.equal(a.length, 3)
  assert.equal(new Set(a).size, 3)
  const next = dailyStudySlice(list, new Date(2026, 7, 22), 3)
  assert.notDeepEqual(a, next)
  assert.deepEqual(dailyStudySlice([], day, 10), [])
  assert.equal(dailyStudySlice(list, day, 8).length, 5)
  assert.equal(utcDayIndex(day), utcDayIndex(new Date(2026, 7, 21, 23, 59)))
})

test('WhatsApp study pack is compact and dated', () => {
  const when = studyDateLabel(new Date(2026, 7, 21))
  assert.equal(when, '21/08/2026')
  const daily = dailyStudyText(['AA', 'AB'], ['ACE', 'ACT'], new Date(2026, 7, 21))
  assert.match(daily, /21\/08\/2026/)
  assert.match(daily, /AA · AB/)
  assert.match(daily, /ACE · ACT/)
  const list = studyListText(['AA', 'AB', 'AD'], 2)
  assert.match(list, /2 lettres \(3\)/)
  assert.match(list, /AA · AB · AD/)
  const word = studyWordText('QI', 11, 'A vital energy.', 'https://s.pfa87.cc/?w=QI')
  assert.match(word, /\*QI est dans ODS9\*/)
  assert.match(word, /Verimots · ODS9/)
  assert.match(word, /A vital energy/)
  assert.equal(lexiconFileName('csw'), 'verimots-en-csw.txt')
  assert.equal(lexiconFileName('ods'), 'verimots-fr-ods.txt')
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

test('hyphenated lemmas stay hyphenated', () => {
  assert.equal(extractFormOf('Pluriel de savoir-faire.'), 'savoir-faire')
  assert.equal(isInflectionDef('Pluriel de savoir-faire.'), true)
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
  clearHistory(mem)
  assert.equal(loadHistory(mem).length, 0)
})

test('competition trail id is the Paris ISO week', () => {
  assert.equal(isoWeekTrailId(new Date('2026-08-18T12:00:00+02:00'), 'fr'), '2026-W34')
  assert.equal(isoWeekTrailId(new Date('2026-08-17T00:30:00+02:00'), 'fr'), '2026-W34')
  assert.equal(isoWeekTrailId(new Date('2026-08-23T23:00:00+02:00'), 'fr'), '2026-W34')
  assert.equal(isoWeekTrailId(new Date('2026-08-16T12:00:00+02:00'), 'fr'), '2026-W33')
  assert.equal(isoWeekTrailId(new Date('2026-08-18T12:00:00+02:00'), 'en'), '2026-W34-en')
  assert.equal(isoWeekTrailId(new Date('2026-08-18T12:00:00+02:00'), 'es'), '2026-W34-es')
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

test('training statistics stay separate by language and preset', () => {
  const mem = {
    data: {},
    getItem(key) {
      return this.data[key] || null
    },
    setItem(key, value) {
      this.data[key] = value
    },
  }
  rememberTrainingRound({ preset: 'seven', length: 7, solved: true, found: 3, total: 3 }, mem, 'es')
  rememberTrainingRound({ preset: 'joker', length: 7, solved: false, found: 2, total: 5, hard: 1 }, mem, 'es')
  const spanish = loadTrainingStats(mem, 'es')
  assert.equal(spanish.plays, 2)
  assert.equal(spanish.solved, 1)
  assert.equal(spanish.found, 5)
  assert.equal(spanish.byPreset.seven, 1)
  assert.equal(spanish.byPreset.joker, 1)
  assert.equal(spanish.byLength['7'], 1)
  assert.equal(spanish.hard, 1)
  assert.equal(loadTrainingStats(mem, 'fr').plays, 0)
})

test('kids scores stay on their own chart', () => {
  const mem = {
    data: {},
    getItem(k) {
      return this.data[k] || null
    },
    setItem(k, v) {
      this.data[k] = v
    },
  }
  rememberScore(40, mem)
  rememberScore(90, mem, true)
  rememberScore(70, mem, true)
  assert.deepEqual(loadScores(mem).map((r) => r.p), [40])
  assert.deepEqual(loadScores(mem, true).map((r) => r.p), [90, 70])
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

test('letter scores follow FR, EN and ES tile values', () => {
  assert.equal(letterScore('QUIZ', 'fr'), 20)
  assert.equal(letterScore('QUIZ', 'en'), 22)
  assert.equal(letterScore('WAXY', 'fr'), 31)
  assert.equal(letterScore('WAXY', 'en'), 17)
  assert.equal(letterScore('MIX', 'fr'), 13)
  assert.equal(letterScore('MIX', 'en'), 12)
  assert.equal(letterScore('K', 'fr'), 10)
  assert.equal(letterScore('K', 'en'), 5)
  assert.equal(letterScore('AÑO', 'es'), 10)
  assert.equal(letterScore('QUESO', 'es'), 9)
  assert.equal(letterScore('QUIZ', 'fr', [0]), 12)
  assert.equal(letterScore('QUIZ', 'en', [0]), 12)
})

test('game score and percent recompute when the language changes', () => {
  const whiskeyFr = playScore('WHISKEY', 'fr')
  const whiskeyEn = playScore('WHISKEY', 'en')
  const wokFr = playScore('WOK', 'fr')
  const wokEn = playScore('WOK', 'en')
  assert.equal(whiskeyFr, 87)
  assert.equal(whiskeyEn, 70)
  assert.equal(wokFr, 21)
  assert.equal(wokEn, 10)
  assert.equal(playPercent(whiskeyFr, whiskeyFr), 100)
  assert.equal(playPercent(whiskeyEn, whiskeyEn), 100)
  assert.equal(playPercent(wokFr, whiskeyFr), 24)
  assert.equal(playPercent(wokEn, whiskeyEn), 14)
  assert.notEqual(playPercent(wokFr, whiskeyFr), playPercent(wokEn, whiskeyEn))
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

test('a failed ranked submission keeps the official attempt retryable', () => {
  assert.equal(competeAccepted({ ok: true }), true)
  assert.equal(competeAccepted({ ok: false, error: 'already_submitted' }), true)
  assert.equal(competeAccepted({ ok: false, error: 'network_error' }), false)
  assert.equal(competeAccepted(null), false)
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

test('weekly adult racks include every intended filler tile', async () => {
  resetGameStatsForTests(
    join(dir, 'trail-fill.json'),
    join(dir, 'trail-fill-salt.txt'),
    join(dir, 'trail-fill-leaderboard.json'),
    join(dir, 'trail-fill-auth.json')
  )
  for (let week = 1; week <= 52; week++) {
    const trailId = `2026-W${String(week).padStart(2, '0')}`
    const { rack } = await officialPlays(trailId)
    assert.ok(
      rack.length === 4 || rack.length === 5 || rack.length === 7,
      `${trailId} generated an invalid ${rack.length}-tile rack: ${rack}`
    )
  }
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

function jsonHelper() {
  return (res, status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(data))
  }
}

function collectRes() {
  let status = 0
  let body = null
  return {
    status: () => status,
    body: () => body,
    res: {
      writeHead(code) {
        status = code
      },
      end(data) {
        body = JSON.parse(data)
      },
    },
  }
}

async function postCompete(cookie, payload) {
  const raw = JSON.stringify(payload)
  let i = 0
  const req = {
    method: 'POST',
    headers: cookie ? { cookie } : {},
    [Symbol.asyncIterator]: async function* () {
      if (i++ === 0) yield Buffer.from(raw)
    },
  }
  const out = collectRes()
  await handleOdsGame(req, out.res, new URL('http://localhost/api/game/compete'), { json: jsonHelper() })
  return out.body()
}

async function apiRequest(method, path, cookie, payload = null) {
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
  const out = collectRes()
  await handleOdsGame(req, out.res, new URL(`http://localhost${path}`), { json: jsonHelper() })
  return { status: out.status(), body: out.body() }
}

test('leaderboard stores the server score for the official weekly word', async () => {
  resetGameStatsForTests(
    join(dir, 'board-score.json'),
    join(dir, 'board-score-salt.txt'),
    join(dir, 'board-score-leaderboard.json'),
    join(dir, 'board-score-auth.json')
  )
  seedUserForTests('player-1', { name: 'Ada' })
  const cookie = sessionCookieForTests('player-1')
  const trailOut = collectRes()
  await handleOdsGame(
    { method: 'GET', headers: {} },
    trailOut.res,
    new URL('http://localhost/api/game/trail?lang=fr'),
    { json: jsonHelper() }
  )
  const trail = trailOut.body()
  const { plays } = await officialPlays(trail.trailId)
  assert.ok(plays.length >= 1)
  const best = plays[0]
  const worse = plays.find((p) => p.pts < best.pts) || best
  const scored = await scoreOfficialPlay(trail.trailId, worse.word)
  assert.equal(scored.ok, true)
  assert.equal(scored.percent, Math.min(100, Math.round((100 * worse.pts) / Math.max(1, best.pts))))

  const rejected = await postCompete(cookie, { percent: 100, word: 'ZZZZZZ', lang: 'fr' })
  assert.equal(rejected.ok, false)
  assert.equal(rejected.error, 'not_playable')

  const saved = await postCompete(cookie, { percent: 100, word: worse.word, lang: 'fr' })
  assert.equal(saved.ok, true)
  assert.equal(saved.percent, scored.percent)
  assert.equal(saved.word, worse.word)

  const boardOut = collectRes()
  await handleOdsGame(
    { method: 'GET', headers: { cookie } },
    boardOut.res,
    new URL('http://localhost/api/game/board?lang=fr'),
    { json: jsonHelper() }
  )
  const board = boardOut.body()
  assert.equal(board.top[0].percent, scored.percent)
  assert.equal(board.top[0].word, worse.word)
  assert.equal(board.me.percent, scored.percent)

  const history = await apiRequest('GET', '/api/game/history', cookie)
  const savedWord = history.body.history.find((row) => row.word === worse.word)
  assert.equal(savedWord.pts, scored.pts)

  if (worse.word !== best.word) {
    const improved = await postCompete(cookie, { percent: 100, word: best.word, lang: 'fr' })
    const mean = Math.round((10 * (scored.percent + 100)) / 2) / 10
    assert.equal(improved.ok, true)
    assert.equal(improved.plays, 2)
    assert.equal(improved.percent, mean)
  }
})

test('concurrent board reads cannot erase a ranked submission', async () => {
  resetGameStatsForTests(
    join(dir, 'board-race.json'),
    join(dir, 'board-race-salt.txt'),
    join(dir, 'board-race-leaderboard.json'),
    join(dir, 'board-race-auth.json')
  )
  seedUserForTests('racer', { name: 'Racer' })
  const cookie = sessionCookieForTests('racer')
  const trailId = isoWeekTrailId()
  const { plays } = await officialPlays(trailId)
  await Promise.all([
    postCompete(cookie, { word: plays[0].word, lang: 'fr' }),
    ...Array.from({ length: 20 }, () => apiRequest('GET', '/api/game/board?lang=fr', cookie)),
  ])
  const board = await apiRequest('GET', '/api/game/board?lang=fr', cookie)
  assert.equal(board.body.me.word, plays[0].word)
  assert.equal(board.body.top.length, 1)
})

test('english official plays use english tile values', async () => {
  resetGameStatsForTests(
    join(dir, 'board-en-score.json'),
    join(dir, 'board-en-score-salt.txt'),
    join(dir, 'board-en-score-leaderboard.json'),
    join(dir, 'board-en-score-auth.json')
  )
  const trailOut = collectRes()
  await handleOdsGame(
    { method: 'GET', headers: {} },
    trailOut.res,
    new URL('http://localhost/api/game/trail?lang=en'),
    { json: jsonHelper() }
  )
  const trail = trailOut.body()
  const { plays, lang } = await officialPlays(trail.trailId)
  assert.equal(lang, 'en')
  assert.ok(plays.length >= 1)
  for (const p of plays) {
    assert.equal(p.pts, playScore(p.word, 'en'))
  }
  const split = plays.find((p) => playScore(p.word, 'fr') !== playScore(p.word, 'en'))
  if (split) {
    assert.notEqual(split.pts, playScore(split.word, 'fr'))
  }
})

test('Spanish trail, Ñ scoring and leaderboard are language-isolated', async () => {
  resetGameStatsForTests(
    join(dir, 'board-es-score.json'),
    join(dir, 'board-es-score-salt.txt'),
    join(dir, 'board-es-score-leaderboard.json'),
    join(dir, 'board-es-score-auth.json')
  )
  seedUserForTests('spanish-player', { name: 'Ana' })
  const cookie = sessionCookieForTests('spanish-player')
  const trail = await apiRequest('GET', '/api/game/trail?lang=es', cookie)
  assert.equal(trail.status, 200)
  assert.equal(trail.body.lang, 'es')
  assert.match(trail.body.trailId, /-es$/)
  assert.match(trail.body.rack, /^[A-ZÑ]{3,7}$/)
  const { plays, lang } = await officialPlays(trail.body.trailId)
  assert.equal(lang, 'es')
  assert.ok(plays.length > 0)
  for (const play of plays) assert.equal(play.pts, playScore(play.word, 'es'))
  const accepted = await postCompete(cookie, { word: plays[0].word, lang: 'es' })
  assert.equal(accepted.ok, true)
  const spanish = await apiRequest('GET', '/api/game/board?lang=es', cookie)
  const french = await apiRequest('GET', '/api/game/board?lang=fr', cookie)
  assert.equal(spanish.body.top.length, 1)
  assert.equal(french.body.top.length, 0)
})

test('playing another language in the same week does not reset the streak', async () => {
  resetGameStatsForTests(
    join(dir, 'same-week.json'),
    join(dir, 'same-week-salt.txt'),
    join(dir, 'same-week-leaderboard.json'),
    join(dir, 'same-week-auth.json')
  )
  seedUserForTests('bilingual-player', { name: 'Sam' })
  const cookie = sessionCookieForTests('bilingual-player')
  const fr = await officialPlays(isoWeekTrailId(new Date(), 'fr'))
  const en = await officialPlays(isoWeekTrailId(new Date(), 'en'))
  assert.equal((await postCompete(cookie, { word: fr.plays[0].word, lang: 'fr' })).ok, true)
  assert.equal((await postCompete(cookie, { word: en.plays[0].word, lang: 'en' })).ok, true)
  const me = await apiRequest('GET', '/api/auth/me', cookie)
  assert.equal(me.body.user.stats.streak, 1)
  assert.equal(me.body.user.stats.plays, 2)
})

test('auth/google rejects an invalid token', async () => {
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

test('Google profile refresh preserves saved player data', async () => {
  const authFile = join(dir, 'auth-merge-db.json')
  resetGameStatsForTests(
    join(dir, 'auth-merge.json'),
    join(dir, 'auth-merge-salt.txt'),
    join(dir, 'auth-merge-leaderboard.json'),
    authFile
  )
  seedUserForTests('returning-player', {
    name: 'Old name',
    picture: 'old.png',
    history: [{ word: 'CHAT', pts: 9, src: 'defi', at: '2026-08-01T00:00:00.000Z' }],
    plays: 4,
    sumPercent: 310,
    bestPercent: 100,
    streak: 3,
    lastTrailId: '2026-W32',
  })
  await mergeGoogleUserForTests('returning-player', 'New name', 'new.png')
  const saved = JSON.parse(await readFile(authFile, 'utf8')).users['returning-player']
  assert.equal(saved.name, 'New name')
  assert.equal(saved.picture, 'new.png')
  assert.equal(saved.plays, 4)
  assert.equal(saved.sumPercent, 310)
  assert.equal(saved.bestPercent, 100)
  assert.equal(saved.streak, 3)
  assert.equal(saved.lastTrailId, '2026-W32')
  assert.deepEqual(saved.history.map((row) => row.word), ['CHAT'])
})

test('concurrent profile and history writes preserve every update', async () => {
  const authFile = join(dir, 'auth-race-db.json')
  resetGameStatsForTests(
    join(dir, 'auth-race.json'),
    join(dir, 'auth-race-salt.txt'),
    join(dir, 'auth-race-leaderboard.json'),
    authFile
  )
  seedUserForTests('history-racer', { name: 'Before' })
  const cookie = sessionCookieForTests('history-racer')
  const words = ['CHAT', 'CHIEN', 'ARBRE', 'FLEUR', 'PLAGE', 'TRAIN', 'ROUGE', 'LIVRE']
  await Promise.all([
    mergeGoogleUserForTests('history-racer', 'After', 'after.png'),
    ...words.map((word, i) =>
      apiRequest('POST', '/api/game/history', cookie, { word, pts: i + 1, src: 'defi' })
    ),
  ])
  const saved = JSON.parse(await readFile(authFile, 'utf8')).users['history-racer']
  assert.equal(saved.name, 'After')
  assert.equal(saved.picture, 'after.png')
  assert.deepEqual(new Set(saved.history.map((row) => row.word)), new Set(words))
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
  assert.ok(['bingo', 'long', 'hard'].includes(resp.category))
  if (resp.category === 'bingo' || resp.category === 'long') {
    assert.equal(resp.rack.length, 7)
  } else {
    assert.ok(resp.rack.length === 4 || resp.rack.length === 5)
  }
  assert.match(resp.rack, /^[A-Z]+$/)
})

test('english trail and board are separate from french', async () => {
  resetGameStatsForTests(
    join(dir, 'lang-split.json'),
    join(dir, 'lang-split-salt.txt'),
    join(dir, 'lang-split-leaderboard.json'),
    join(dir, 'lang-split-auth.json')
  )
  const json = (res, status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(data))
  }
  let fr
  let en
  await handleOdsGame(
    { method: 'GET', headers: {} },
    { writeHead() {}, end(data) { fr = JSON.parse(data) } },
    new URL('http://localhost/api/game/trail?lang=fr'),
    { json }
  )
  await handleOdsGame(
    { method: 'GET', headers: {} },
    { writeHead() {}, end(data) { en = JSON.parse(data) } },
    new URL('http://localhost/api/game/trail?lang=en'),
    { json }
  )
  assert.equal(fr.ok, true)
  assert.equal(en.ok, true)
  assert.equal(fr.lang, 'fr')
  assert.equal(en.lang, 'en')
  assert.match(fr.trailId, /^\d{4}-W\d{2}$/)
  assert.equal(en.trailId, fr.trailId + '-en')
  assert.notEqual(fr.rack, en.rack)

  let frBoard
  let enBoard
  await handleOdsGame(
    { method: 'GET', headers: {} },
    { writeHead() {}, end(data) { frBoard = JSON.parse(data) } },
    new URL('http://localhost/api/game/board?lang=fr'),
    { json }
  )
  await handleOdsGame(
    { method: 'GET', headers: {} },
    { writeHead() {}, end(data) { enBoard = JSON.parse(data) } },
    new URL('http://localhost/api/game/board?lang=en'),
    { json }
  )
  assert.equal(frBoard.trailId, fr.trailId)
  assert.equal(enBoard.trailId, en.trailId)
  assert.equal(frBoard.lang, 'fr')
  assert.equal(enBoard.lang, 'en')
})


test('kids weekly trail is a long easy word and a separate board', async () => {
  resetGameStatsForTests(
    join(dir, 'kids-trail.json'),
    join(dir, 'kids-trail-salt.txt'),
    join(dir, 'kids-trail-leaderboard.json'),
    join(dir, 'kids-trail-auth.json')
  )
  const json = (res, status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(data))
  }
  let fr
  await handleOdsGame(
    { method: 'GET', headers: {} },
    { writeHead() {}, end(data) { fr = JSON.parse(data) } },
    new URL('http://localhost/api/game/trail?lang=fr&kids=1'),
    { json }
  )
  assert.equal(fr.ok, true)
  assert.equal(fr.kids, true)
  assert.equal(fr.category, 'kids')
  assert.match(fr.trailId, /^\d{4}-W\d{2}-kids$/)
  assert.ok(fr.rack.length === 6 || fr.rack.length === 7)
  assert.ok(fr.seed)
  assert.equal(fr.seed.length, fr.rack.length)
  let board
  await handleOdsGame(
    { method: 'GET', headers: {} },
    { writeHead() {}, end(data) { board = JSON.parse(data) } },
    new URL('http://localhost/api/game/board?lang=fr&kids=1'),
    { json }
  )
  assert.equal(board.trailId, fr.trailId)
  assert.equal(board.kids, true)
})

test('kids competition averages later plays and rejects arbitrary racks', async () => {
  resetGameStatsForTests(
    join(dir, 'kids-update.json'),
    join(dir, 'kids-update-salt.txt'),
    join(dir, 'kids-update-leaderboard.json'),
    join(dir, 'kids-update-auth.json')
  )
  seedUserForTests('kid-1', { name: 'Lina' })
  const cookie = sessionCookieForTests('kid-1')
  const trailOut = collectRes()
  await handleOdsGame(
    { method: 'GET', headers: {} },
    trailOut.res,
    new URL('http://localhost/api/game/trail?lang=fr&kids=1'),
    { json: jsonHelper() }
  )
  const trail = trailOut.body()
  const { plays } = await officialPlays(trail.trailId)
  assert.ok(plays.length >= 1)
  const allowed = new Set(kidsWords('fr'))
  assert.ok(plays.every((play) => allowed.has(play.word)))
  for (const play of plays) assert.equal(play.pts, playScore(play.word, 'fr'))
  assert.ok(plays.some((play) => play.word === trail.seed))

  const arbitrary = await postCompete(cookie, {
    percent: 100,
    word: 'TACH',
    lang: 'fr',
    kids: true,
    rack: 'CHAT',
  })
  assert.equal(arbitrary.ok, false)
  assert.equal(arbitrary.error, 'not_playable')

  const first = plays[plays.length - 1]
  const scored = await scoreOfficialPlay(trail.trailId, first.word)
  const saved = await postCompete(cookie, {
    percent: 0,
    word: first.word,
    lang: 'fr',
    kids: true,
    rack: 'ZZZZZZZ',
  })
  assert.equal(saved.ok, true)
  assert.equal(saved.percent, scored.percent)
  const again = await postCompete(cookie, {
    percent: 0,
    word: plays[0].word,
    lang: 'fr',
    kids: true,
    rack: trail.rack,
  })
  const second = await scoreOfficialPlay(trail.trailId, plays[0].word)
  const mean = Math.round((10 * (scored.percent + second.percent)) / 2) / 10
  assert.equal(again.ok, true)
  assert.equal(again.plays, 2)
  assert.equal(again.percent, mean)

  const extraSeed = kidsLong('fr').find((word) => word !== trail.seed)
  assert.ok(extraSeed)
  const extra = await postCompete(cookie, {
    percent: 0,
    word: extraSeed,
    lang: 'fr',
    kids: true,
    rack: extraSeed,
  })
  assert.equal(extra.ok, true)
  assert.equal(extra.plays, 3)
  const boardOut = collectRes()
  await handleOdsGame(
    { method: 'GET', headers: { cookie } },
    boardOut.res,
    new URL('http://localhost/api/game/board?lang=fr&kids=1'),
    { json: jsonHelper() }
  )
  const board = boardOut.body()
  assert.equal(board.kids, true)
  assert.equal(board.me.word, extraSeed)
  assert.equal(board.me.plays, 3)
  assert.equal(board.me.percent, extra.percent)
  assert.equal(board.top[0].percent, extra.percent)
})

async function postFeedback(payload) {
  const raw = JSON.stringify(payload)
  let i = 0
  const req = {
    method: 'POST',
    headers: {},
    [Symbol.asyncIterator]: async function* () {
      if (i++ === 0) yield Buffer.from(raw)
    },
  }
  const out = collectRes()
  await handleOdsGame(req, out.res, new URL('http://localhost/api/game/feedback'), { json: jsonHelper() })
  return { status: out.status(), body: out.body() }
}

test('feedback endpoint stores a comment and rejects empty ones', async () => {
  resetGameStatsForTests(
    join(dir, 'feedback.json'),
    join(dir, 'feedback-salt.txt'),
    join(dir, 'feedback-leaderboard.json'),
    join(dir, 'feedback-auth.json')
  )
  const empty = await postFeedback({ message: 'hey' })
  assert.equal(empty.status, 400)
  const ok = await postFeedback({
    message: 'Les définitions enfants sont super.',
    email: 'player@example.com',
    lang: 'fr',
    source: 'test',
  })
  assert.equal(ok.status, 200)
  assert.equal(ok.body.ok, true)
  const trap = await postFeedback({ message: 'spam bot payload here', website: 'http://spam.example' })
  assert.equal(trap.status, 200)
  const stored = await readFile(join(dir, 'feedback.jsonl'), 'utf8')
  assert.match(stored, /définitions enfants/)
  assert.doesNotMatch(stored, /spam bot/)
})

test.after(async () => {
  await rm(dir, { recursive: true, force: true })
})
