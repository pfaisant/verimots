// Shared challenge stats for s.pfa87.cc — average of submitted percentages.
// Competitive mode: weekly trail (Paris ISO week), leaderboard, Google auth.
//
// New endpoints:
//   GET /api/game/trail?lang=fr|en|es — this week's deterministic challenge
//   GET /api/game/board?lang=fr|en|es|any&trailId=…&scope=day|all — week (default), today, or all-time
//   POST /api/game/compete — { percent, word, lang } ranked score (requires login)
//   POST /api/game/activity — verified checks / words found, with retry-safe ids
//   GET|POST|DELETE /api/game/history — synced word history
//   POST /api/auth/google — Google Sign-In
//   GET /api/auth/me — current session
//   POST /api/auth/logout — end session
//
// WEB_CLIENT_ID defaults to the public Verimots web client. A fake idToken
// still returns 401 invalid_token. SESSION_SECRET is persisted so cookies
// survive a serve restart.

import { readFile, writeFile, mkdir, appendFile, rename, rm } from 'node:fs/promises'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash, randomBytes, createHmac, timingSafeEqual } from 'node:crypto'
import { clientIp, createRateLimiter, isCrossOriginMutation } from './http-safety.mjs'
import { gunzipSync } from 'node:zlib'
import { setTimeout as delay } from 'node:timers/promises'
import { OAuth2Client } from 'google-auth-library'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const kidsPath = ['../web/kids.js', '../dashboard/s/kids.js']
  .map((rel) => join(SCRIPT_DIR, rel))
  .find((p) => existsSync(p))
if (!kidsPath) throw new Error('kids.js not found next to ods-game.mjs')
const { kidsAnagrams, kidsLong } = await import(pathToFileURL(kidsPath).href)
const tilesPath = ['../web/tiles.js', '../dashboard/s/tiles.js']
  .map((rel) => join(SCRIPT_DIR, rel))
  .find((p) => existsSync(p))
if (!tilesPath) throw new Error('tiles.js not found next to ods-game.mjs')
const { tileSpec, encodeTiles, decodeWord, decodeRack } = await import(pathToFileURL(tilesPath).href)
const ipPath = join(SCRIPT_DIR, 'ip-lookup.mjs')
const { flagEmoji, ipInfo, enrichIpInfo } = existsSync(ipPath)
  ? await import(pathToFileURL(ipPath).href)
  : {
      flagEmoji: () => '',
      ipInfo: () => ({}),
      enrichIpInfo: async (geo) => geo || {},
    }

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
let SIGNUP_FILE =
  process.env.ODS9_SIGNUP_FILE ||
  join(homedir(), '.local', 'state', 'aiconglomerate', 'ods9-signup.jsonl')
const FEEDBACK_TO = process.env.ODS9_FEEDBACK_TO || 'pfanokif@gmail.com'
const MAIL_RELAY_URL = process.env.MAIL_RELAY_URL || 'http://127.0.0.1:8790/send'
export const PLAY_TESTING_URL = 'https://play.google.com/apps/testing/cc.pfa87.verimots'
export const PLAY_WEB_URL = 'https://s.pfa87.cc/'
let skipFeedbackMail = false
const allowFeedbackRate = createRateLimiter(8, 10 * 60_000)

const WEB_CLIENT_ID =
  process.env.WEB_CLIENT_ID ||
  '617674779621-vu2iv3rjfcs08nrf5m6apn2ivnh9rim7.apps.googleusercontent.com'
const SESSION_SECRET_FILE =
  process.env.ODS9_SESSION_SECRET_FILE ||
  join(homedir(), '.config', 'aiconglomerate', 'ods9-session-secret')
let cachedSessionSecret = process.env.SESSION_SECRET || ''

const allowRate = createRateLimiter(20, 60_000)
const allowActivityRate = createRateLimiter(120, 60_000)
const allowCompeteRate = createRateLimiter(30, 60_000)
const allowAuthRate = createRateLimiter(20, 60_000)
const allowHistoryRate = createRateLimiter(120, 60_000)
let state = { version: 1, plays: 0, sumPercent: 0, updatedAt: null }
let loaded = false
let loadPromise = null

let trailSalt = ''
let trailSaltPromise = null
let trailCache = new Map() // trailId -> trail
let leaderboards = {} // { trailId: { entries: [...], updatedAt } }
let authDb = { version: 1, users: {}, sessions: {} } // { users: { sub: { name, picture } }, sessions: { token: { sub, exp } } }
let leaderboardsLoaded = false
let authDbLoaded = false

let lexFr = null
let byLenFr = []
let lexEn = null
let byLenEn = []
let lexEs = null
let byLenEs = []
let lexCa = null
let byLenCa = []

// Tile values, bags and hard-tile sets come from web/tiles.js. Ranked Spanish
// play always uses the international (FISE) 100-tile set: CH, LL and RR are
// single tiles (encoded '1','2','3'), there is no K or W, and a blank may not
// stand for them. Catalan has one tile set, with NY, QU and L·L as single
// tiles (encoded '4','5','6') and Ç as a letter of its own. Words and racks
// are tile-encoded internally and decoded at the HTTP boundary.

function specFor(lang) {
  return tileSpec(lang, 'fise')
}

/** Uppercase + tile-encode an incoming word for this language. */
function tileForm(lang, raw) {
  const up = String(raw || '').toUpperCase()
  if (lang === 'es') return encodeTiles(up.replace(/[^A-ZÑ123·\- ]/g, ''), 'es', 'fise')
  if (lang === 'ca') return encodeTiles(up.replace(/[^A-ZÇ456·\- ]/g, ''), 'ca')
  return up.replace(/[^A-ZÑ]/g, '')
}

/** Uppercase + tile-encode an incoming rack (keeps blanks) for this language. */
function tileRackForm(lang, raw) {
  const up = String(raw || '').toUpperCase()
  if (lang === 'es') return encodeTiles(up.replace(/[^A-ZÑ123?.*·\- ]/g, ''), 'es', 'fise')
  if (lang === 'ca') return encodeTiles(up.replace(/[^A-ZÇ456?.*·\- ]/g, ''), 'ca')
  return up.replace(/[^A-ZÑ?]/g, '')
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

/** Languages with their own weekly trail; French is the unsuffixed default. */
const TRAIL_LANGS = ['en', 'es', 'ca']

function parseLang(raw) {
  const s = String(raw || '').toLowerCase()
  for (const lang of TRAIL_LANGS) {
    if (s === lang || s.endsWith(`-${lang}`)) return lang
  }
  return 'fr'
}

function trailLang(trailId) {
  return parseLang(trailId)
}

function trailKids(trailId) {
  return String(trailId || '').includes('-kids')
}

function trailPeriod(trailId) {
  return String(trailId || '')
    .replace(/-kids/, '')
    .replace(new RegExp(`-(?:${TRAIL_LANGS.join('|')})$`), '')
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

function parisDateString(date = new Date()) {
  const { y, m, d } = parisYmd(date)
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function isWeekPeriod(id) {
  return /^\d{4}-W\d{2}$/.test(trailPeriod(id))
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
  if (TRAIL_LANGS.includes(lang)) id += `-${lang}`
  return id
}

function todayTrailId(lang = 'fr', kids = false) {
  return isoWeekTrailId(new Date(), lang, kids)
}

function normalizeTrailId(id, lang, kids = false) {
  if (!id) return todayTrailId(lang, kids)
  const s = String(id)
  if (s.includes('-kids') || new RegExp(`-(?:${TRAIL_LANGS.join('|')})$`).test(s)) return s
  if (/^\d{4}-W\d{2}$/.test(s) || /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    let next = s
    if (kids) next += '-kids'
    if (TRAIL_LANGS.includes(lang)) next += `-${lang}`
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
  if (lang === 'es') {
    if (lexEs) return
    const words = await readLexiconFile('rla-es.txt.gz')
    lexEs = words
    byLenEs = Array.from({ length: 16 }, () => [])
    for (const w of words) {
      const e = encodeTiles(w, 'es', 'fise')
      // FISE has no K/W tiles and blanks may not stand for them.
      if (e.length < 2 || e.length > 15 || /[KW]/.test(e)) continue
      byLenEs[e.length].push(e)
    }
    console.log(`Loaded ES ${words.length} words, byLen[7]=${byLenEs[7]?.length || 0}`)
    return
  }
  if (lang === 'ca') {
    if (lexCa) return
    const words = await readLexiconFile('disc-ca.txt.gz')
    lexCa = words
    byLenCa = Array.from({ length: 16 }, () => [])
    for (const w of words) {
      const e = encodeTiles(w, 'ca')
      if (e.length < 2 || e.length > 15) continue
      byLenCa[e.length].push(e)
    }
    console.log(`Loaded CA ${words.length} words, byLen[7]=${byLenCa[7]?.length || 0}`)
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

function byLengthFor(lang) {
  if (lang === 'en') return byLenEn
  if (lang === 'es') return byLenEs
  if (lang === 'ca') return byLenCa
  return byLenFr
}

function valuesFor(lang) {
  return specFor(lang).values
}

function bagFor(lang) {
  return specFor(lang).bag
}

function scoreWord(word, jokerSet = new Set(), values = specFor('fr').values) {
  let n = 0
  for (let i = 0; i < word.length; i++) {
    if (jokerSet.has(i)) continue
    n += values[word[i]] || 0
  }
  return n
}

function rackCounts(rack) {
  const counts = Object.create(null)
  let blanks = 0
  for (const ch of rack) {
    if (ch === '?' || ch === '.' || ch === '*') blanks++
    else if (/^[A-ZÑÇ123456]$/.test(ch)) counts[ch] = (counts[ch] || 0) + 1
  }
  return { counts, blanks, tiles: rack.length }
}

function formable(word, counts, blanks) {
  let need = 0
  const used = Object.create(null)
  const jokers = []
  for (let i = 0; i < word.length; i++) {
    const ch = word[i]
    used[ch] = (used[ch] || 0) + 1
    if (used[ch] > (counts[ch] || 0)) {
      need++
      jokers.push(i)
      if (need > blanks) return null
    }
  }
  return jokers
}

function usesHard(word, jokers = [], hard = specFor('fr').hard) {
  const jk = new Set(jokers)
  return [...word].some((ch, i) => hard.has(ch) && !jk.has(i))
}

function anagrams(rack, byLen = byLenFr, values = specFor('fr').values) {
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
  if (!trailSaltPromise) {
    trailSaltPromise = (async () => {
      try {
        trailSalt = (await readFile(TRAIL_SALT_FILE, 'utf8')).trim()
        if (!trailSalt) throw new Error('Empty trail salt')
      } catch (err) {
        if (err.code !== 'ENOENT') throw err
        const candidate = randomBytes(32).toString('hex')
        await mkdir(dirname(TRAIL_SALT_FILE), { recursive: true, mode: 0o700 })
        try {
          await writeFile(TRAIL_SALT_FILE, candidate + '\n', { mode: 0o600, flag: 'wx' })
          trailSalt = candidate
        } catch (writeError) {
          if (writeError.code !== 'EEXIST') throw writeError
          trailSalt = (await readFile(TRAIL_SALT_FILE, 'utf8')).trim()
          if (!trailSalt) throw new Error('Empty trail salt')
        }
      }
      return trailSalt
    })().finally(() => { trailSaltPromise = null })
  }
  return trailSaltPromise
}

async function loadKidsLong(lang) {
  return kidsLong(lang)
}

async function generateTrail(trailId) {
  try {
    const lang = trailLang(trailId)
    await loadLexicon(lang)
    const byLen = byLengthFor(lang)
    const values = valuesFor(lang)
    const bag = bagFor(lang)
    const hard = specFor(lang).hard
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
      const hiddenSeed = tileForm(lang, pickWord(pool))
      const rack = shuffleWord(hiddenSeed)
      return { trailId, category: 'kids', rack, groups: kidsCatalog(rack, lang, values), seed: hiddenSeed }
    }

    // Build pools
    const bingo = byLen[7] || []
    const long = byLen[6] || []
    if (!bingo.length && !long.length) {
      throw new Error(`No 6-7 letter words found in lexicon (byLen[7]=${bingo.length}, byLen[6]=${long.length})`)
    }
    const bingoRich = bingo.filter((w) => scoreWord(w, new Set(), values) >= 12)
    const longRich = long.filter((w) => scoreWord(w, new Set(), values) >= 11)
    const hardPool = []
    for (let len = 3; len <= 5; len++) {
      for (const w of byLen[len] || []) {
        if (usesHard(w, [], hard) && scoreWord(w, new Set(), values) >= 11) hardPool.push(w)
      }
    }
    const fillTiles = (used, n) => {
      const available = []
      const have = {}
      for (const ch of used) have[ch] = (have[ch] || 0) + 1
      for (const [ch, max] of Object.entries(bag)) {
        for (let i = have[ch] || 0; i < max; i++) available.push(ch)
      }
      let out = ''
      for (let i = 0; i < n && available.length; i++) {
        const idx = Math.floor(rng.next() * available.length)
        out += available.splice(idx, 1)[0]
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
      } else if (hardPool.length > 0) {
        category = 'hard'
        hiddenSeed = pickWord(hardPool)
        const extra = hiddenSeed.length === 3 ? fillTiles(hiddenSeed, 1) : ''
        rack = shuffleWord(hiddenSeed + extra)
      } else {
        continue
      }
      const groups = anagrams(rack, byLen, values)
      const best = groups[0]?.words[0]
      if (!best) continue
      const hardBest = usesHard(best.word, best.jokers, hard)
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

const MAX_CACHED_TRAILS = 32
async function getTrail(trailId) {
  if (trailCache.has(trailId)) return trailCache.get(trailId)
  const pending = generateTrail(trailId).catch((err) => {
    if (trailCache.get(trailId) === pending) trailCache.delete(trailId)
    throw err
  })
  trailCache.set(trailId, pending)
  if (trailCache.size > MAX_CACHED_TRAILS) trailCache.delete(trailCache.keys().next().value)
  return pending
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

function kidsCatalog(rack, lang, values) {
  const displayRack = decodeRack(rack, lang, 'fise')
  return kidsAnagrams(displayRack, lang, 'fise').map((group) => ({
    ...group,
    words: group.words.map((entry) => {
      const encoded = tileForm(lang, entry.word)
      return { ...entry, word: encoded, score: scoreWord(encoded, new Set(), values) }
    }),
  }))
}

function sortedLetters(word) {
  return [...String(word || '')].sort().join('')
}

function isKidsDealRack(lang, rack) {
  const key = sortedLetters(rack)
  if (key.length < 2) return false
  return kidsLong(lang).some((word) => sortedLetters(tileForm(lang, word)) === key)
}

export async function officialPlays(trailId) {
  const trail = await getTrail(trailId)
  const lang = trailLang(trailId)
  const groups = trail.groups || anagrams(
    trail.rack,
    byLengthFor(lang),
    valuesFor(lang)
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
    word: decodeWord(hit.word),
    pts: hit.pts,
    best: decodeWord(best.word),
    bestPts: best.pts,
    percent,
    ...extra,
  }
}

export async function scoreOfficialPlay(trailId, word) {
  const form = tileForm(trailLang(trailId), word)
  if (form.length < 2 || form.length > 15) return { ok: false, error: 'not_playable' }
  const { plays, lang, rack } = await officialPlays(trailId)
  return scoreFromPlays(plays, form, { trailId, lang, rack: decodeRack(rack, lang, 'fise') })
}

export async function scorePlayOnRack(lang, rackRaw, word) {
  lang = parseLang(lang)
  const rack = tileRackForm(lang, rackRaw)
  const form = tileForm(lang, word)
  if (rack.length < 2 || rack.length > 7 || form.length < 2 || form.length > rack.length) return { ok: false, error: 'not_playable' }
  await loadLexicon(lang)
  const byLen = byLengthFor(lang)
  const values = valuesFor(lang)
  const plays = catalogFromGroups(anagrams(rack, byLen, values))
  return scoreFromPlays(plays, form, { lang, rack: decodeRack(rack, lang, 'fise') })
}

export async function scoreKidsPlayOnRack(lang, rackRaw, word) {
  lang = parseLang(lang)
  const rack = tileRackForm(lang, rackRaw)
  const form = tileForm(lang, word)
  if (rack.length < 2 || form.length < 2 || form.length > rack.length) return { ok: false, error: 'not_playable' }
  if (!isKidsDealRack(lang, rack)) return { ok: false, error: 'not_playable' }
  return scoreFromPlays(catalogFromGroups(kidsCatalog(rack, lang, valuesFor(lang))), form, { lang, rack: decodeRack(rack, lang, 'fise') })
}

async function scoreCompetePlay(trailId, word, opts = {}) {
  const official = await scoreOfficialPlay(trailId, word)
  if (official.ok) return official
  const rack = tileRackForm(opts.lang || trailLang(trailId), opts.rack)
  if (rack.length < 2) return official
  const lang = opts.lang || trailLang(trailId)
  return trailKids(trailId) || opts.kids
    ? scoreKidsPlayOnRack(lang, rack, word)
    : scorePlayOnRack(lang, rack, word)
}

// ========== Anonymous game stats (unchanged) ==========
async function load() {
  if (loaded) return state
  if (!loadPromise) loadPromise = (async () => {
    try {
      const raw = JSON.parse(await readFile(FILE, 'utf8'))
      if (raw?.version !== 1 || !Number.isFinite(raw.plays) || !Number.isFinite(raw.sumPercent)) throw new Error('Invalid game statistics file')
      state = { ...state, ...raw }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
    loaded = true
    return state
  })().finally(() => { loadPromise = null })
  return loadPromise
}

let saveChain = Promise.resolve()

function snapshot() {
  const average = state.plays ? Math.round((state.sumPercent / state.plays) * 10) / 10 : 0
  return { ok: true, average, plays: state.plays, updatedAt: state.updatedAt }
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

async function persistSignup(row) {
  await mkdir(dirname(SIGNUP_FILE), { recursive: true, mode: 0o700 })
  await appendFile(SIGNUP_FILE, JSON.stringify(row) + '\n', { mode: 0o600 })
}

function placeLine(row) {
  const flag = flagEmoji(row.country)
  return [flag, row.countryName || row.country, row.region, row.city].filter(Boolean).join(' · ')
}

function formatWhen(iso) {
  const d = new Date(iso || Date.now())
  if (Number.isNaN(d.getTime())) return String(iso || '')
  return d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')
}

function mailSnippet(text, max = 56) {
  const one = String(text || '').replace(/\s+/g, ' ').trim()
  if (!one) return ''
  return one.length > max ? `${one.slice(0, max - 1)}…` : one
}

function geoMetaLines(row) {
  const place = placeLine(row)
  return [
    place ? `Place: ${place}` : '',
    row.isp ? `Network: ${row.isp}` : '',
    row.ip ? `IP: ${row.ip}` : '',
    row.ua ? `UA: ${row.ua}` : '',
    row.acceptLang ? `Accept-Language: ${row.acceptLang}` : '',
  ].filter(Boolean)
}

export function formatFeedbackMail(row) {
  const meta = [
    row.email ? `Reply-to: ${row.email}` : 'Reply-to: (none)',
    row.account ? `Account: ${row.account}` : '',
    row.name && row.name !== row.account ? `Name: ${row.name}` : '',
    `When: ${formatWhen(row.at)}`,
    `Lang: ${row.lang || 'fr'}`,
    `Source: ${row.source || 'web'}`,
    row.app ? `App: ${row.app}` : '',
    row.device ? `Device: ${row.device}` : '',
    row.page ? `Page: ${row.page}` : '',
    ...geoMetaLines(row),
  ].filter(Boolean)
  return [row.message || '', '', ...meta].join('\n')
}

export function formatSignupMail(row) {
  return [
    `Email: ${row.email}`,
    `Play beta: ${row.beta ? 'yes' : 'no'}`,
    `Newsletter: ${row.newsletter ? 'yes' : 'no'}`,
    row.beta ? `Play opt-in: ${PLAY_TESTING_URL}` : '',
    `When: ${formatWhen(row.at)}`,
    `Lang: ${row.lang || 'fr'}`,
    `Source: ${row.source || 'landing'}`,
    ...geoMetaLines(row),
  ].filter(Boolean).join('\n')
}

export function formatTesterInviteMail(row) {
  const email = String(row.email || '').trim()
  const packs = {
    fr: {
      subject: 'Verimots — lien d’opt-in Google Play',
      text: [
        'Tu es inscrit pour le test fermé Verimots.',
        '',
        `1. On ajoute ${email} à la liste des testeurs Play.`,
        '2. Ensuite ouvre ce lien (même compte Google) :',
        PLAY_TESTING_URL,
        '3. Accepte de devenir testeur, puis installe Verimots depuis Play.',
        '',
        'En attendant, joue tout de suite dans le navigateur :',
        PLAY_WEB_URL,
        '',
        'Email seulement pour l’invitation. Pas de pub.',
      ].join('\n'),
    },
    en: {
      subject: 'Verimots — Google Play opt-in link',
      text: [
        'You signed up for the Verimots closed test.',
        '',
        `1. We add ${email} to the Play tester list.`,
        '2. Then open this link (same Google account):',
        PLAY_TESTING_URL,
        '3. Become a tester, then install Verimots from Play.',
        '',
        'Meanwhile, play in the browser now:',
        PLAY_WEB_URL,
        '',
        'Email only for the invite. No ads.',
      ].join('\n'),
    },
    es: {
      subject: 'Verimots — enlace de acceso de Google Play',
      text: [
        'Te has apuntado a la prueba cerrada de Verimots.',
        '',
        `1. Añadimos ${email} a la lista de testers de Play.`,
        '2. Luego abre este enlace (la misma cuenta de Google):',
        PLAY_TESTING_URL,
        '3. Acepta ser tester e instala Verimots desde Play.',
        '',
        'Mientras tanto, juega ya en el navegador:',
        PLAY_WEB_URL,
        '',
        'Email solo para la invitación. Sin publicidad.',
      ].join('\n'),
    },
  }
  return packs[parseLang(row.lang)] || packs.fr
}

function feedbackSubject(row) {
  const where = [row.lang, row.source, row.country].filter(Boolean).join('/')
  const bit = mailSnippet(row.message)
  // The shared pfa87 widget (edge-injected on every site) reports through this
  // same handler with source=widget and app=<hostname>: name the site, not Verimots.
  const site = row.source === 'widget' && /^[a-z0-9.-]+$/i.test(row.app || '') ? row.app : ''
  const head = site ? `${site} feedback` : 'Verimots feedback'
  return bit ? `${head} (${where}): ${bit}` : `${head} (${where})`
}

async function requestContext(req) {
  const geo = await enrichIpInfo(ipInfo(req))
  return {
    ip: geo.ip || clientIp(req),
    country: geo.country || '',
    countryName: geo.countryName || '',
    region: geo.region || '',
    city: geo.city || '',
    isp: geo.isp || geo.org || geo.asName || '',
    ua: cleanFeedbackText(req.headers['user-agent'], 180),
    acceptLang: cleanFeedbackText(req.headers['accept-language'], 80),
  }
}

async function mailSignup(row) {
  if (skipFeedbackMail) return { mailed: false, skipped: true }
  const secret = mailRelaySecret()
  if (!secret) return { mailed: false, skipped: true }
  const kinds = []
  if (row.beta) kinds.push('Play beta')
  if (row.newsletter) kinds.push('newsletter')
  const place = row.country || row.countryName || ''
  const res = await fetch(MAIL_RELAY_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secret}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      to: [FEEDBACK_TO],
      subject: `Verimots signup (${kinds.join(' + ') || 'email'}${place ? ` · ${place}` : ''}): ${row.email}`,
      text: formatSignupMail(row),
      replyTo: row.email,
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

async function mailTesterInvite(row) {
  if (skipFeedbackMail || !row?.beta) return { mailed: false, skipped: true }
  const email = validEmail(row.email)
  if (!email || email === FEEDBACK_TO) return { mailed: false, skipped: true }
  const secret = mailRelaySecret()
  if (!secret) return { mailed: false, skipped: true }
  const invite = formatTesterInviteMail({ ...row, email })
  const res = await fetch(MAIL_RELAY_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secret}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      to: [email],
      subject: invite.subject,
      text: invite.text,
      fromName: 'Verimots',
    }),
    signal: AbortSignal.timeout(12_000),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`tester mail ${res.status} ${err.slice(0, 180)}`)
  }
  return { mailed: true }
}

async function mailFeedback(row) {
  if (skipFeedbackMail) return { mailed: false, skipped: true }
  const secret = mailRelaySecret()
  if (!secret) return { mailed: false, skipped: true }
  const res = await fetch(MAIL_RELAY_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secret}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      to: [FEEDBACK_TO],
      subject: feedbackSubject(row),
      text: formatFeedbackMail(row),
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


async function readJson(req, limit = 2048) {
  const chunks = []
  let n = 0
  const source = typeof req.iterator === 'function' ? req.iterator({ destroyOnReturn: false }) : req
  for await (const c of source) {
    n += c.length
    if (n > limit) {
      req.resume?.()
      throw new Error('body too large')
    }
    chunks.push(c)
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  const value = raw ? JSON.parse(raw) : {}
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a JSON object')
  return value
}

export async function recordPercent(percent) {
  if (typeof percent !== 'number' || !Number.isFinite(percent)) throw new Error('bad percent')
  const p = Math.max(0, Math.min(100, Math.round(percent)))
  const operation = saveChain.then(async () => {
    await load()
    const next = { ...state, plays: state.plays + 1, sumPercent: state.sumPercent + p, updatedAt: new Date().toISOString() }
    await writeJsonAtomic(FILE, next)
    state = next
    return snapshot()
  })
  saveChain = operation.catch(() => {})
  return operation
}

export async function gameStats() {
  await load()
  return snapshot()
}

// ========== Leaderboard ==========
let boardLock = Promise.resolve()
let authLock = Promise.resolve()

async function writeJsonAtomic(file, value) {
  await mkdir(dirname(file), { recursive: true, mode: 0o700 })
  const tmp = `${file}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`
  try {
    await writeFile(tmp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 })
    for (let attempt = 0; ; attempt++) {
      try { await rename(tmp, file); break }
      catch (err) {
        if (process.platform !== 'win32' || !['EPERM', 'EACCES', 'EBUSY'].includes(err.code) || attempt >= 5) throw err
        await delay(10 * 2 ** attempt)
      }
    }
  } catch (err) {
    await rm(tmp, { force: true }).catch(() => {})
    throw err
  }
}

async function loadLeaderboards() {
  if (leaderboardsLoaded) return
  try {
    const raw = JSON.parse(await readFile(LEADERBOARD_FILE, 'utf8'))
    if (raw?.version !== 1 || !raw.boards || typeof raw.boards !== 'object' || Array.isArray(raw.boards)) throw new Error('Invalid leaderboard file')
    leaderboards = raw.boards
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  leaderboardsLoaded = true
}

async function saveLeaderboards() {
  await writeJsonAtomic(LEADERBOARD_FILE, { version: 1, boards: leaderboards })
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
  } catch (err) {
    leaderboards = {}
    leaderboardsLoaded = false
    throw err
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

// Ranking currency: every ranked game earns its percent of the best word
// (0–100 pts), so a board line is the sum of a player's games. Playing more
// can only move you up, a strong game moves you up five times faster than a
// weak one, and a pass (0 pts) is a wasted round rather than a penalty.
// Ranking by the mean made one perfect game outrank forty good ones and
// turned every extra game into a risk — the opposite of what a board is for.
export function entryPoints(entry) {
  const sum = Number(entry?.sumPercent)
  if (Number.isFinite(sum)) return Math.max(0, Math.round(sum))
  const n = Math.max(1, Number(entry?.plays) || 1)
  const p = Number(entry?.percent)
  return Number.isFinite(p) ? Math.max(0, Math.round(p * n)) : 0
}

function publicEntry(entry, rank) {
  return {
    rank,
    pseudo: entry.pseudo,
    points: entryPoints(entry),
    percent: entryAverage(entry),
    plays: Math.max(1, Number(entry.plays) || 1),
    word: entry.word || null,
    pts: entry.pts || null,
    timestamp: entry.timestamp,
  }
}

// Points first; the average then the play count break ties; the earlier
// player keeps the higher place when everything else is equal.
export function compareBoardEntries(a, b) {
  const points = entryPoints(b) - entryPoints(a)
  if (points) return points
  const d = entryAverage(b) - entryAverage(a)
  if (d) return d
  const plays = (Number(b.plays) || 1) - (Number(a.plays) || 1)
  if (plays) return plays
  return new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
}

function sortBoard(board) {
  board.entries.sort(compareBoardEntries)
}

const BOARD_LANGS = ['fr', 'en', 'es', 'ca']

function anyPublicEntry(entry, rank, extra = {}) {
  return { ...publicEntry(entry, rank), lang: entry.lang, ...extra }
}

async function recordCompete(trailId, sub, pseudo, scored) {
  return withBoardLock(async () => {
  await loadLeaderboards()
  if (!(await getMe(sub))) return { ok: false, error: 'user_not_found' }
  if (!Object.hasOwn(leaderboards, trailId)) {
    leaderboards[trailId] = { entries: [], updatedAt: null }
  }
  const board = leaderboards[trailId]
  const idx = board.entries.findIndex((e) => e.sub === sub)
  const stamp = new Date().toISOString()
  if (idx >= 0) {
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
      // A pass lowers the average but keeps the last real word on the board.
      word: scored.pass ? prev.word : scored.word,
      pts: scored.pass ? prev.pts : scored.pts,
      timestamp: stamp,
      days: addDayPlay(prev.days, stamp, scored),
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
      days: addDayPlay({}, stamp, scored),
    })
  }
  sortBoard(board)
  board.updatedAt = stamp
  await saveLeaderboards()
  const entry = board.entries.find((e) => e.sub === sub)
  if (idx < 0) await recordUserPlay(sub, trailId, scored)
  else await updateUserBest(sub, scored, stamp)
  return {
    ok: true,
    points: entryPoints(entry),
    percent: entryAverage(entry),
    plays: entry?.plays || 1,
    word: scored.word,
    pts: scored.pts,
  }
  })
}

async function getLeaderboard(trailId, sessionSub = null) {
  return withBoardLock(async () => {
    await loadLeaderboards()
    const board = Object.hasOwn(leaderboards, trailId) ? leaderboards[trailId] : null
    if (!board || !board.entries.length) {
      return { ok: true, trailId, scope: 'week', lang: trailLang(trailId), total: 0, top: [], me: null }
    }
    sortBoard(board)
    const top = board.entries.slice(0, 50).map((e, i) => publicEntry(e, i + 1))
    let me = null
    if (sessionSub) {
      const idx = board.entries.findIndex((e) => e.sub === sessionSub)
      if (idx !== -1) me = publicEntry(board.entries[idx], idx + 1)
    }
    return { ok: true, trailId, scope: 'week', lang: trailLang(trailId), total: board.entries.length, top, me }
  })
}

function addDayPlay(days, stamp, scored) {
  const key = parisDateString(new Date(stamp))
  const next = { ...(days && typeof days === 'object' ? days : {}) }
  const prev = next[key]
  if (!prev) {
    next[key] = {
      plays: 1,
      sumPercent: scored.percent,
      percent: scored.percent,
      word: scored.pass ? null : scored.word,
      pts: scored.pass ? 0 : scored.pts,
      timestamp: stamp,
    }
    return next
  }
  const plays = (Number(prev.plays) || 1) + 1
  const sumPercent = (Number(prev.sumPercent) || Number(prev.percent) || 0) + scored.percent
  next[key] = {
    ...prev,
    plays,
    sumPercent,
    percent: Math.round((10 * sumPercent) / plays) / 10,
    word: scored.pass ? prev.word : scored.word,
    pts: scored.pass ? prev.pts : scored.pts,
    timestamp: stamp,
  }
  return next
}

function daySlice(entry, day) {
  const stored = entry?.days?.[day]
  if (stored && (Number(stored.plays) || 0) > 0) {
    return {
      sub: entry.sub,
      pseudo: entry.pseudo,
      lang: entry.lang,
      plays: stored.plays,
      sumPercent: stored.sumPercent,
      percent: stored.percent,
      word: stored.word,
      pts: stored.pts,
      timestamp: stored.timestamp,
    }
  }
  if (Number(entry?.plays || 1) === 1 && entry?.timestamp && parisDateString(new Date(entry.timestamp)) === day) {
    const percent = entryAverage(entry)
    return {
      sub: entry.sub,
      pseudo: entry.pseudo,
      lang: entry.lang,
      plays: 1,
      sumPercent: percent,
      percent,
      word: entry.word,
      pts: entry.pts,
      timestamp: entry.timestamp,
    }
  }
  return null
}

async function getDayBoard(lang, kids, sessionSub = null) {
  return withBoardLock(async () => {
    await loadLeaderboards()
    const day = parisDateString()
    const trailId = todayTrailId(lang, kids)
    const entries = []
    for (const entry of leaderboards[trailId]?.entries || []) {
      const slice = daySlice(entry, day)
      if (slice) entries.push(slice)
    }
    const board = { entries }
    sortBoard(board)
    const top = board.entries.slice(0, 50).map((e, i) => publicEntry(e, i + 1))
    let me = null
    if (sessionSub) {
      const idx = board.entries.findIndex((e) => e.sub === sessionSub)
      if (idx !== -1) me = publicEntry(board.entries[idx], idx + 1)
    }
    return { ok: true, trailId, scope: 'day', lang, total: board.entries.length, top, me, date: day }
  })
}

async function getAnyDayBoard(kids, sessionSub = null) {
  return withBoardLock(async () => {
    await loadLeaderboards()
    const day = parisDateString()
    const entries = []
    for (const lang of BOARD_LANGS) {
      const source = leaderboards[todayTrailId(lang, kids)]
      if (!source?.entries?.length) continue
      for (const entry of source.entries) {
        const slice = daySlice(entry, day)
        if (slice) entries.push({ ...slice, lang })
      }
    }
    const board = { entries }
    sortBoard(board)
    const top = board.entries.slice(0, 50).map((entry, index) => anyPublicEntry(entry, index + 1))
    const mine = sessionSub
      ? board.entries
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => entry.sub === sessionSub)
        .map(({ entry, index }) => anyPublicEntry(entry, index + 1))
      : []
    return {
      ok: true,
      trailId: 'any',
      scope: 'day',
      lang: 'any',
      total: board.entries.length,
      top,
      me: mine[0] || null,
      mine,
      date: day,
    }
  })
}

// Merge this week's language-specific boards without deduplicating accounts:
// one player may therefore have separate FR, EN and ES rows.
async function getAnyLeaderboard(kids, sessionSub = null) {
  return withBoardLock(async () => {
    await loadLeaderboards()
    const entries = []
    for (const lang of BOARD_LANGS) {
      const board = leaderboards[todayTrailId(lang, kids)]
      if (!board?.entries?.length) continue
      for (const entry of board.entries) entries.push({ ...entry, lang })
    }
    const board = { entries }
    sortBoard(board)
    const top = board.entries.slice(0, 50).map((entry, index) => anyPublicEntry(entry, index + 1))
    const mine = sessionSub
      ? board.entries
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => entry.sub === sessionSub)
        .map(({ entry, index }) => anyPublicEntry(entry, index + 1))
      : []
    return { ok: true, trailId: 'any', scope: 'week', lang: 'any', total: board.entries.length, top, me: mine[0] || null, mine }
  })
}

// "Général": every weekly board of the same language / level folded into one
// all-time standing per player — nobody drops off when the ISO week rolls over.
async function getGeneralBoard(lang, kids, sessionSub = null) {
  return withBoardLock(async () => {
    await loadLeaderboards()
    const agg = new Map()
    let weeks = 0
    for (const [id, board] of Object.entries(leaderboards)) {
      if (!isWeekPeriod(id) || trailLang(id) !== lang || trailKids(id) !== !!kids) continue
      if (!board?.entries?.length) continue
      weeks++
      for (const e of board.entries) {
        if (!e?.sub) continue
        const plays = Math.max(1, Number(e.plays) || 1)
        const sum = Number.isFinite(Number(e.sumPercent)) ? Number(e.sumPercent) : (Number(e.percent) || 0) * plays
        const row = agg.get(e.sub) || { sub: e.sub, pseudo: e.pseudo, plays: 0, sumPercent: 0, word: null, pts: 0, timestamp: null, weeks: 0 }
        row.plays += plays
        row.sumPercent += sum
        row.weeks += 1
        if (e.word && (Number(e.pts) || 0) >= (row.pts || 0)) {
          row.word = e.word
          row.pts = Number(e.pts) || 0
        }
        if (!row.timestamp || new Date(e.timestamp || 0) > new Date(row.timestamp)) {
          row.timestamp = e.timestamp
          if (e.pseudo) row.pseudo = e.pseudo
        }
        agg.set(e.sub, row)
      }
    }
    const board = { entries: [...agg.values()] }
    sortBoard(board)
    const pub = (e, i) => ({ ...publicEntry(e, i + 1), weeks: e.weeks })
    const top = board.entries.slice(0, 100).map(pub)
    let me = null
    if (sessionSub) {
      const idx = board.entries.findIndex((e) => e.sub === sessionSub)
      if (idx !== -1) me = pub(board.entries[idx], idx)
    }
    return { ok: true, trailId: 'all', scope: 'all', lang, total: board.entries.length, top, me, weeks }
  })
}

// All-time merged board. Aggregation remains per (language, account), so a
// multilingual player retains one independent standing for each language.
async function getAnyGeneralBoard(kids, sessionSub = null) {
  return withBoardLock(async () => {
    await loadLeaderboards()
    const agg = new Map()
    const periods = new Set()
    for (const [id, source] of Object.entries(leaderboards)) {
      const lang = trailLang(id)
      if (!isWeekPeriod(id) || !BOARD_LANGS.includes(lang) || trailKids(id) !== !!kids) continue
      if (!source?.entries?.length) continue
      periods.add(trailPeriod(id))
      for (const entry of source.entries) {
        if (!entry?.sub) continue
        const key = `${lang}\u0000${entry.sub}`
        const plays = Math.max(1, Number(entry.plays) || 1)
        const sum = Number.isFinite(Number(entry.sumPercent))
          ? Number(entry.sumPercent)
          : (Number(entry.percent) || 0) * plays
        const row = agg.get(key) || {
          sub: entry.sub,
          lang,
          pseudo: entry.pseudo,
          plays: 0,
          sumPercent: 0,
          word: null,
          pts: 0,
          timestamp: null,
          weeks: 0,
        }
        row.plays += plays
        row.sumPercent += sum
        row.weeks += 1
        if (entry.word && (Number(entry.pts) || 0) >= (row.pts || 0)) {
          row.word = entry.word
          row.pts = Number(entry.pts) || 0
        }
        if (!row.timestamp || new Date(entry.timestamp || 0) > new Date(row.timestamp)) {
          row.timestamp = entry.timestamp
          if (entry.pseudo) row.pseudo = entry.pseudo
        }
        agg.set(key, row)
      }
    }
    const board = { entries: [...agg.values()] }
    sortBoard(board)
    const publish = (entry, index) => anyPublicEntry(entry, index + 1, { weeks: entry.weeks })
    const top = board.entries.slice(0, 100).map(publish)
    const mine = sessionSub
      ? board.entries
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => entry.sub === sessionSub)
        .map(({ entry, index }) => publish(entry, index))
      : []
    return {
      ok: true,
      trailId: 'any',
      scope: 'all',
      lang: 'any',
      total: board.entries.length,
      top,
      me: mine[0] || null,
      mine,
      weeks: periods.size,
    }
  })
}

// ========== Dictionary and practice activity ==========
// These boards count server-validated words, not client-supplied scores. Old
// history is deliberately not backfilled: it is capped, deduplicated and has
// no reliable language or game mode. Lifetime counters survive history clears.
const ACTIVITY_CATEGORIES = ['checks', 'find', 'training']
const ACTIVITY_ID = /^[A-Za-z0-9._:-]{1,96}$/
const ACTIVITY_RETRY_DAYS = 35
const MAX_ACTIVITY_RECENT = 20_000
const activityLexicons = new Map()
const ACTIVITY_DICTIONARIES = {
  ods: { lang: 'fr', file: 'ods9.txt.gz' },
  csw: { lang: 'en', file: 'yawl.txt.gz' },
  wow24: { lang: 'en', file: 'wow24.txt.gz' },
  rla: { lang: 'es', file: 'rla-es.txt.gz' },
  disc: { lang: 'ca', file: 'disc-ca.txt.gz' },
}

function activityHash(value) {
  return createHash('sha256').update(value).digest('base64url').slice(0, 24)
}


async function validateActivity(body) {
  const category = String(body?.category || '')
  const lang = String(body?.lang || '')
  const id = String(body?.id || '')
  if (!ACTIVITY_CATEGORIES.includes(category) || !BOARD_LANGS.includes(lang) || !ACTIVITY_ID.test(id)) {
    return { error: 'invalid_activity' }
  }
  // Reject malformed input instead of silently turning punctuation or digits
  // into another word. Digraph tile encodings are internal only at this route.
  const rawWord = String(body.word || '').toUpperCase()
  if (!/^[A-ZÑÇ·]{2,20}$/.test(rawWord)) return { error: 'invalid_word' }
  const dict = String(body.dict || ({ fr: 'ods', en: 'wow24', es: 'rla', ca: 'disc' }[lang]))
  const dictionary = Object.hasOwn(ACTIVITY_DICTIONARIES, dict) ? ACTIVITY_DICTIONARIES[dict] : null
  if (!dictionary || dictionary.lang !== lang) return { error: 'invalid_dictionary' }
  if (!activityLexicons.has(dict)) {
    activityLexicons.set(dict, readLexiconFile(dictionary.file).then((words) => new Set(words)).catch((err) => {
      activityLexicons.delete(dict)
      throw err
    }))
  }
  if (!(await activityLexicons.get(dict)).has(rawWord)) return { error: 'word_not_in_dictionary' }
  const edition = body.edition === 'na' ? 'na' : 'fise'
  const word = encodeTiles(rawWord, lang, edition)
  const result = { category, lang, id: activityHash(id), key: activityHash(id) }
  if (category !== 'checks') {
    const roundId = String(body.roundId || '')
    const rawRack = String(body.rack || '').toUpperCase()
    if (!ACTIVITY_ID.test(roundId) || !/^[A-ZÑÇ·123456?.* \-]{2,40}$/.test(rawRack)) return { error: 'invalid_round' }
    const rack = encodeTiles(rawRack.replace(/[.*]/g, '?'), lang, edition)
    const values = tileSpec(lang, edition).values
    if (rack.length < 2 || rack.length > 15 || [...rack].some((ch) => ch !== '?' && !Object.hasOwn(values, ch))) return { error: 'invalid_rack' }
    const { counts, blanks } = rackCounts(rack)
    if ([...word].some((ch) => !Object.hasOwn(values, ch)) || !formable(word, counts, blanks)) return { error: 'word_not_on_rack' }
    result.round = activityHash(`${category}\0${lang}\0${roundId}`)
    result.rack = activityHash(`${edition}\0${[...rack].sort().join('')}`)
    result.key = activityHash(`${result.round}\0${word}`)
  }
  return result
}

function addActivityCount(target, category, lang, count, timestamp) {
  target[category] ||= {}
  const previous = target[category][lang]
  target[category][lang] = {
    count: (Number(previous?.count) || 0) + count,
    timestamp: previous?.timestamp && previous.timestamp > timestamp ? previous.timestamp : timestamp,
  }
}

function activityState(user) {
  if (!user.activity || user.activity.version !== 1) {
    user.activity = { version: 1, startedAt: new Date().toISOString(), totals: {}, days: {}, recent: [] }
  }
  return user.activity
}

async function recordActivity(sub, event) {
  return withAuthLock(async () => {
    await loadAuthDb()
    const user = authDb.users[sub]
    if (!user) return { status: 401, error: 'user_not_found' }
    const activity = activityState(user)
    const stamp = new Date().toISOString()
    // Keep one month of idempotency keys and per-round checks. Only hashes are
    // kept here; looked-up words are never exposed by activity leaderboards.
    const cutoff = new Date(Date.now() - ACTIVITY_RETRY_DAYS * 86400_000).toISOString()
    const recent = activity.recent.filter((row) => row.at >= cutoff)
    if (recent.some((row) => row.id === event.id || row.key === event.key)) {
      return { ok: true, duplicate: true, category: event.category, count: activity.totals[event.category]?.[event.lang]?.count || 0 }
    }
    if (event.round && recent.some((row) => row.round === event.round && row.rack !== event.rack)) {
      return { status: 400, error: 'round_rack_changed' }
    }
    if (recent.length >= MAX_ACTIVITY_RECENT) return { status: 429, error: 'activity_limit' }
    const day = parisDateString()
    addActivityCount(activity.totals, event.category, event.lang, 1, stamp)
    activity.days[day] ||= {}
    addActivityCount(activity.days[day], event.category, event.lang, 1, stamp)
    activity.recent = [...recent, { ...event, at: stamp }]
    // Day/week views use current buckets; retain a year for future summaries.
    const oldDay = parisDateString(new Date(Date.now() - 400 * 86400_000))
    for (const key of Object.keys(activity.days)) if (key < oldDay) delete activity.days[key]
    user.updatedAt = stamp
    await saveAuthDb()
    return { ok: true, duplicate: false, category: event.category, count: activity.totals[event.category][event.lang].count }
  })
}

// Calendar-day windows use Paris dates and UTC date arithmetic so DST does
// not turn a seven-day range into six or eight calendar dates.
export function boardDateRange(scope, now = new Date()) {
  const days = scope === '7d' ? 7 : scope === '30d' ? 30 : 0
  if (!days) return null
  const end = parisDateString(now)
  const start = new Date(`${end}T12:00:00Z`)
  start.setUTCDate(start.getUTCDate() - days + 1)
  return { start: start.toISOString().slice(0, 10), end }
}

function inBoardRange(day, range) {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && day >= range.start && day <= range.end
}

// Use dated counters, never attribute a whole weekly aggregate to its last
// update. Legacy daily entries and single-play entries have a known date.
function rangeSlices(entry, period, range) {
  if (entry.days && Object.keys(entry.days).length) {
    return Object.entries(entry.days).filter(([day, row]) => inBoardRange(day, range) && row?.plays > 0).map(([, row]) => row)
  }
  if (inBoardRange(period, range)) return [entry]
  if (Number(entry.plays || 1) === 1 && entry.timestamp) {
    const stamp = new Date(entry.timestamp)
    if (Number.isFinite(stamp.getTime()) && inBoardRange(parisDateString(stamp), range)) return [entry]
  }
  return []
}

async function getRollingBoard(lang, kids, scope, sessionSub) {
  return withBoardLock(async () => {
    await loadLeaderboards()
    const range = boardDateRange(scope)
    const rows = new Map()
    for (const [id, source] of Object.entries(leaderboards)) {
      const rowLang = trailLang(id), period = trailPeriod(id)
      if (!BOARD_LANGS.includes(rowLang) || trailKids(id) !== !!kids || (lang !== 'any' && rowLang !== lang)) continue
      if (!isWeekPeriod(id) && !/^\d{4}-\d{2}-\d{2}$/.test(period)) continue
      for (const entry of source?.entries || []) {
        if (!entry.sub) continue
        for (const slice of rangeSlices(entry, period, range)) {
          const key = `${rowLang}\0${entry.sub}`
          const row = rows.get(key) || { sub: entry.sub, pseudo: entry.pseudo, lang: rowLang, plays: 0, sumPercent: 0, timestamp: null }
          const plays = Math.max(1, Number(slice.plays) || 1)
          row.plays += plays
          row.sumPercent += Number.isFinite(Number(slice.sumPercent)) ? Number(slice.sumPercent) : (Number(slice.percent) || 0) * plays
          if (!row.timestamp || slice.timestamp > row.timestamp) {
            row.timestamp = slice.timestamp
            row.word = slice.word || null
            row.pts = slice.pts || 0
            row.pseudo = entry.pseudo
          }
          rows.set(key, row)
        }
      }
    }
    const entries = [...rows.values()].sort(compareBoardEntries)
    const publish = (entry, index) => anyPublicEntry(entry, index + 1)
    const mine = entries.flatMap((entry, index) => entry.sub === sessionSub ? [publish(entry, index)] : [])
    return { ok: true, trailId: scope, scope, lang, kids, total: entries.length, top: entries.slice(0, 100).map(publish), me: mine[0] || null, mine, ...range }
  })
}

function activitySlice(activity, category, lang, scope) {
  if (scope === 'all') return activity?.totals?.[category]?.[lang] || null
  const today = parisDateString()
  const range = boardDateRange(scope)
  const week = todayTrailId()
  let count = 0
  let timestamp = null
  for (const [date, categories] of Object.entries(activity?.days || {})) {
    if (range ? !inBoardRange(date, range) : scope === 'day' ? date !== today : isoWeekTrailId(new Date(`${date}T12:00:00Z`)) !== week) continue
    const row = categories?.[category]?.[lang]
    if (!row?.count) continue
    count += row.count
    if (!timestamp || row.timestamp > timestamp) timestamp = row.timestamp
  }
  return count ? { count, timestamp } : null
}

async function getActivityBoard(category, lang, scope, sessionSub) {
  return withAuthLock(async () => {
    await loadAuthDb()
    const entries = []
    let trackingSince = null
    for (const [sub, user] of Object.entries(authDb.users)) {
      if (user.activity?.startedAt && (!trackingSince || user.activity.startedAt < trackingSince)) trackingSince = user.activity.startedAt
      for (const rowLang of lang === 'any' ? BOARD_LANGS : [lang]) {
        const row = activitySlice(user.activity, category, rowLang, scope)
        if (row?.count > 0) entries.push({ sub, pseudo: user.name || 'Anonyme', lang: rowLang, count: row.count, timestamp: row.timestamp })
      }
    }
    return publishCountBoard(entries, { category, lang, scope, sessionSub, trackingSince })
  })
}

function publishCountBoard(entries, { category, lang, scope, sessionSub, trackingSince, unit = 'words' }) {
  entries.sort((a, b) => b.count - a.count || new Date(a.timestamp || 0) - new Date(b.timestamp || 0) || a.pseudo.localeCompare(b.pseudo))
  const publish = ({ sub, ...row }, index) => ({ ...row, rank: index + 1, unit })
  const mine = entries.map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.sub === sessionSub)
    .map(({ entry, index }) => publish(entry, index))
  return {
    ok: true, category, unit, lang, scope, kids: false,
    trailId: scope === 'week' ? todayTrailId() : scope,
    date: scope === 'day' ? parisDateString() : null,
    total: entries.length, trackingSince,
    top: entries.slice(0, 100).map(publish), me: mine[0] || null, mine,
  }
}

// One activity is one validated lookup/found word or one ranked game. Ranked
// percentage points are deliberately excluded; every row shows the components.
async function getCombinedBoard(lang, scope, sessionSub) {
  // Ranked writes acquire these locks in this order too. Hold both while taking
  // the snapshot so simultaneous activity, play and account updates stay whole.
  return withBoardLock(() => withAuthLock(async () => {
    await loadLeaderboards()
    await loadAuthDb()
    const range = boardDateRange(scope)
    const entries = new Map()
    let trackingSince = null
    const day = parisDateString()
    const week = todayTrailId()
    function add(sub, rowLang, category, count, timestamp, pseudo) {
      if (!sub || !(count > 0) || !Number.isFinite(count) || (lang !== 'any' && rowLang !== lang)) return
      const key = `${sub}\0${rowLang}`
      const row = entries.get(key) || {
        sub, lang: rowLang, pseudo: authDb.users[sub]?.name || pseudo || 'Anonyme',
        count: 0, timestamp: null,
        breakdown: { checks: 0, find: 0, training: 0, bingo: 0, kids: 0 },
      }
      row.count += count
      row.breakdown[category] += count
      if (timestamp && (!row.timestamp || timestamp > row.timestamp)) row.timestamp = timestamp
      entries.set(key, row)
    }
    for (const [sub, user] of Object.entries(authDb.users)) {
      if (user.activity?.startedAt && (!trackingSince || user.activity.startedAt < trackingSince)) trackingSince = user.activity.startedAt
      for (const rowLang of lang === 'any' ? BOARD_LANGS : [lang]) {
        for (const category of ACTIVITY_CATEGORIES) {
          const row = activitySlice(user.activity, category, rowLang, scope)
          if (row) add(sub, rowLang, category, row.count, row.timestamp, user.name)
        }
      }
    }
    for (const [id, board] of Object.entries(leaderboards)) {
      const period = trailPeriod(id)
      const daily = /^\d{4}-\d{2}-\d{2}$/.test(period)
      if (!daily && !isWeekPeriod(id)) continue
      const rowLang = trailLang(id)
      if (lang !== 'any' && rowLang !== lang) continue
      const periodWeek = daily ? isoWeekTrailId(new Date(`${period}T12:00:00Z`)) : period
      if (scope === 'week' && periodWeek !== week) continue
      const category = trailKids(id) ? 'kids' : 'bingo'
      for (const entry of board?.entries || []) {
        if (range) {
          for (const slice of rangeSlices(entry, period, range)) {
            add(entry.sub, rowLang, category, Math.max(1, Number(slice.plays) || 1), slice.timestamp, entry.pseudo)
          }
          continue
        }
        let slice = entry
        if (scope === 'day') {
          const savedDay = entry.days?.[day]
          if (savedDay?.plays > 0) slice = savedDay
          else if (daily && period === day) slice = entry
          else if (Number(entry.plays || 1) === 1 && entry.timestamp && parisDateString(new Date(entry.timestamp)) === day) slice = entry
          else continue // A historical weekly aggregate cannot supply daily counts.
        }
        add(entry.sub, rowLang, category, Math.max(1, Number(slice.plays) || 1), slice.timestamp, entry.pseudo)
      }
    }
    return publishCountBoard([...entries.values()], {
      category: 'combined', unit: 'activities', lang, scope, sessionSub, trackingSince,
    })
  }))
}

function mergeGuestActivity(user, guest) {
  if (!guest.activity) return
  const target = activityState(user)
  const source = guest.activity
  if (source.startedAt < target.startedAt) target.startedAt = source.startedAt
  const add = (out, input) => {
    for (const category of ACTIVITY_CATEGORIES) {
      for (const lang of BOARD_LANGS) {
        const row = input?.[category]?.[lang]
        if (row?.count > 0) addActivityCount(out, category, lang, row.count, row.timestamp)
      }
    }
  }
  add(target.totals, source.totals)
  for (const [day, rows] of Object.entries(source.days || {})) {
    target.days[day] ||= {}
    add(target.days[day], rows)
  }
  const seen = new Set(target.recent.map((row) => row.id))
  for (const row of source.recent || []) if (!seen.has(row.id)) {
    target.recent.push(row)
    seen.add(row.id)
  }
}

// ========== Auth ==========
async function loadAuthDb() {
  if (authDbLoaded) return
  try {
    const raw = JSON.parse(await readFile(AUTH_DB_FILE, 'utf8'))
    if (raw?.version !== 1 || !raw.users || typeof raw.users !== 'object' || Array.isArray(raw.users) || !raw.sessions || typeof raw.sessions !== 'object' || Array.isArray(raw.sessions)) throw new Error('Invalid account file')
    authDb = raw
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  authDbLoaded = true
}

async function saveAuthDb() {
  await writeJsonAtomic(AUTH_DB_FILE, authDb)
}

async function withAuthLock(fn) {
  const prev = authLock
  let release
  authLock = new Promise((resolve) => {
    release = resolve
  })
  await prev
  try {
    return await fn()
  } catch (err) {
    authDb = { version: 1, users: {}, sessions: {} }
    authDbLoaded = false
    throw err
  } finally {
    release()
  }
}

function getSessionSecret() {
  if (cachedSessionSecret) return cachedSessionSecret
  try {
    cachedSessionSecret = readFileSync(SESSION_SECRET_FILE, 'utf8').trim()
    if (!cachedSessionSecret) throw new Error('Empty session secret')
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
    const candidate = randomBytes(32).toString('hex')
    mkdirSync(dirname(SESSION_SECRET_FILE), { recursive: true, mode: 0o700 })
    try {
      writeFileSync(SESSION_SECRET_FILE, candidate + '\n', { mode: 0o600, flag: 'wx' })
      cachedSessionSecret = candidate
    } catch (writeError) {
      if (writeError.code !== 'EEXIST') throw writeError
      cachedSessionSecret = readFileSync(SESSION_SECRET_FILE, 'utf8').trim()
      if (!cachedSessionSecret) throw new Error('Empty session secret')
    }
  }
  return cachedSessionSecret
}

function signSession(sub) {
  const exp = Date.now() + 30 * 24 * 60 * 60 * 1000
  const payload = JSON.stringify({ sub, exp, sid: randomBytes(16).toString('base64url') })
  const sig = createHmac('sha256', getSessionSecret()).update(payload).digest('hex')
  return Buffer.from(payload).toString('base64url') + '.' + sig
}

function verifySession(token) {
  if (typeof token !== 'string' || token.length > 2048 || !/^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/.test(token)) return null
  const [payloadB64, sig] = token.split('.')
  const payload = Buffer.from(payloadB64, 'base64url').toString('utf8')
  const expectedSig = createHmac('sha256', getSessionSecret()).update(payload).digest()
  if (!timingSafeEqual(Buffer.from(sig, 'hex'), expectedSig)) return null
  try {
    const value = JSON.parse(payload)
    if (!value || typeof value.sub !== 'string' || !value.sub || value.sub.length > 200 || !Number.isFinite(value.exp) || Date.now() >= value.exp) return null
    return value
  } catch {
    return null
  }
}

function requestSessionToken(req) {
  const matches = String(req.headers.cookie || '').split(';').map((part) => part.trim()).filter((part) => part.startsWith('ods9_session='))
  return matches.length === 1 ? matches[0].slice('ods9_session='.length) : ''
}

async function getSessionFromRequest(req) {
  const token = requestSessionToken(req)
  const session = verifySession(token)
  if (!session) return null
  return withAuthLock(async () => {
    await loadAuthDb()
    return authDb.revokedSessions?.[activityHash(token)] ? null : session.sub
  })
}

function secureCookie(req, url) {
  return url.protocol === 'https:' || req.socket?.encrypted || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https' ? '; Secure' : ''
}

const googleClient = new OAuth2Client(WEB_CLIENT_ID)

async function handleGoogleAuth(idToken) {
  if (!WEB_CLIENT_ID) {
    return { ok: false, error: 'google_not_configured' }
  }
  if (typeof idToken !== 'string' || idToken.length < 20 || idToken.length > 16_384) return { ok: false, error: 'invalid_token' }
  const client = googleClient
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: WEB_CLIENT_ID })
    const payload = ticket.getPayload()
    if (!payload || typeof payload.sub !== 'string' || !payload.sub) return { ok: false, error: 'invalid_token' }
    const { sub, name, picture } = payload
    await mergeGoogleUser(sub, name, picture)
    const sessionToken = signSession(sub)
    return { ok: true, sessionToken, user: { sub, name, picture } }
  } catch (err) {
    return { ok: false, error: 'invalid_token' }
  }
}

async function mergeGoogleUser(sub, name, picture) {
  return withAuthLock(async () => {
    await loadAuthDb()
    const previous = authDb.users[sub] || {}
    const user = {
      ...previous,
      name,
      picture,
      updatedAt: new Date().toISOString(),
    }
    authDb.users[sub] = user
    await saveAuthDb()
    return user
  })
}

export async function mergeGoogleUserForTests(sub, name, picture) {
  return mergeGoogleUser(sub, name, picture)
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
  const activityTotal = (category) => Object.values(user?.activity?.totals?.[category] || {}).reduce((n, row) => n + (Number(row.count) || 0), 0)
  return {
    words: history.length,
    plays,
    points: Math.max(0, Math.round(sum)),
    average: plays ? Math.round((sum / plays) * 10) / 10 : 0,
    best: Number(user?.bestPercent) || 0,
    streak: Number(user?.streak) || 0,
    checks: activityTotal('checks'),
    findWords: activityTotal('find'),
    trainingWords: activityTotal('training'),
  }
}

async function recordUserPlay(sub, trailId, scored) {
  return withAuthLock(async () => {
    await loadAuthDb()
    const user = authDb.users[sub]
    if (!user) return
    const last = user.lastTrailId || ''
    const samePeriod = last && trailPeriod(last) === trailPeriod(trailId)
    if (last === trailId || samePeriod) {
      /* streak already counted for this period */
    } else if (last && trailPeriod(last) === shiftPeriod(trailId, -1)) {
      user.streak = (Number(user.streak) || 0) + 1
    } else {
      user.streak = 1
    }
    user.lastTrailId = trailId
    user.plays = (Number(user.plays) || 0) + 1
    user.sumPercent = (Number(user.sumPercent) || 0) + scored.percent
    user.bestPercent = Math.max(Number(user.bestPercent) || 0, scored.percent)
    user.updatedAt = new Date().toISOString()
    if (scored.word) rememberUserWord(user, { word: scored.word, pts: scored.pts, src: 'defi' })
    await saveAuthDb()
  })
}

// Later games of a week: the streak is already counted, but every game still
// adds to the account's plays / points so "all time" matches the boards.
async function updateUserBest(sub, scored, stamp) {
  return withAuthLock(async () => {
    await loadAuthDb()
    const user = authDb.users[sub]
    if (!user) return
    user.plays = (Number(user.plays) || 0) + 1
    user.sumPercent = (Number(user.sumPercent) || 0) + scored.percent
    user.bestPercent = Math.max(Number(user.bestPercent) || 0, scored.percent)
    if (scored.word) rememberUserWord(user, { word: scored.word, pts: scored.pts, src: 'defi' })
    user.updatedAt = stamp
    await saveAuthDb()
  })
}

// Stored words are in display form, so the tile alphabet includes Ñ (Spanish),
// Ç and the interpunct of the Catalan L·L tile. Length is bounded in characters,
// not tiles: the longest 15-tile word runs to 18 characters in Catalan
// (DODECASIL·LABIQUES) and 17 in Spanish (ACHICHARRONABAMOS).
const WORD_CHARS = /[^A-ZÑÇ·]/g
const MAX_WORD_CHARS = 20

function rememberUserWord(user, entry) {
  const word = String(entry?.word || '')
    .toUpperCase()
    .replace(WORD_CHARS, '')
  if (word.length < 2 || word.length > MAX_WORD_CHARS) return user.history || []
  const value = Number(entry.pts)
  const pts = Number.isFinite(value) ? Math.max(0, Math.min(1000, Math.round(value))) : 0
  const src = entry.src === 'dico' ? 'dico' : 'defi'
  const timestamp = Number(entry.at)
  const at = Number.isFinite(timestamp) && timestamp > 0 ? Math.min(timestamp, Date.now()) : Date.now()
  const prev = Array.isArray(user.history) ? user.history : []
  user.history = [{ word, pts, src, at }, ...prev.filter((row) => row.word !== word)].slice(0, 80)
  return user.history
}

async function getMe(sub) {
  if (!sub) return null
  return withAuthLock(async () => {
    await loadAuthDb()
    const user = authDb.users[sub]
    if (!user) return null
    return { sub, name: user.name, picture: user.picture, guest: !!user.guest, stats: publicStats(user) }
  })
}

// ========== Guest identities ==========
// A player who never signs in still gets a board row: "user100001",
// "user100002"… minted from a persisted counter. The sub is random so the
// pseudo cannot be guessed into someone else's session; the session token is
// the same HMAC cookie a Google account gets.
const GUEST_PREFIX = 'guest:'
const GUEST_BASE = 100000

export function isGuestSub(sub) {
  return typeof sub === 'string' && sub.startsWith(GUEST_PREFIX)
}

async function createGuest() {
  return withAuthLock(async () => {
    await loadAuthDb()
    const seq = (Number(authDb.guestSeq) || 0) + 1
    authDb.guestSeq = seq
    const sub = GUEST_PREFIX + randomBytes(9).toString('base64url')
    const name = `user${GUEST_BASE + seq}`
    const stamp = new Date().toISOString()
    authDb.users[sub] = { name, picture: '', guest: true, history: [], plays: 0, sumPercent: 0, createdAt: stamp, updatedAt: stamp }
    await saveAuthDb()
    return { sub, name, picture: '', guest: true }
  })
}

function mergeCountedPlays(a, b) {
  if (!a) return { ...b }
  if (!b) return { ...a }
  const playsOf = (entry) => Math.max(1, Number(entry.plays) || 1)
  const sumOf = (entry) => Number.isFinite(Number(entry.sumPercent)) ? Number(entry.sumPercent) : (Number(entry.percent) || 0) * playsOf(entry)
  const plays = playsOf(a) + playsOf(b)
  const sumPercent = sumOf(a) + sumOf(b)
  const recent = String(a.timestamp || '') > String(b.timestamp || '') ? a : b
  const other = recent === a ? b : a
  return { ...recent, plays, sumPercent, percent: Math.round(10 * sumPercent / plays) / 10, word: recent.word || other.word, pts: recent.word ? recent.pts : other.pts }
}

// Transfer both board and profile under the same lock order as ranked writes.
// Existing account games remain additive when a guest signs into that account.
async function adoptGuest(guestSub, sub, name) {
  if (!isGuestSub(guestSub) || !sub || guestSub === sub) return false
  return withBoardLock(() => withAuthLock(async () => {
    await loadLeaderboards()
    await loadAuthDb()
    const guest = authDb.users[guestSub]
    const user = authDb.users[sub]
    if (!guest || !user) return false
    let changed = false
    for (const board of Object.values(leaderboards)) {
      const gi = (board?.entries || []).findIndex((entry) => entry.sub === guestSub)
      if (gi < 0) continue
      const guestEntry = board.entries[gi]
      const ai = board.entries.findIndex((entry) => entry.sub === sub)
      if (ai >= 0) {
        const accountEntry = board.entries[ai]
        const merged = mergeCountedPlays(accountEntry, guestEntry)
        merged.days = { ...(accountEntry.days || {}) }
        for (const [day, row] of Object.entries(guestEntry.days || {})) merged.days[day] = mergeCountedPlays(merged.days[day], row)
        board.entries[ai] = { ...merged, sub, pseudo: name || accountEntry.pseudo }
        board.entries.splice(gi, 1)
      } else board.entries[gi] = { ...guestEntry, sub, pseudo: name || guestEntry.pseudo }
      sortBoard(board)
      changed = true
    }
    user.plays = (Number(user.plays) || 0) + (Number(guest.plays) || 0)
    user.sumPercent = (Number(user.sumPercent) || 0) + (Number(guest.sumPercent) || 0)
    user.bestPercent = Math.max(Number(user.bestPercent) || 0, Number(guest.bestPercent) || 0)
    if (String(guest.lastTrailId || '') > String(user.lastTrailId || '')) {
      user.lastTrailId = guest.lastTrailId
      user.streak = guest.streak
    } else if (trailPeriod(guest.lastTrailId) === trailPeriod(user.lastTrailId)) {
      user.streak = Math.max(Number(user.streak) || 0, Number(guest.streak) || 0)
    }
    for (const row of [...(guest.history || [])].reverse()) rememberUserWord(user, row)
    mergeGuestActivity(user, guest)
    user.updatedAt = new Date().toISOString()
    delete authDb.users[guestSub]
    if (changed) await saveLeaderboards()
    await saveAuthDb()
    return true
  }))
}

export async function adoptGuestForTests(guestSub, sub, name) {
  return adoptGuest(guestSub, sub, name)
}

export function seedUserForTests(sub, user = {}) {
  cachedSessionSecret = process.env.SESSION_SECRET || 'test-session-secret'
  authDbLoaded = true
  authDb.users[sub] = { name: 'Test', picture: '', history: [], plays: 0, sumPercent: 0, ...user }
}

export function seedLeaderboardForTests(trailId, entries = []) {
  leaderboardsLoaded = true
  leaderboards[trailId] = { entries: structuredClone(entries), updatedAt: null }
}

export function sessionCookieForTests(sub) {
  cachedSessionSecret = process.env.SESSION_SECRET || 'test-session-secret'
  return 'ods9_session=' + signSession(sub)
}

// ========== Handler ==========
export async function handleOdsGame(req, res, url, helpers) {
  const { json } = helpers
  const path = url.pathname.replace(/\/$/, '') || url.pathname
  if (isCrossOriginMutation(req, url)) {
    json(res, 403, { ok: false, error: 'cross_origin_request' }, {}, req.method)
    return true
  }

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
          rack: decodeRack(trail.rack, lang, 'fise'),
          seed: kids ? (trail.seed ? decodeWord(trail.seed) : null) : null,
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
    const rawLang = String(url.searchParams.get('lang') || '').toLowerCase()
    const anyLanguage = rawLang === 'any'
    const lang = anyLanguage ? 'any' : parseLang(rawLang)
    const category = String(url.searchParams.get('category') || '').toLowerCase()
    if (category && !['bingo', 'kids', 'combined', ...ACTIVITY_CATEGORIES].includes(category)) {
      json(res, 400, { ok: false, error: 'invalid_category' }, { 'Cache-Control': 'no-store' }, req.method)
      return true
    }
    const kids = category === 'kids' || (!category && url.searchParams.get('kids') === '1')
    const sessionSub = await getSessionFromRequest(req)
    const scope = String(url.searchParams.get('scope') || '').toLowerCase()
    if (category === 'combined') {
      const board = await getCombinedBoard(lang, ['all', 'day', '7d', '30d'].includes(scope) ? scope : 'week', sessionSub)
      json(res, 200, board, { 'Cache-Control': 'no-store' }, req.method)
      return true
    }
    if (ACTIVITY_CATEGORIES.includes(category)) {
      const board = await getActivityBoard(category, lang, ['all', 'day', '7d', '30d'].includes(scope) ? scope : 'week', sessionSub)
      json(res, 200, board, { 'Cache-Control': 'no-store' }, req.method)
      return true
    }
    const describe = (board) => Object.assign(board, { category: board.kids ? 'kids' : 'bingo', unit: 'points' })
    if (boardDateRange(scope)) {
      const board = await getRollingBoard(lang, kids, scope, sessionSub)
      json(res, 200, describe(board), { 'Cache-Control': 'no-store' }, req.method)
      return true
    }
    if (scope === 'all') {
      const general = anyLanguage
        ? await getAnyGeneralBoard(kids, sessionSub)
        : await getGeneralBoard(lang, kids, sessionSub)
      general.kids = kids
      json(res, 200, describe(general), { 'Cache-Control': 'no-store' }, req.method)
      return true
    }
    if (scope === 'day') {
      const daily = anyLanguage
        ? await getAnyDayBoard(kids, sessionSub)
        : await getDayBoard(lang, kids, sessionSub)
      daily.kids = kids
      json(res, 200, describe(daily), { 'Cache-Control': 'no-store' }, req.method)
      return true
    }
    if (anyLanguage) {
      const board = await getAnyLeaderboard(kids, sessionSub)
      board.kids = kids
      json(res, 200, describe(board), { 'Cache-Control': 'no-store' }, req.method)
      return true
    }
    const trailId = normalizeTrailId(url.searchParams.get('trailId'), lang, kids)
    const board = await getLeaderboard(trailId, sessionSub)
    board.kids = kids || trailKids(trailId)
    json(res, 200, describe(board), { 'Cache-Control': 'no-store' }, req.method)
    return true
  }

  if (path === '/api/game/activity') {
    if (req.method !== 'POST') {
      json(res, 405, { ok: false, error: 'POST only' }, {}, req.method)
      return true
    }
    const sub = await getSessionFromRequest(req)
    if (!sub || !(await getMe(sub))) {
      json(res, 401, { ok: false, error: 'login_required' }, { 'Cache-Control': 'no-store' }, req.method)
      return true
    }
    if (!allowActivityRate(sub)) {
      json(res, 429, { ok: false, error: 'Too many activities' }, { 'Retry-After': '60', 'Cache-Control': 'no-store' }, req.method)
      return true
    }
    let body
    try {
      body = await readJson(req)
    } catch {
      json(res, 400, { ok: false, error: 'invalid_activity' }, { 'Cache-Control': 'no-store' }, req.method)
      return true
    }
    try {
      if (body?.owner && body.owner !== sub) {
        json(res, 409, { ok: false, error: 'session_changed' }, { 'Cache-Control': 'no-store' }, req.method)
        return true
      }
      const event = await validateActivity(body)
      if (event.error) {
        json(res, 400, { ok: false, error: event.error }, { 'Cache-Control': 'no-store' }, req.method)
        return true
      }
      const result = await recordActivity(sub, event)
      const { status = 200, ...payload } = result
      json(res, status, { ok: !result.error, ...payload }, { 'Cache-Control': 'no-store' }, req.method)
    } catch (err) {
      console.error('Activity recording failed:', err?.message || err)
      json(res, 503, { ok: false, error: 'activity_unavailable' }, { 'Cache-Control': 'no-store' }, req.method)
    }
    return true
  }

  // Compete (requires login)
  if (path === '/api/game/compete') {
    if (req.method !== 'POST') {
      json(res, 405, { ok: false, error: 'POST only' }, {}, req.method)
      return true
    }
    const sessionSub = await getSessionFromRequest(req)
    if (!sessionSub) {
      json(res, 401, { ok: false, error: 'login_required' }, {}, req.method)
      return true
    }
    if (!allowCompeteRate(sessionSub)) {
      json(res, 429, { ok: false, error: 'Too many scores' }, { 'Retry-After': '60' }, req.method)
      return true
    }
    try {
      const body = await readJson(req)
      if (body?.owner && body.owner !== sessionSub) {
        json(res, 409, { ok: false, error: 'session_changed' }, { 'Cache-Control': 'no-store' }, req.method)
        return true
      }
      const word = typeof body.word === 'string' ? body.word.toUpperCase() : ''
      if (word && !/^[A-ZÑÇ·123456]{2,20}$/.test(word)) {
        json(res, 400, { ok: false, error: 'invalid_word' }, {}, req.method)
        return true
      }
      // A pass is an explicit 0 % play: it counts in the weekly average.
      const pass = body.pass === true || body.pass === 1 || body.pass === '1'
      if (!word && !pass) {
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
      const rack = String(body.rack || '').slice(0, 30)
      const scored = pass
        ? { ok: true, pass: true, word: '', pts: 0, percent: 0 }
        : await scoreCompetePlay(trailId, word, { lang, kids, rack })
      if (!scored.ok) {
        json(res, 400, scored, { 'Cache-Control': 'no-store' }, req.method)
        return true
      }
      const pseudo = user.name || 'Anonyme'
      const result = await recordCompete(trailId, sessionSub, pseudo, scored)
      json(
        res,
        result.ok ? 200 : 400,
        result.ok ? { ...scored, ...result } : result,
        { 'Cache-Control': 'no-store' },
        req.method
      )
    } catch (err) {
      console.error('Compete request failed:', err?.code || err?.message || 'Error')
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
    if (!allowAuthRate(clientIp(req))) {
      json(res, 429, { ok: false, error: 'Too many requests' }, { 'Retry-After': '60' }, req.method)
      return true
    }
    try {
      const body = await readJson(req, 20_000)
      const guestSub = await getSessionFromRequest(req)
      const result = await handleGoogleAuth(body.idToken)
      if (result.ok && isGuestSub(guestSub)) await adoptGuest(guestSub, result.user.sub, result.user.name)
      if (result.ok) {
        const secure = secureCookie(req, url)
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

  if (path === '/api/auth/guest') {
    if (req.method !== 'POST') {
      json(res, 405, { ok: false, error: 'POST only' }, {}, req.method)
      return true
    }
    if (!allowRate(clientIp(req))) {
      json(res, 429, { ok: false, error: 'Too many requests' }, {}, req.method)
      return true
    }
    // Idempotent: a device that already holds a session (guest or Google)
    // gets that identity back instead of a fresh counter value.
    const existingSub = await getSessionFromRequest(req)
    const existing = existingSub ? await getMe(existingSub) : null
    const user = existing || (await createGuest())
    const sessionToken = signSession(user.sub)
    const secure = secureCookie(req, url)
    const cookie = `ods9_session=${sessionToken}; HttpOnly; Path=/; Max-Age=2592000; SameSite=Lax${secure}`
    json(
      res,
      200,
      { ok: true, user: { sub: user.sub, name: user.name, picture: user.picture || '', guest: !!user.guest }, sessionToken },
      { 'Set-Cookie': cookie, 'Cache-Control': 'no-store' },
      req.method
    )
    return true
  }

  if (path === '/api/auth/me') {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      json(res, 405, { ok: false, error: 'GET only' }, {}, req.method)
      return true
    }
    const sessionSub = await getSessionFromRequest(req)
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
    const sessionSub = await getSessionFromRequest(req)
    if (!sessionSub) {
      json(res, 401, { ok: false, error: 'login_required' }, {}, req.method)
      return true
    }
    if (req.method !== 'GET' && req.method !== 'HEAD' && !allowHistoryRate(sessionSub)) {
      json(res, 429, { ok: false, error: 'Too many requests' }, { 'Retry-After': '60' }, req.method)
      return true
    }
    let entry = null
    if (req.method === 'POST') {
      try {
        entry = await readJson(req)
      } catch {
        json(res, 400, { ok: false, error: 'Invalid history' }, {}, req.method)
        return true
      }
    }
    const owner = req.method === 'POST' ? entry?.owner : req.headers['x-verimots-owner']
    if (owner && owner !== sessionSub) {
      json(res, 409, { ok: false, error: 'session_changed' }, {}, req.method)
      return true
    }
    const result = await withAuthLock(async () => {
      await loadAuthDb()
      const user = authDb.users[sessionSub]
      if (!user) return null
      if (req.method === 'POST') {
        rememberUserWord(user, entry)
        user.updatedAt = new Date().toISOString()
        await saveAuthDb()
      } else if (req.method === 'DELETE') {
        user.history = []
        user.updatedAt = new Date().toISOString()
        await saveAuthDb()
      }
      return { history: [...(user.history || [])], stats: publicStats(user) }
    })
    if (!result) {
      json(res, 401, { ok: false, error: 'user_not_found' }, {}, req.method)
      return true
    }
    json(
      res,
      200,
      { ok: true, ...result },
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
    const token = requestSessionToken(req)
    const session = verifySession(token)
    if (session) await withAuthLock(async () => {
      await loadAuthDb()
      authDb.revokedSessions ||= {}
      for (const [key, exp] of Object.entries(authDb.revokedSessions)) if (exp <= Date.now()) delete authDb.revokedSessions[key]
      authDb.revokedSessions[activityHash(token)] = session.exp
      await saveAuthDb()
    })
    const cookie = 'ods9_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax' + secureCookie(req, url)
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
      const ctx = await requestContext(req)
      const me = await getMe(await getSessionFromRequest(req))
      const row = {
        at: new Date().toISOString(),
        message,
        email: email || '',
        name: cleanFeedbackText(body.name, 80) || me?.name || '',
        account: me?.name || '',
        lang: parseLang(body.lang),
        source: cleanFeedbackText(body.source, 40) || 'web',
        app: cleanFeedbackText(body.app || body.version, 60),
        device: cleanFeedbackText(body.device, 80),
        page: cleanFeedbackText(body.page || body.path, 160),
        ...ctx,
        ip: ctx.ip || ip,
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

  if (path === '/api/game/signup') {
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
      const body = await readJson(req, 2048)
      if (String(body.website || body.hp || '').trim()) {
        json(res, 200, { ok: true }, { 'Cache-Control': 'no-store' }, req.method)
        return true
      }
      const email = validEmail(body.email)
      if (!email) {
        json(res, 400, { ok: false, error: 'email_required' }, {}, req.method)
        return true
      }
      const beta = body.beta === true || body.beta === 1 || body.beta === '1' || body.beta === 'on'
      const newsletter =
        body.newsletter === true || body.newsletter === 1 || body.newsletter === '1' || body.newsletter === 'on'
      if (!beta && !newsletter) {
        json(res, 400, { ok: false, error: 'choice_required' }, {}, req.method)
        return true
      }
      const ctx = await requestContext(req)
      const row = {
        at: new Date().toISOString(),
        email,
        beta,
        newsletter,
        lang: parseLang(body.lang),
        source: cleanFeedbackText(body.source, 40) || 'landing',
        ...ctx,
        ip: ctx.ip || ip,
      }
      await persistSignup(row)
      try {
        await mailSignup(row)
      } catch (err) {
        console.error('signup mail failed:', err?.message || err)
        json(res, 502, { ok: false, error: 'mail_failed' }, { 'Cache-Control': 'no-store' }, req.method)
        return true
      }
      try {
        await mailTesterInvite(row)
      } catch (err) {
        console.error('tester invite mail failed:', err?.message || err)
      }
      json(res, 200, { ok: true, beta, newsletter, optin: beta ? PLAY_TESTING_URL : '' }, { 'Cache-Control': 'no-store' }, req.method)
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
  allowRate.clear()
  allowActivityRate.clear()
  allowFeedbackRate.clear()
  allowCompeteRate.clear()
  allowAuthRate.clear()
  allowHistoryRate.clear()
  saveChain = Promise.resolve()
  loadPromise = null
  trailSaltPromise = null
  skipFeedbackMail = true
  if (file) {
    FEEDBACK_FILE = String(file).replace(/\.json$/i, '.jsonl')
    SIGNUP_FILE = String(file).replace(/\.json$/i, '-signup.jsonl')
  }
  trailCache.clear()
  leaderboards = {}
  authDb = { version: 1, users: {}, sessions: {} }
  leaderboardsLoaded = true
  authDbLoaded = true
  boardLock = Promise.resolve()
  authLock = Promise.resolve()
  trailSalt = saltFile ? '' : 'test-salt-' + randomBytes(16).toString('hex')
  cachedSessionSecret = process.env.SESSION_SECRET || 'test-session-secret'
}
