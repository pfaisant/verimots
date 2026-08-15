// Shared challenge stats for s.pfa87.cc — average of submitted percentages.
// Competitive mode: daily trail, leaderboard, Google auth.
//
// New endpoints:
//   GET /api/game/trail — today's deterministic challenge
//   GET /api/game/board?trailId=YYYY-MM-DD — leaderboard (public top 50 + user rank if logged in)
//   POST /api/game/compete — submit ranked score (requires login)
//   POST /api/auth/google — Google Sign-In
//   GET /api/auth/me — current session
//   POST /api/auth/logout — end session
//
// WEB_CLIENT_ID defaults to the public Verimots web client. A fake idToken
// still returns 401 invalid_token. SESSION_SECRET is persisted so cookies
// survive a serve restart.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
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
let writing = false

let trailSalt = ''
let trailCache = new Map() // trailId -> trail
let leaderboards = {} // { trailId: { entries: [...], updatedAt } }
let authDb = { version: 1, users: {}, sessions: {} } // { users: { sub: { name, picture } }, sessions: { token: { sub, exp } } }

let lexicon = null
let byLen = []

const VALUES = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1,
  J: 8, K: 10, L: 1, M: 2, N: 1, O: 1, P: 3, Q: 8, R: 1,
  S: 1, T: 1, U: 1, V: 4, W: 10, X: 10, Y: 10, Z: 10,
}

const HARD = new Set(['J', 'K', 'Q', 'W', 'X', 'Y', 'Z'])
const TILE_COUNTS = {
  A: 9, B: 2, C: 2, D: 3, E: 15, F: 2, G: 2, H: 2, I: 8,
  J: 1, K: 1, L: 5, M: 3, N: 6, O: 6, P: 2, Q: 1, R: 6,
  S: 6, T: 6, U: 6, V: 2, W: 1, X: 1, Y: 1, Z: 1,
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

// ========== Lexicon loading ==========
async function loadLexicon() {
  if (lexicon) return
  try {
    const scriptDir = dirname(fileURLToPath(import.meta.url))
    const lexPath = join(scriptDir, '..', 'dashboard', 's', 'data', 'ods9.txt.gz')
    const buf = await readFile(lexPath)
    const text = gunzipSync(buf).toString('utf8')
    // Strip CRLF and filter empty lines
    lexicon = text.split(/\r?\n/).map(w => w.trim()).filter(Boolean)
    if (lexicon.length === 0) throw new Error('Lexicon is empty after parsing')
    byLen = Array.from({ length: 16 }, () => [])
    for (const w of lexicon) {
      const trimmed = w.trim()
      if (trimmed.length > 0 && trimmed.length < 16) byLen[trimmed.length].push(trimmed)
    }
    console.log(`Loaded ${lexicon.length} words, byLen[7]=${byLen[7]?.length || 0}`)
  } catch (err) {
    console.error('Failed to load lexicon:', err)
    throw new Error(`Lexicon load failed: ${err.message}`)
  }
}

function scoreWord(word, jokerSet = new Set()) {
  let n = 0
  for (let i = 0; i < word.length; i++) {
    if (jokerSet.has(i)) continue
    n += VALUES[word[i]] || 0
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

function anagrams(rack) {
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
      found.push({ word, score: scoreWord(word, jset), jokers, exact: word.length === tiles && jokers.length === 0 })
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

function todayTrailId() {
  const paris = new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' })
  const d = new Date(paris)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function generateTrail(trailId) {
  try {
    await loadLexicon()
    const salt = await ensureTrailSalt()
    const seedHash = createHash('sha256').update(trailId + salt).digest()
    const seed = seedHash.readUInt32LE(0)
    const rng = new SeededRng(seed)

    // Build pools
    const bingo = byLen[7] || []
    const long = byLen[6] || []
    if (!bingo.length && !long.length) {
      throw new Error(`No 6-7 letter words found in lexicon (byLen[7]=${bingo.length}, byLen[6]=${long.length})`)
    }
    const bingoRich = bingo.filter((w) => scoreWord(w) >= 12)
    const longRich = long.filter((w) => scoreWord(w) >= 11)
    const hard = []
    for (let len = 3; len <= 5; len++) {
      for (const w of byLen[len] || []) {
        if (usesHard(w) && scoreWord(w) >= 11) hard.push(w)
      }
    }

    const pickWord = (list) => {
      if (!list || list.length === 0) {
        console.error('pickWord called with empty or null list')
        throw new Error('pickWord called with empty list')
      }
      const word = list[Math.floor(rng.next() * list.length)]
      if (!word || typeof word !== 'string') {
        console.error(`pickWord got invalid word: ${word} from list of ${list.length} items, first few:`, list.slice(0, 5))
        throw new Error(`pickWord returned invalid word: ${word}`)
      }
      return word
    }
    const shuffleWord = (word) => {
      if (!word) throw new Error('shuffleWord called with empty word')
      const a = [...word]
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
      }
      return a.join('')
    }
    const fillTiles = (used, n) => {
      const bag = []
      const have = {}
      for (const ch of used) have[ch] = (have[ch] || 0) + 1
      for (const [ch, max] of Object.entries(TILE_COUNTS)) {
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
      const groups = anagrams(rack)
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
    return { trailId, category: 'bingo', rack, groups: anagrams(rack) }
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

async function save() {
  if (writing) return
  writing = true
  try {
    await mkdir(dirname(FILE), { recursive: true })
    await writeFile(FILE, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 })
  } finally {
    writing = false
  }
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

async function recordCompete(trailId, sub, pseudo, percent, word = null) {
  await loadLeaderboards()
  if (!leaderboards[trailId]) {
    leaderboards[trailId] = { entries: [], updatedAt: null }
  }
  const board = leaderboards[trailId]
  // One attempt per sub per trail
  if (board.entries.some((e) => e.sub === sub)) {
    return { ok: false, error: 'already_submitted' }
  }
  board.entries.push({ sub, pseudo, percent, word, timestamp: new Date().toISOString() })
  board.entries.sort((a, b) => b.percent - a.percent || new Date(a.timestamp) - new Date(b.timestamp))
  board.updatedAt = new Date().toISOString()
  await saveLeaderboards()
  await recordUserPlay(sub, trailId, percent, word)
  return { ok: true }
}

async function getLeaderboard(trailId, sessionSub = null) {
  await loadLeaderboards()
  const board = leaderboards[trailId]
  if (!board || !board.entries.length) {
    return { ok: true, trailId, top: [], me: null }
  }
  // Public top 50 without sub
  const top = board.entries.slice(0, 50).map((e, i) => ({
    rank: i + 1,
    pseudo: e.pseudo,
    percent: e.percent,
    word: e.word || null,
    timestamp: e.timestamp,
  }))
  let me = null
  if (sessionSub) {
    const idx = board.entries.findIndex((e) => e.sub === sessionSub)
    if (idx !== -1) {
      const entry = board.entries[idx]
      me = { rank: idx + 1, pseudo: entry.pseudo, percent: entry.percent, word: entry.word || null }
    }
  }
  return { ok: true, trailId, top, me }
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

function shiftDay(isoDay, delta) {
  const [y, m, d] = String(isoDay).split('-').map(Number)
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
  } else if (last && last === shiftDay(trailId, -1)) {
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

  // Daily trail
  if (path === '/api/game/trail') {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      json(res, 405, { ok: false, error: 'GET only' }, {}, req.method)
      return true
    }
    try {
      const trailId = todayTrailId()
      const trail = await getTrail(trailId)
      // Return rack and category; client computes groups. Don't leak best word yet if client hides it.
      json(res, 200, { ok: true, trailId: trail.trailId, category: trail.category, rack: trail.rack }, { 'Cache-Control': 'public, max-age=3600' }, req.method)
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
    const trailId = url.searchParams.get('trailId') || todayTrailId()
    const sessionSub = getSessionFromRequest(req)
    const board = await getLeaderboard(trailId, sessionSub)
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
      const percent = Math.max(0, Math.min(100, Math.round(Number(body.percent))))
      if (!Number.isFinite(percent)) throw new Error('bad percent')
      const word = body.word ? String(body.word).toUpperCase().slice(0, 15) : null
      const trailId = todayTrailId()
      const user = await getMe(sessionSub)
      if (!user) {
        json(res, 401, { ok: false, error: 'user_not_found' }, {}, req.method)
        return true
      }
      const pseudo = user.name || 'Anonyme'
      const result = await recordCompete(trailId, sessionSub, pseudo, percent, word)
      json(res, result.ok ? 200 : 400, result, { 'Cache-Control': 'no-store' }, req.method)
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
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'POST') {
      json(res, 405, { ok: false, error: 'GET or POST' }, {}, req.method)
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
  trailCache.clear()
  leaderboards = {}
  authDb = { version: 1, users: {}, sessions: {} }
  trailSalt = saltFile ? '' : 'test-salt-' + randomBytes(16).toString('hex')
  cachedSessionSecret = process.env.SESSION_SECRET || 'test-session-secret'
}
