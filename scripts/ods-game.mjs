// Shared challenge stats for s.pfa87.cc — average of submitted percentages.
// Competitive mode: weekly trail (Paris ISO week), leaderboard, Google auth.
//
// New endpoints:
//   GET /api/game/trail?lang=fr|en — this week's deterministic challenge (YYYY-Www / YYYY-Www-en)
//   GET /api/game/board?lang=fr|en&trailId=… — leaderboard for that language
//   POST /api/game/compete — { percent, word, lang } ranked score (requires login)
//   GET|POST|DELETE /api/game/history — synced word history
//   POST /api/auth/google — Google Sign-In
//   GET /api/auth/me — current session
//   POST /api/auth/logout — end session
//
// WEB_CLIENT_ID defaults to the public Verimots web client. A fake idToken
// still returns 401 invalid_token. SESSION_SECRET is persisted so cookies
// survive a serve restart.

import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash, randomBytes, createHmac } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { OAuth2Client } from 'google-auth-library'

let FILE =
  process.env.ODS9_GAME_FILE ||
  join(homedir(), '.local', 'state', 'aiconglomerate', 'ods9-game.json')

let TRAIL_SALT_FILE =
  process.env.ODS9_TRAIL_SALT_FILE ||
  join(homedir(), '.local', 'state', 'aiconglomerate', 'ods9-trail-salt.txt')

let LEADERBOARD_FILE =
  process.env.ODS9_LEADERBOARD_FILE ||
  join(homedir(), '.local', 'state', 'aiconglomerate', 'ods9-leaderboard.json')

let AUTH_DB_FILE =
  process.env.ODS9_AUTH_DB_FILE ||
  join(homedir(), '.local', 'state', 'aiconglomerate', 'ods9-auth.json')

let FEEDBACK_FILE =
  process.env.ODS9_FEEDBACK_FILE ||
  join(homedir(), '.local', 'state', 'aiconglomerate', 'ods9-feedback.jsonl')
const FEEDBACK_TO = process.env.ODS9_FEEDBACK_TO || 'pfanokif@gmail.com'
const MAIL_RELAY_URL = process.env.MAIL_RELAY_URL || 'http://127.0.0.1:8790/send'
let skipFeedbackMail = false
const feedbackRate = new Map()

const WEB_CLIENT_ID =
  process.env.WEB_CLIENT_ID ||
  '617674779621-vu2iv3rjfcs08nrf5m6apn2ivnh9rim7.apps.googleusercontent.com'
const SESSION_SECRET_FILE =
  process.env.ODS9_SESSION_SECRET_FILE ||
  join(homedir(), '.config', 'aiconglomerate', 'ods9-session-secret')
let cachedSessionSecret = process.env.SESSION_SECRET || ''

const rate = new Map()
let state = { version: 1, plays: 0, sumPercent: 0, updatedAt: null }
let loaded = false

let trailSalt = ''
let trailCache = new Map() // trailId -> trail
let leaderboards = {} // { trailId: { entries: [...], updatedAt } }
let authDb = { version: 1, users: {}, sessions: {} } // { users: { sub: { name, picture } }, sessions: { token: { sub, exp } } }

let lexFr = null
let byLenFr = []
let lexEn = null
let byLenEn = []

const FR_VALUES = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1,
  J: 8, K: 10, L: 1, M: 2, N: 1, O: 1, P: 3, Q: 8, R: 1,
  S: 1, T: 1, U: 1, V: 4, W: 10, X: 10, Y: 10, Z: 10,
}
const EN_VALUES = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1,
  J: 8, K: 5, L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1,
  S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10,
}

const HARD = new Set(['J', 'K', 'Q', 'W', 'X', 'Y', 'Z'])
const FR_BAG = {
  A: 9, B: 2, C: 2, D: 3, E: 15, F: 2, G: 2, H: 2, I: 8,
  J: 1, K: 1, L: 5, M: 3, N: 6, O: 6, P: 2, Q: 1, R: 6,
  S: 6, T: 6, U: 6, V: 2, W: 1, X: 1, Y: 1, Z: 1,
}
const EN_BAG = {
  A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9,
  J: 1, K: 1, L: 4, M: 2, N: 6, O: 8, P: 2, Q: 1, R: 6,
  S: 4, T: 6, U: 4, V: 2, W: 2, X: 1, Y: 2, Z: 1,
}

// ========== Seeded RNG ==========
class SeededRng {
  constructor(seed) {
    this.state = seed >>> 0
  }
  next() {
    this.state = (Math.imul(48271, this.state) >>> 0) % 0x7fffffff
    return this.state / 0x7fffffff
  }
}

function parseLang(raw) {
  const s = String(raw || '').toLowerCase()
  return s === 'en' || s.endsWith('-en') ? 'en' : 'fr'
}

function trailLang(trailId) {
  return String(trailId || '').endsWith('-en') ? 'en' : 'fr'
}

function trailKids(trailId) {
  return String(trailId || '').includes('-kids')
}

function trailPeriod(trailId) {
  return String(trailId || '').replace(/-kids/, '').replace(/-en$/, '')
}

function parisYmd(date = new Date()) {
  const raw = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
  const [y, m, d] = raw.split('-').map(Number)
  return { y, m, d }
}

function isoWeekFromYmd(y, m, d) {
  const date = new Date(Date.UTC(y, m - 1, d))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const isoYear = date.getUTCFullYear()
  const yearStart = new Date(Date.UTC(isoYear, 0, 1))
  const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7)
  return `${isoYear}-W${String(week).padStart(2, '0')}`
}

export function isoWeekTrailId(date = new Date(), lang = 'fr', kids = false) {
  const { y, m, d } = parisYmd(date)
  const week = isoWeekFromYmd(y, m, d)
  let id = week
  if (kids) id += '-kids'
  if (lang === 'en') id += '-en'
  return id
}

function todayTrailId(lang = 'fr', kids = false) {
  return isoWeekTrailId(new Date(), lang, kids)
}

function normalizeTrailId(id, lang, kids = false) {
  if (!id) return todayTrailId(lang, kids)
  const s = String(id)
  if (s.includes('-kids') || s.endsWith('-en')) return s
  if (/^\d{4}-W\d{2}$/.test(s) || /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    let next = s
    if (kids) next += '-kids'
    if (lang === 'en') next += '-en'
    return next
  }
  return s
}

function dataPath(name) {
  const scriptDir = dirname(fileURLToPath(import.meta.url))
  return [
    join(scriptDir, '..', 'dashboard', 's', 'data', name),
    join(scriptDir, '..', 'web', 'data', name),
  ]
}

async function readLexiconFile(name) {
  let last = null
  for (const lexPath of dataPath(name)) {
    try {
      const buf = await readFile(lexPath)
      const text = gunzipSync(buf).toString('utf8')
      const words = text.split(/\r?\n/).map((w) => w.trim()).filter(Boolean)
      if (!words.length) throw new Error('empty')
      return words
    } catch (err) {
      last = err
    }
  }
  throw last || new Error(name + ' not found')
}

// ========== Lexicon loading ==========
async function loadLexicon(lang = 'fr') {
  if (lang === 'en') {
    if (lexEn) return
    const words = await readLexiconFile('yawl.txt.gz')
    lexEn = words
    byLenEn = Array.from({ length: 16 }, () => [])
    for (const w of words) if (w.length < 16) byLenEn[w.length].push(w)
    console.log(`Loaded EN ${words.length} words, byLen[7]=${byLenEn[7]?.length || 0}`)
    return
  }
  if (lexFr) return
  try {
    const words = await readLexiconFile('ods9.txt.gz')
    lexFr = words
    byLenFr = Array.from({ length: 16 }, () => [])
    for (const w of words) if (w.length < 16) byLenFr[w.length].push(w)
    console.log(`Loaded FR ${words.length} words, byLen[7]=${byLenFr[7]?.length || 0}`)
  } catch (err) {
    console.error('Failed to load lexicon:', err)
    throw new Error(`Lexicon load failed: ${err.message}`)
  }
}

function scoreWord(word, jokerSet = new Set(), values = FR_VALUES) {
  let n = 0
  for (let i = 0; i < word.length; i++) {
    if (jokerSet.has(i)) continue
    n += values[word[i]] || 0
  }
  return n
}

function rackCounts(rack) {
  const counts = new Uint8Array(26)
  let blanks = 0
  for (const ch of rack) {
    if (ch === '?' || ch === '.' || ch === '*') blanks++
    else if (ch >= 'A' && ch <= 'Z') counts[ch.charCodeAt(0) - 65]++
  }
  return { counts, blanks, tiles: rack.length }
}

function formable(word, counts, blanks) {
  let need = 0
  const used = new Uint8Array(26)
  const jokers = []
  for (let i = 0; i < word.length; i++) {
    const c = word.charCodeAt(i) - 65
    used[c]++
    if (used[c] > counts[c]) {
      need++
      jokers.push(i)
      if (need > blanks) return null
    }
  }
  return jokers
}

function usesHard(word, jokers = []) {
  const jk = new Set(jokers)
  return [...word].some((ch, i) => HARD.has(ch) && !jk.has(i))
}

function anagrams(rack, byLen = byLenFr, values = FR_VALUES) {
  const { counts, blanks, tiles } = rackCounts(rack)
  const hi = Math.min(rack.length, tiles)
  const lo = 2
  const groups = []
  for (let len = hi; len >= lo; len--) {
    const list = byLen[len] || []
    const found = []
    for (const word of list) {
      const jokers = formable(word, counts, blanks)
      if (!jokers) continue
      const jset = new Set(jokers)
      found.push({ word, score: scoreWord(word, jset, values), jokers, exact: word.length === tiles && jokers.length === 0 })
    }
    found.sort((a, b) => b.score - a.score || a.word.localeCompare(b.word))
    if (found.length) groups.push({ len, words: found })
  }
  return groups
}

// ========== Daily trail generation ==========
async function ensureTrailSalt() {
  if (trailSalt) return trailSalt
  try {
    trailSalt = (await readFile(TRAIL_SALT_FILE, 'utf8')).trim()
    if (trailSalt) return trailSalt
  } catch {
    // generate on first run
  }
  trailSalt = randomBytes(32).toString('hex')
  await mkdir(dirname(TRAIL_SALT_FILE), { recursive: true })
  await writeFile(TRAIL_SALT_FILE, trailSalt + '\n', { mode: 0o600 })
  return trailSalt
}

async function loadKidsLong(lang) {
  const scriptDir = dirname(fileURLToPath(import.meta.url))
  for (const rel of ['../dashboard/s/kids.js', '../web/kids.js']) {
    try {
      const mod = await import(pathToFileURL(join(scriptDir, rel)).href)
      if (typeof mod.kidsLong === 'function') return mod.kidsLong(lang)
    } catch {
      /* try next */
    }
  }
  return lang === 'en' ? ['HORSES'] : ['CHEVAUX']
}

async function generateTrail(trailId) {
  try {
    const lang = trailLang(trailId)
    await loadLexicon(lang)
    const byLen = lang === 'en' ? byLenEn : byLenFr
    const values = lang === 'en' ? EN_VALUES : FR_VALUES
    const bag = lang === 'en' ? EN_BAG : FR_BAG
    const salt = await ensureTrailSalt()
    const seedHash = createHash('sha256').update(trailId + salt).digest()
    const seed = seedHash.readUInt32LE(0)
    const rng = new SeededRng(seed)

    const pickWord = (list) => {
      if (!list || list.length === 0) throw new Error('pickWord called with empty list')
      const word = list[Math.floor(rng.next() * list.length)]
      if (!word || typeof word !== 'string') throw new Error(`pickWord returned invalid word: ${word}`)
      return word
    }
    const shuffleWord = (word) => {
      const a = [...word]
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
      }
      return a.join('')
    }

    if (trailKids(trailId)) {
      const pool = await loadKidsLong(lang)
      const hiddenSeed = pickWord(pool)
      const rack = shuffleWord(hiddenSeed)
      return { trailId, category: 'kids', rack, groups: anagrams(rack, byLen, values), seed: hiddenSeed }
    }

    // Build pools
    const bingo = byLen[7] || []
    const long = byLen[6] || []
    if (!bingo.length && !long.length) {
      throw new Error(`No 6-7 letter words found in lexicon (byLen[7]=${bingo.length}, byLen[6]=${long.length})`)
    }
    const bingoRich = bingo.filter((w) => scoreWord(w, new Set(), values) >= 12)
    const longRich = long.filter((w) => scoreWord(w, new Set(), values) >= 11)
    const hard = []
    for (let len = 3; len <= 5; len++) {
      for (const w of byLen[len] || []) {
        if (usesHard(w) && scoreWord(w, new Set(), values) >= 11) hard.push(w)
      }
    }
    const fillTiles = (used, n) => {
      const bag = []
      const have = {}
      for (const ch of used) have[ch] = (have[ch] || 0) + 1
      for (const [ch, max] of Object.entries(bag)) {
        for (let i = have[ch] || 0; i < max; i++) bag.push(ch)
      }
      let out = ''
      for (let i = 0; i < n && bag.length; i++) {
        const idx = Math.floor(rng.next() * bag.length)
        out += bag.splice(idx, 1)[0]
      }
      return out
    }

    for (let attempt = 0; attempt < 20; attempt++) {
      const roll = rng.next()
      let category = 'bingo'
      let hiddenSeed = ''
      let rack = ''
      if (roll < 0.4 && (bingoRich.length > 0 || bingo.length > 0)) {
        category = 'bingo'
        const source = (bingoRich.length > 0 && rng.next() < 0.7) ? bingoRich : bingo
        if (source.length === 0) continue
        hiddenSeed = pickWord(source)
        rack = shuffleWord(hiddenSeed)
      } else if (roll < 0.65 && (longRich.length > 0 || long.length > 0)) {
        category = 'long'
        const source = (longRich.length > 0 && rng.next() < 0.7) ? longRich : long
        if (source.length === 0) continue
        hiddenSeed = pickWord(source)
        rack = shuffleWord(hiddenSeed + fillTiles(hiddenSeed, 1))
      } else if (hard.length > 0) {
        category = 'hard'
        hiddenSeed = pickWord(hard)
        const extra = hiddenSeed.length === 3 ? fillTiles(hiddenSeed, 1) : ''
        rack = shuffleWord(hiddenSeed + extra)
      } else {
        continue
      }
      const groups = anagrams(rack, byLen, values)
      const best = groups[0]?.words[0]
      if (!best) continue
      const hardBest = usesHard(best.word, best.jokers)
      if (category === 'bingo' && best.word.length !== 7) continue
      if (category === 'long') {
        if (best.word.length === 7) category = 'bingo'
        else if (best.word.length < 6) continue
      }
      if (category === 'hard') {
        if (!hardBest) continue
        if (best.word.length >= 6) category = best.word.length === 7 ? 'bingo' : 'long'
        else if (best.score < 10) continue
      }
      if (best.word.length <= 4 && !hardBest && best.score < 12) continue
      return { trailId, category, rack, groups }
    }
    // Fallback: use bingo if available, otherwise SCRABBLE
    const fallbackPool = bingo.length > 0 ? bingo : ['SCRABBLE']
    const fallbackSeed = pickWord(fallbackPool)
    const rack = shuffleWord(fallbackSeed)
    return { trailId, category: 'bingo', rack, groups: anagrams(rack, byLen, values) }
  } catch (err) {
    console.error(`Trail generation failed for ${trailId}:`, err)
    throw err
  }
}

async function getTrail(trailId) {
  if (trailCache.has(trailId)) return trailCache.get(trailId)
  const trail = await generateTrail(trailId)
  trailCache.set(trailId, trail)
  return trail
}

function playPts(word, baseScore) {
  return (baseScore || 0) + (String(word || '').length === 7 ? 50 : 0)
}

function catalogFromGroups(groups) {
  const list = []
  for (const g of groups || []) {
    for (const entry of g.words || []) {
      list.push({ word: entry.word, pts: playPts(entry.word, entry.score) })
    }
  }
  list.sort((a, b) => b.pts - a.pts || b.word.length - a.word.length || a.word.localeCompare(b.word))
  return list
}

export async function officialPlays(trailId) {
  const trail = await getTrail(trailId)
  const lang = trailLang(trailId)
  const groups = trail.groups || anagrams(
    trail.rack,
    lang === 'en' ? byLenEn : byLenFr,
    lang === 'en' ? EN_VALUES : FR_VALUES
  )
  return { trailId, lang, rack: trail.rack, plays: catalogFromGroups(groups) }
}

function scoreFromPlays(plays, form, extra = {}) {
  const best = plays[0] || null
  const hit = plays.find((p) => p.word === form) || null
  if (!best || !hit) return { ok: false, error: 'not_playable' }
  const percent = Math.min(100, Math.round((100 * hit.pts) / Math.max(1, best.pts)))
  return {
    ok: true,
    word: hit.word,
    pts: hit.pts,
    best: best.word,
    bestPts: best.pts,
    percent,
    ...extra,
  }
}

export async function scoreOfficialPlay(trailId, word) {
  const form = String(word || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
  if (form.length < 2 || form.length > 15) return { ok: false, error: 'not_playable' }
  const { plays, lang, rack } = await officialPlays(trailId)
  return scoreFromPlays(plays, form, { trailId, lang, rack })
}

export async function scorePlayOnRack(lang, rackRaw, word) {
  const rack = String(rackRaw || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 7)
  const form = String(word || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
  if (rack.length < 2 || form.length < 2 || form.length > rack.length) return { ok: false, error: 'not_playable' }
  await loadLexicon(lang)
  const byLen = lang === 'en' ? byLenEn : byLenFr
  const values = lang === 'en' ? EN_VALUES : FR_VALUES
  const plays = catalogFromGroups(anagrams(rack, byLen, values))
  return scoreFromPlays(plays, form, { lang, rack })
}

// ========== Anonymous game stats (unchanged) ==========
async function load() {
  if (loaded) return state
  try {
    const raw = JSON.parse(await readFile(FILE, 'utf8'))
    if (raw?.version === 1 && Number.isFinite(raw.plays) && Number.isFinite(raw.sumPercent)) {
      state = { ...state, ...raw }
    }
  } catch {
    // first run
  }
  loaded = true
  return state
}

let saveChain = Promise.resolve()

async function save() {
  saveChain = saveChain.then(async () => {
    await mkdir(dirname(FILE), { recursive: true })
    await writeFile(FILE, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 })
  }).catch(() => {})
  return saveChain
}

function snapshot() {
  const average = state.plays ? Math.round((state.sumPercent / state.plays) * 10) / 10 : 0
  return { ok: true, average, plays: state.plays, updatedAt: state.updatedAt }
}

function allowRate(ip) {
  const now = Date.now()
  const row = (rate.get(ip) || []).filter((t) => now - t < 60_000)
  if (row.length >= 20) {
    rate.set(ip, row)
    return false
  }
  row.push(now)
  rate.set(ip, row)
  return true
}

function allowFeedbackRate(ip) {
  const now = Date.now()
  const row = (feedbackRate.get(ip) || []).filter((t) => now - t < 10 * 60_000)
  if (row.length >= 8) {
    feedbackRate.set(ip, row)
    return false
  }
  row.push(now)
  feedbackRate.set(ip, row)
  return true
}

function mailRelaySecret() {
  const env = String(process.env.MAIL_RELAY_SECRET || '').trim()
  if (env) return env
  try {
    const raw = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '.env.agent'), 'utf8')
    const m = raw.match(/^export MAIL_RELAY_SECRET=['"]?([^'"\n]+)/m)
    return m ? m[1].trim() : ''
  } catch {
    return ''
  }
}

function cleanFeedbackText(raw, max) {
  return String(raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, max)
}

function validEmail(raw) {
  const s = String(raw || '').trim()
  if (!s) return ''
  if (s.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return null
  return s
}

async function persistFeedback(row) {
  await mkdir(dirname(FEEDBACK_FILE), { recursive: true, mode: 0o700 })
  await appendFile(FEEDBACK_FILE, JSON.stringify(row) + '\n', { mode: 0o600 })
}

async function mailFeedback(row) {
  if (skipFeedbackMail) return { mailed: false, skipped: true }
  const secret = mailRelaySecret()
  if (!secret) return { mailed: false, skipped: true }
  const bits = [
    row.message,
    '',
    row.email ? `Reply-to: ${row.email}` : 'Reply-to: (none)',
    row.name ? `Name: ${row.name}` : '',
    `Lang: ${row.lang}`,
    `Source: ${row.source}`,
    row.ip ? `IP: ${row.ip}` : '',
  ].filter(Boolean)
  const res = await fetch(MAIL_RELAY_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secret}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      to: [FEEDBACK_TO],
      subject: 'Verimots feedback',
      text: bits.join('\n'),
      replyTo: row.email || '',
      fromName: 'Verimots',
    }),
    signal: AbortSignal.timeout(12_000),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`mail ${res.status} ${err.slice(0, 180)}`)
  }
  return { mailed: true }
}

function clientIp(req) {
  return (
    String(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || '')
      .split(',')[0]
      .trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  )
}

async function readJson(req, limit = 2048) {
  const chunks = []
  let n = 0
  for await (const c of req) {
    n += c.length
    if (n > limit) throw new Error('body too large')
    chunks.push(c)
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  return raw ? JSON.parse(raw) : {}
}

export async function recordPercent(percent) {
  await load()
  const p = Math.max(0, Math.min(100, Math.round(Number(percent))))
  if (!Number.isFinite(p)) throw new Error('bad percent')
  state.plays += 1
  state.sumPercent += p
  state.updatedAt = new Date().toISOString()
  await save()
  return snapshot()
}

export async function gameStats() {
  await load()
  return snapshot()
}

// ========== Leaderboard ==========
let boardLock = Promise.resolve()

async function loadLeaderboards() {
  try {
    const raw = JSON.parse(await readFile(LEADERBOARD_FILE, 'utf8'))
    if (raw?.version === 1 && raw.boards) {
      leaderboards = raw.boards
    }
  } catch {
    // first run
  }
}

async function saveLeaderboards() {
  await mkdir(dirname(LEADERBOARD_FILE), { recursive: true })
  await writeFile(LEADERBOARD_FILE, JSON.stringify({ version: 1, boards: leaderboards }, null, 2) + '\n', { mode: 0o600 })
}

async function withBoardLock(fn) {
  const prev = boardLock
  let release
  boardLock = new Promise((resolve) => {
    release = resolve
  })
  await prev
  try {
    return await fn()
  } finally {
    release()
  }
}

function entryAverage(entry) {
  const n = Math.max(1, Number(entry?.plays) || 1)
  const sum = Number(entry?.sumPercent)
  if (Number.isFinite(sum)) return Math.round((10 * sum) / n) / 10
  const p = Number(entry?.percent)
  return Number.isFinite(p) ? Math.round(p * 10) / 10 : 0
}

function publicEntry(entry, rank) {
  return {
    rank,
    pseudo: entry.pseudo,
    percent: entryAverage(entry),
    plays: Math.max(1, Number(entry.plays) || 1),
    word: entry.word || null,
    pts: entry.pts || null,
    timestamp: entry.timestamp,
  }
}

function sortBoard(board) {
  board.entries.sort((a, b) => {
    const d = entryAverage(b) - entryAverage(a)
    if (d) return d
    const plays = (Number(b.plays) || 1) - (Number(a.plays) || 1)
    if (plays) return plays
    return new Date(a.timestamp) - new Date(b.timestamp)
  })
}

async function recordCompete(trailId, sub, pseudo, scored, opts = {}) {
  return withBoardLock(async () => {
  await loadLeaderboards()
  if (!leaderboards[trailId]) {
    leaderboards[trailId] = { entries: [], updatedAt: null }
  }
  const board = leaderboards[trailId]
  const idx = board.entries.findIndex((e) => e.sub === sub)
  const stamp = new Date().toISOString()
  if (idx >= 0) {
    if (!opts.replace) return { ok: false, error: 'already_submitted' }
    const prev = board.entries[idx]
    const plays = (Number(prev.plays) || 1) + 1
    const sumPercent = (Number(prev.sumPercent) || Number(prev.percent) || 0) + scored.percent
    const percent = Math.round((10 * sumPercent) / plays) / 10
    board.entries[idx] = {
      ...prev,
      sub,
      pseudo,
      plays,
      sumPercent,
      percent,
      word: scored.word,
      pts: scored.pts,
      timestamp: stamp,
    }
  } else {
    board.entries.push({
      sub,
      pseudo,
      plays: 1,
      sumPercent: scored.percent,
      percent: scored.percent,
      word: scored.word,
      pts: scored.pts,
      timestamp: stamp,
    })
  }
  sortBoard(board)
  board.updatedAt = stamp
  await saveLeaderboards()
  const entry = board.entries.find((e) => e.sub === sub)
  if (idx < 0) await recordUserPlay(sub, trailId, scored.percent, scored.word)
  else {
    await loadAuthDb()
    const user = authDb.users[sub]
    if (user) {
      user.bestPercent = Math.max(Number(user.bestPercent) || 0, scored.percent)
      if (scored.word) rememberUserWord(user, { word: scored.word, pts: scored.pts, src: 'defi' })
      user.updatedAt = stamp
      await saveAuthDb()
    }
  }
  return {
    ok: true,
    percent: entryAverage(entry),
    plays: entry?.plays || 1,
    word: scored.word,
    pts: scored.pts,
  }
  })
}

async function getLeaderboard(trailId, sessionSub = null) {
  await loadLeaderboards()
  const board = leaderboards[trailId]
  if (!board || !board.entries.length) {
    return { ok: true, trailId, lang: trailLang(trailId), top: [], me: null }
  }
  sortBoard(board)
  const top = board.entries.slice(0, 50).map((e, i) => publicEntry(e, i + 1))
  let me = null
  if (sessionSub) {
    const idx = board.entries.findIndex((e) => e.sub === sessionSub)
    if (idx !== -1) me = publicEntry(board.entries[idx], idx + 1)
  }
  return { ok: true, trailId, lang: trailLang(trailId), top, me }
}

// ========== Auth ==========
async function loadAuthDb() {
  try {
    const raw = JSON.parse(await readFile(AUTH_DB_FILE, 'utf8'))
    if (raw?.version === 1 && raw.users && raw.sessions) {
      authDb = raw
    }
  } catch {
    // first run
  }
}

async function saveAuthDb() {
  await mkdir(dirname(AUTH_DB_FILE), { recursive: true })
  await writeFile(AUTH_DB_FILE, JSON.stringify(authDb, null, 2) + '\n', { mode: 0o600 })
}

function getSessionSecret() {
  if (cachedSessionSecret) return cachedSessionSecret
  try {
    cachedSessionSecret = readFileSync(SESSION_SECRET_FILE, 'utf8').trim()
    if (cachedSessionSecret) return cachedSessionSecret
  } catch {
    /* first run */
  }
  cachedSessionSecret = randomBytes(32).toString('hex')
  try {
    mkdirSync(dirname(SESSION_SECRET_FILE), { recursive: true, mode: 0o700 })
    writeFileSync(SESSION_SECRET_FILE, cachedSessionSecret + '\n', { mode: 0o600 })
  } catch {
    /* tests or a read-only home still keep an in-memory secret for this process */
  }
  return cachedSessionSecret
}

function signSession(sub) {
  const exp = Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
  const payload = JSON.stringify({ sub, exp })
  const sig = createHmac('sha256', getSessionSecret()).update(payload).digest('hex')
  return Buffer.from(payload).toString('base64url') + '.' + sig
}

function verifySession(token) {
  if (!token) return null
  const [payloadB64, sig] = token.split('.')
  if (!payloadB64 || !sig) return null
  const payload = Buffer.from(payloadB64, 'base64url').toString('utf8')
  const expectedSig = createHmac('sha256', getSessionSecret()).update(payload).digest('hex')
  if (sig !== expectedSig) return null
  try {
    const { sub, exp } = JSON.parse(payload)
    if (Date.now() > exp) return null
    return sub
  } catch {
    return null
  }
}

function getSessionFromRequest(req) {
  const cookie = req.headers.cookie || ''
  const match = cookie.match(/ods9_session=([^;]+)/)
  return match ? verifySession(match[1]) : null
}

async function handleGoogleAuth(idToken) {
  if (!WEB_CLIENT_ID) {
    return { ok: false, error: 'google_not_configured' }
  }
  const client = new OAuth2Client(WEB_CLIENT_ID)
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: WEB_CLIENT_ID })
    const payload = ticket.getPayload()
    const { sub, name, picture } = payload
    await loadAuthDb()
    authDb.users[sub] = { name, picture, updatedAt: new Date().toISOString() }
    await saveAuthDb()
    const sessionToken = signSession(sub)
    return { ok: true, sessionToken, user: { sub, name, picture } }
  } catch (err) {
    return { ok: false, error: 'invalid_token' }
  }
}

function shiftPeriod(trailId, delta) {
  const period = trailPeriod(trailId)
  const week = period.match(/^(\d{4})-W(\d{2})$/)
  if (week) {
    const year = Number(week[1])
    const n = Number(week[2])
    const jan4 = new Date(Date.UTC(year, 0, 4))
    const jan4Day = jan4.getUTCDay() || 7
    const monday = new Date(jan4)
    monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1) + (n - 1 + delta) * 7)
    return isoWeekFromYmd(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate())
  }
  const [y, m, d] = period.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + delta))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

function publicStats(user) {
  const history = Array.isArray(user?.history) ? user.history : []
  const plays = Number(user?.plays) || 0
  const sum = Number(user?.sumPercent) || 0
  return {
    words: history.length,
    plays,
    average: plays ? Math.round((sum / plays) * 10) / 10 : 0,
    best: Number(user?.bestPercent) || 0,
    streak: Number(user?.streak) || 0,
  }
}

async function recordUserPlay(sub, trailId, percent, word) {
  await loadAuthDb()
  const user = authDb.users[sub]
  if (!user) return
  const last = user.lastTrailId || ''
  if (last === trailId) {
    /* already counted */
  } else if (last && trailPeriod(last) === shiftPeriod(trailId, -1)) {
    user.streak = (Number(user.streak) || 0) + 1
  } else {
    user.streak = 1
  }
  user.lastTrailId = trailId
  user.plays = (Number(user.plays) || 0) + 1
  user.sumPercent = (Number(user.sumPercent) || 0) + percent
  user.bestPercent = Math.max(Number(user.bestPercent) || 0, percent)
  user.updatedAt = new Date().toISOString()
  if (word) rememberUserWord(user, { word, pts: 0, src: 'defi' })
  await saveAuthDb()
}

function rememberUserWord(user, entry) {
  const word = String(entry?.word || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
  if (word.length < 2 || word.length > 15) return user.history || []
  const pts = Math.max(0, Math.round(Number(entry.pts) || 0))
  const src = entry.src === 'dico' ? 'dico' : 'defi'
  const at = Number(entry.at) || Date.now()
  const prev = Array.isArray(user.history) ? user.history : []
  user.history = [{ word, pts, src, at }, ...prev.filter((row) => row.word !== word)].slice(0, 80)
  return user.history
}

async function getMe(sub) {
  if (!sub) return null
  await loadAuthDb()
  const user = authDb.users[sub]
  if (!user) return null
  return { sub, name: user.name, picture: user.picture, stats: publicStats(user) }
}

export function seedUserForTests(sub, user = {}) {
  cachedSessionSecret = process.env.SESSION_SECRET || 'test-session-secret'
  authDb.users[sub] = { name: 'Test', picture: '', history: [], plays: 0, sumPercent: 0, ...user }
}

export function sessionCookieForTests(sub) {
  cachedSessionSecret = process.env.SESSION_SECRET || 'test-session-secret'
  return 'ods9_session=' + signSession(sub)
}

// ========== Handler ==========
export async function handleOdsGame(req, res, url, helpers) {
  const { json } = helpers
  const path = url.pathname.replace(/\/$/, '') || url.pathname

  // Anonymous stats (unchanged)
  if (path === '/api/game/stats') {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      json(res, 405, { ok: false, error: 'GET only' }, {}, req.method)
      return true
    }
    json(res, 200, await gameStats(), { 'Cache-Control': 'no-store' }, req.method)
    return true
  }

  if (path === '/api/game/score') {
    if (req.method !== 'POST') {
      json(res, 405, { ok: false, error: 'POST only' }, {}, req.method)
      return true
    }
    if (!allowRate(clientIp(req))) {
      json(res, 429, { ok: false, error: 'Too many scores' }, {}, req.method)
      return true
    }
    try {
      const body = await readJson(req)
      const out = await recordPercent(body.percent)
      json(res, 200, out, { 'Cache-Control': 'no-store' }, req.method)
    } catch {
      json(res, 400, { ok: false, error: 'Invalid score' }, {}, req.method)
    }
    return true
  }

  // Weekly trail
  if (path === '/api/game/trail') {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      json(res, 405, { ok: false, error: 'GET only' }, {}, req.method)
      return true
    }
    try {
      const lang = parseLang(url.searchParams.get('lang'))
      const kids = url.searchParams.get('kids') === '1'
      const trailId = todayTrailId(lang, kids)
      const trail = await getTrail(trailId)
      json(
        res,
        200,
        {
          ok: true,
          trailId: trail.trailId,
          lang,
          kids,
          category: trail.category,
          rack: trail.rack,
          seed: kids ? trail.seed || null : null,
        },
        { 'Cache-Control': 'no-store' },
        req.method
      )
    } catch (err) {
      console.error('Trail endpoint error:', err)
      const isDev = process.env.NODE_ENV !== 'production'
      json(res, 500, { ok: false, error: 'Trail generation failed', ...(isDev && { detail: err.message }) }, {}, req.method)
    }
    return true
  }

  // Leaderboard
  if (path === '/api/game/board') {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      json(res, 405, { ok: false, error: 'GET only' }, {}, req.method)
      return true
    }
    const lang = parseLang(url.searchParams.get('lang'))
    const kids = url.searchParams.get('kids') === '1'
    const trailId = normalizeTrailId(url.searchParams.get('trailId'), lang, kids)
    const sessionSub = getSessionFromRequest(req)
    const board = await getLeaderboard(trailId, sessionSub)
    board.kids = kids || trailKids(trailId)
    json(res, 200, board, { 'Cache-Control': 'no-store' }, req.method)
    return true
  }

  // Compete (requires login)
  if (path === '/api/game/compete') {
    if (req.method !== 'POST') {
      json(res, 405, { ok: false, error: 'POST only' }, {}, req.method)
      return true
    }
    const sessionSub = getSessionFromRequest(req)
    if (!sessionSub) {
      json(res, 401, { ok: false, error: 'login_required' }, {}, req.method)
      return true
    }
    try {
      const body = await readJson(req)
      const word = body.word ? String(body.word).toUpperCase().slice(0, 15) : ''
      if (!word) {
        json(res, 400, { ok: false, error: 'word_required' }, {}, req.method)
        return true
      }
      const lang = parseLang(body.lang)
      const kids = body.kids === true || body.kids === 1 || body.kids === '1'
      const trailId = todayTrailId(lang, kids)
      const user = await getMe(sessionSub)
      if (!user) {
        json(res, 401, { ok: false, error: 'user_not_found' }, {}, req.method)
        return true
      }
      const rack = String(body.rack || '')
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .slice(0, 7)
      const scored = kids && rack.length >= 2
        ? await scorePlayOnRack(lang, rack, word)
        : await scoreOfficialPlay(trailId, word)
      if (!scored.ok) {
        json(res, 400, scored, { 'Cache-Control': 'no-store' }, req.method)
        return true
      }
      const pseudo = user.name || 'Anonyme'
      const result = await recordCompete(trailId, sessionSub, pseudo, scored, { replace: kids })
      json(
        res,
        result.ok ? 200 : 400,
        result.ok ? { ...scored, ...result } : result,
        { 'Cache-Control': 'no-store' },
        req.method
      )
    } catch {
      json(res, 400, { ok: false, error: 'Invalid compete request' }, {}, req.method)
    }
    return true
  }

  // Auth endpoints
  if (path === '/api/auth/google') {
    if (req.method !== 'POST') {
      json(res, 405, { ok: false, error: 'POST only' }, {}, req.method)
      return true
    }
    if (!WEB_CLIENT_ID) {
      json(res, 503, { ok: false, error: 'google_not_configured' }, {}, req.method)
      return true
    }
    try {
      const body = await readJson(req)
      const result = await handleGoogleAuth(body.idToken)
      if (result.ok) {
        const secure = String(req.headers['x-forwarded-proto'] || '').includes('https') ? '; Secure' : ''
        const cookie = `ods9_session=${result.sessionToken}; HttpOnly; Path=/; Max-Age=2592000; SameSite=Lax${secure}`
        json(
          res,
          200,
          { ok: true, user: result.user, sessionToken: result.sessionToken },
          { 'Set-Cookie': cookie, 'Cache-Control': 'no-store' },
          req.method
        )
      } else {
        json(res, 401, result, {}, req.method)
      }
    } catch {
      json(res, 400, { ok: false, error: 'Invalid auth request' }, {}, req.method)
    }
    return true
  }

  if (path === '/api/auth/me') {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      json(res, 405, { ok: false, error: 'GET only' }, {}, req.method)
      return true
    }
    const sessionSub = getSessionFromRequest(req)
    if (!sessionSub) {
      json(res, 401, { ok: false, error: 'not_logged_in' }, {}, req.method)
      return true
    }
    const user = await getMe(sessionSub)
    if (!user) {
      json(res, 401, { ok: false, error: 'user_not_found' }, {}, req.method)
      return true
    }
    json(res, 200, { ok: true, user }, { 'Cache-Control': 'no-store' }, req.method)
    return true
  }

  if (path === '/api/game/history') {
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'POST' && req.method !== 'DELETE') {
      json(res, 405, { ok: false, error: 'GET, POST or DELETE' }, {}, req.method)
      return true
    }
    const sessionSub = getSessionFromRequest(req)
    if (!sessionSub) {
      json(res, 401, { ok: false, error: 'login_required' }, {}, req.method)
      return true
    }
    await loadAuthDb()
    const user = authDb.users[sessionSub]
    if (!user) {
      json(res, 401, { ok: false, error: 'user_not_found' }, {}, req.method)
      return true
    }
    if (req.method === 'POST') {
      try {
        const body = await readJson(req)
        rememberUserWord(user, body)
        user.updatedAt = new Date().toISOString()
        await saveAuthDb()
      } catch {
        json(res, 400, { ok: false, error: 'Invalid history' }, {}, req.method)
        return true
      }
    }
    if (req.method === 'DELETE') {
      user.history = []
      user.updatedAt = new Date().toISOString()
      await saveAuthDb()
    }
    json(
      res,
      200,
      { ok: true, history: user.history || [], stats: publicStats(user) },
      { 'Cache-Control': 'no-store' },
      req.method
    )
    return true
  }

  if (path === '/api/auth/logout') {
    if (req.method !== 'POST') {
      json(res, 405, { ok: false, error: 'POST only' }, {}, req.method)
      return true
    }
    const cookie = 'ods9_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax'
    json(res, 200, { ok: true }, { 'Set-Cookie': cookie, 'Cache-Control': 'no-store' }, req.method)
    return true
  }

  if (path === '/api/game/feedback') {
    if (req.method !== 'POST') {
      json(res, 405, { ok: false, error: 'POST only' }, {}, req.method)
      return true
    }
    const ip = clientIp(req)
    if (!allowFeedbackRate(ip)) {
      json(res, 429, { ok: false, error: 'too_many' }, {}, req.method)
      return true
    }
    try {
      const body = await readJson(req, 8192)
      if (String(body.website || body.hp || '').trim()) {
        json(res, 200, { ok: true }, { 'Cache-Control': 'no-store' }, req.method)
        return true
      }
      const message = cleanFeedbackText(body.message || body.text || body.comment, 2000)
      if (message.length < 4) {
        json(res, 400, { ok: false, error: 'message_required' }, {}, req.method)
        return true
      }
      const email = validEmail(body.email)
      if (email === null) {
        json(res, 400, { ok: false, error: 'bad_email' }, {}, req.method)
        return true
      }
      const row = {
        at: new Date().toISOString(),
        message,
        email: email || '',
        name: cleanFeedbackText(body.name, 80),
        lang: parseLang(body.lang),
        source: cleanFeedbackText(body.source, 40) || 'web',
        ip,
      }
      await persistFeedback(row)
      try {
        await mailFeedback(row)
      } catch (err) {
        console.error('feedback mail failed:', err?.message || err)
        json(res, 502, { ok: false, error: 'mail_failed' }, { 'Cache-Control': 'no-store' }, req.method)
        return true
      }
      json(res, 200, { ok: true }, { 'Cache-Control': 'no-store' }, req.method)
    } catch {
      json(res, 400, { ok: false, error: 'invalid' }, {}, req.method)
    }
    return true
  }

  return false
}

export function resetGameStatsForTests(file, saltFile = null, leaderboardFile = null, authFile = null) {
  if (file) FILE = file
  if (saltFile) TRAIL_SALT_FILE = saltFile
  if (leaderboardFile) LEADERBOARD_FILE = leaderboardFile
  if (authFile) AUTH_DB_FILE = authFile
  state = { version: 1, plays: 0, sumPercent: 0, updatedAt: null }
  loaded = true
  rate.clear()
  feedbackRate.clear()
  skipFeedbackMail = true
  if (file) FEEDBACK_FILE = String(file).replace(/\.json$/i, '.jsonl')
  trailCache.clear()
  leaderboards = {}
  authDb = { version: 1, users: {}, sessions: {} }
  trailSalt = saltFile ? '' : 'test-salt-' + randomBytes(16).toString('hex')
  cachedSessionSecret = process.env.SESSION_SECRET || 'test-session-secret'
}
