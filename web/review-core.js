// Révisions: the draws a player missed, brought back on a spaced schedule.
// Pure functions over plain arrays, no imports: the page (review.js), the
// server sync (scripts/ods-game.mjs) and the tests share exactly these rules.
// The APK mirrors them in ReviewStore.java — change both together.

export const REVIEW_GAMES = ['bingo', 'find', 'combi']
// Days until the next review after each unaided success. A draw found again
// without help at every step (now, +1, +3, +7, +21 days) is mastered.
export const REVIEW_STEPS = [1, 3, 7, 21]
export const REVIEW_LIMIT = 300
export const REVIEW_TOMBSTONES = 200
export const TOMBSTONE_DAYS = 90
export const DAY_MS = 86_400_000
const MAX_TARGETS = 12
const LANGS = ['fr', 'en', 'es', 'ca']
const DICTS = ['ods', 'csw', 'wow24', 'rla', 'disc']
const PRESETS = ['all', 'seven', 'eight', 'plusOne', 'joker', 'hard', 'small']
const OUTCOMES = ['new', 'ok', 'help', 'miss']
// Display form: letters of every supported alphabet, the Catalan/Spanish
// separator '·' and the blank '?'. Words never carry a blank.
const RACK_CHARS = /^[A-ZÑÇ·?]{2,24}$/
const WORD_CHARS = /^[A-ZÑÇ·]{2,20}$/
const ID = /^[A-Za-z0-9_-]{6,40}$/

function int(value, lo, hi, fallback) {
  const n = Math.round(Number(value))
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback
}

function time(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback
}

function cleanWord(raw) {
  if (!raw || typeof raw !== 'object') return null
  const w = String(raw.w || '').toUpperCase()
  if (!WORD_CHARS.test(w)) return null
  return { w, p: int(raw.p, 0, 999, 0) }
}

export function newReviewId(random = Math.random) {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let id = ''
  for (let i = 0; i < 14; i++) id += abc[Math.floor(random() * abc.length)]
  return id
}

/** Same game, dictionary and tiles (in any order) = the same draw. */
export function reviewKey(item) {
  const tiles = [...String(item.rack || '')].sort().join('')
  const preset = item.game === 'combi' ? `|${item.preset || 'all'}|${item.min || 0}` : ''
  return `${item.dict}|${item.edition}|${item.game}${preset}|${tiles}`
}

/** Validates one stored or received entry; null when it cannot be trusted. */
export function cleanReview(raw) {
  if (!raw || typeof raw !== 'object' || !ID.test(String(raw.id || ''))) return null
  const updatedAt = time(raw.updatedAt)
  if (raw.deleted === true) return { id: raw.id, deleted: true, updatedAt }
  const lang = LANGS.includes(raw.lang) ? raw.lang : null
  const dict = DICTS.includes(raw.dict) ? raw.dict : null
  const game = REVIEW_GAMES.includes(raw.game) ? raw.game : null
  const rack = String(raw.rack || '').toUpperCase()
  if (!lang || !dict || !game || !RACK_CHARS.test(rack)) return null
  const seen = new Set()
  const targets = []
  for (const entry of Array.isArray(raw.targets) ? raw.targets : []) {
    const word = cleanWord(entry)
    if (!word || seen.has(word.w)) continue
    seen.add(word.w)
    targets.push(word)
    if (targets.length >= MAX_TARGETS) break
  }
  if (!targets.length) return null
  const missedAt = time(raw.missedAt, updatedAt)
  const item = {
    id: raw.id,
    lang,
    dict,
    edition: raw.edition === 'na' ? 'na' : 'fise',
    game,
    rack,
    targets,
    played: cleanWord(raw.played),
    missedAt,
    due: time(raw.due, missedAt),
    step: int(raw.step, 0, REVIEW_STEPS.length, 0),
    reps: int(raw.reps, 0, 9999, 0),
    lapses: int(raw.lapses, 0, 9999, 0),
    mastered: raw.mastered === true,
    last: OUTCOMES.includes(raw.last) ? raw.last : 'new',
    updatedAt,
  }
  if (game === 'combi') {
    item.preset = PRESETS.includes(raw.preset) ? raw.preset : 'all'
    item.min = int(raw.min, 2, 8, 2)
    item.max = int(raw.max, item.min, 8, 8)
    item.bonus = int(raw.bonus, -1, 8, -1)
  }
  return item
}

export function cleanReviews(rows) {
  const out = []
  for (const row of Array.isArray(rows) ? rows : []) {
    const item = cleanReview(row)
    if (item) out.push(item)
  }
  return out
}

export function liveReviews(items) {
  return (items || []).filter((item) => item && !item.deleted)
}

/**
 * A draw that ended without the words that mattered: the best word in Bingo
 * and Trouver un mot, every word still missing in Combinaisons. Missing the
 * same draw again brings it back to the start of the schedule.
 */
export function recordMiss(items, miss, now = Date.now(), random = Math.random) {
  const fresh = cleanReview({
    ...miss,
    id: newReviewId(random),
    missedAt: now,
    due: now,
    step: 0,
    reps: 0,
    lapses: 0,
    mastered: false,
    last: 'new',
    updatedAt: now,
  })
  if (!fresh) return { items: items || [], item: null }
  const key = reviewKey(fresh)
  const list = [...(items || [])]
  const at = list.findIndex((item) => item && !item.deleted && reviewKey(item) === key)
  if (at < 0) return { items: pruneReviews([fresh, ...list], now), item: fresh }
  const old = list[at]
  const targets = [...old.targets]
  for (const word of fresh.targets) {
    const same = targets.find((t) => t.w === word.w)
    if (same) same.p = Math.max(same.p, word.p)
    else if (targets.length < MAX_TARGETS) targets.push(word)
  }
  const merged = {
    ...old,
    targets,
    played: fresh.played || old.played,
    due: now,
    step: 0,
    lapses: old.lapses + (old.last === 'new' ? 0 : 1),
    mastered: false,
    last: old.last === 'new' ? 'new' : 'miss',
    updatedAt: now,
  }
  list.splice(at, 1)
  return { items: pruneReviews([merged, ...list], now), item: merged }
}

/**
 * Applies a review outcome. 'ok' = every word found without help, 'help' =
 * found after a hint, 'miss' = answer shown. Replaying a draw before it is due
 * never moves it forward: only spaced successes count. `cutoff` is the end of
 * the player's day, so a draw due tomorrow afternoon is ready all morning.
 */
export function gradeReview(item, outcome, now = Date.now(), cutoff = now) {
  if (!item || item.deleted || !['ok', 'help', 'miss'].includes(outcome)) return item
  const early = !item.mastered && item.due > cutoff
  const next = { ...item, last: outcome, updatedAt: now }
  if (outcome === 'miss') {
    return { ...next, step: 0, due: now + DAY_MS, lapses: item.lapses + 1, mastered: false }
  }
  if (item.mastered || early) return next
  if (outcome === 'help') return { ...next, due: now + DAY_MS }
  if (item.step >= REVIEW_STEPS.length) return { ...next, reps: item.reps + 1, mastered: true }
  return {
    ...next,
    reps: item.reps + 1,
    step: item.step + 1,
    due: now + REVIEW_STEPS[item.step] * DAY_MS,
  }
}

export function replaceReview(items, item) {
  return (items || []).map((row) => (row.id === item.id ? item : row))
}

export function deleteReview(items, id, now = Date.now()) {
  return pruneReviews((items || []).map((row) => (row.id === id ? { id, deleted: true, updatedAt: now } : row)), now)
}

export function isDue(item, now = Date.now()) {
  return !!item && !item.deleted && !item.mastered && item.due <= now
}

/** Due draws, the longest-waiting first. */
export function dueReviews(items, now = Date.now()) {
  return liveReviews(items)
    .filter((item) => isDue(item, now))
    .sort((a, b) => a.due - b.due || a.missedAt - b.missedAt)
}

export function reviewCounts(items, now = Date.now()) {
  const counts = { due: 0, later: 0, mastered: 0, total: 0, next: 0 }
  for (const item of liveReviews(items)) {
    counts.total++
    if (item.mastered) counts.mastered++
    else if (item.due <= now) counts.due++
    else {
      counts.later++
      if (!counts.next || item.due < counts.next) counts.next = item.due
    }
  }
  return counts
}

/** Keeps the newest deletions for sync and drops the oldest draws past the limit. */
export function pruneReviews(items, now = Date.now()) {
  const live = []
  const gone = []
  for (const item of items || []) {
    if (!item) continue
    if (item.deleted) {
      if (now - item.updatedAt <= TOMBSTONE_DAYS * DAY_MS) gone.push(item)
    } else live.push(item)
  }
  if (live.length > REVIEW_LIMIT) {
    // Mastered draws go first, oldest first; then the oldest misses.
    const order = [...live].sort((a, b) => (b.mastered - a.mastered) || a.updatedAt - b.updatedAt)
    const drop = new Set(order.slice(0, live.length - REVIEW_LIMIT).map((item) => item.id))
    for (let i = live.length - 1; i >= 0; i--) if (drop.has(live[i].id)) live.splice(i, 1)
  }
  gone.sort((a, b) => b.updatedAt - a.updatedAt)
  return [...live, ...gone.slice(0, REVIEW_TOMBSTONES)]
}

/**
 * Two copies of the list (two devices, or the server and a device): the
 * latest change to each draw wins, a deletion beats an edit made at the same
 * moment, and two ids for the same draw collapse into the newer one.
 */
export function mergeReviews(a, b, now = Date.now()) {
  const byId = new Map()
  for (const item of [...cleanReviews(a), ...cleanReviews(b)]) {
    const prev = byId.get(item.id)
    if (!prev || item.updatedAt > prev.updatedAt || (item.updatedAt === prev.updatedAt && item.deleted && !prev.deleted)) {
      byId.set(item.id, item)
    }
  }
  const byKey = new Map()
  const out = []
  for (const item of [...byId.values()].sort((x, y) => y.updatedAt - x.updatedAt)) {
    if (item.deleted) {
      out.push(item)
      continue
    }
    const key = reviewKey(item)
    if (byKey.has(key)) continue
    byKey.set(key, item)
    out.push(item)
  }
  return pruneReviews(out, now)
}
