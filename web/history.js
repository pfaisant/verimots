import { t, getLang } from './i18n.js?v=161'

/** BCP 47 tag for number and date formatting in the active UI language. */
function uiLocale() {
  return { en: 'en-GB', es: 'es-ES', ca: 'ca-ES' }[getLang()] || 'fr-FR'
}

const KEY = 'ods9-session-v1'
const MAX = 80

function webStore() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    /* blocked */
  }
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage
  } catch {
    /* blocked */
  }
  return null
}

function readStore(storage) {
  try {
    const raw = (storage || webStore())?.getItem(KEY)
    const rows = raw ? JSON.parse(raw) : []
    return cleanRows(rows)
  } catch {
    return []
  }
}

function writeStore(storage, rows) {
  try {
    ;(storage || webStore())?.setItem(KEY, JSON.stringify(rows))
  } catch {
    /* private mode */
  }
}

export function loadHistory(storage) {
  if (storage) return readStore(storage)
  const primary = webStore()
  // An explicitly empty history must not re-import an old session copy.
  try {
    if (primary?.getItem(KEY) !== null && primary?.getItem(KEY) !== undefined) return readStore(primary)
  } catch { /* blocked storage */ }
  try {
    const session = readStore(sessionStorage)
    if (session.length) {
      writeStore(webStore(), session)
      return session
    }
  } catch {
    /* ignore */
  }
  return []
}

// Stored words are in display form, so the tile alphabet includes Ñ (Spanish),
// Ç and the interpunct of the Catalan L·L tile. Length is bounded in characters,
// not tiles: the longest 15-tile word runs to 18 characters in Catalan
// (DODECASIL·LABIQUES) and 17 in Spanish (ACHICHARRONABAMOS).
const WORD_CHARS = /[^A-ZÑÇ·]/g
const MAX_WORD_CHARS = 20

function cleanRows(rows) {
  const map = new Map()
  for (const row of Array.isArray(rows) ? rows : []) {
    const word = String(row?.word || '')
      .toUpperCase()
      .replace(WORD_CHARS, '')
    if (word.length < 2 || word.length > MAX_WORD_CHARS) continue
    const time = Number(row.at)
    const at = Number.isFinite(time) ? Math.max(0, time) : 0
    const pts = Number(row.pts)
    const prev = map.get(word)
    if (!prev || at > prev.at) {
      map.set(word, {
        word,
        pts: Number.isFinite(pts) ? Math.max(0, Math.round(pts)) : 0,
        src: row.src === 'dico' ? 'dico' : 'defi',
        at,
      })
    }
  }
  return [...map.values()].sort((a, b) => b.at - a.at).slice(0, MAX)
}

export function mergeHistory(remote, storage) {
  const next = cleanRows([...(Array.isArray(remote) ? remote : []), ...loadHistory(storage)])
  writeStore(storage, next)
  return next
}

export function rememberWord(entry, storage) {
  const word = String(entry?.word || '')
    .toUpperCase()
    .replace(WORD_CHARS, '')
  if (word.length < 2 || word.length > MAX_WORD_CHARS) return readStore(storage)
  const pts = Number.isFinite(Number(entry.pts)) ? Math.max(0, Math.round(Number(entry.pts))) : 0
  const src = entry.src === 'dico' ? 'dico' : 'defi'
  const next = [
    { word, pts, src, at: Date.now() },
    ...loadHistory(storage).filter((row) => row.word !== word),
  ].slice(0, MAX)
  writeStore(storage, next)
  return next
}

export function historyLabel(src) {
  return src === 'dico' ? t('hist_dico') : t('hist_defi')
}

export function historyWhen(at) {
  const d = new Date(Number(at) || 0)
  if (!Number.isFinite(d.getTime()) || d.getTime() <= 0) return ''
  const loc = uiLocale()
  return d.toLocaleDateString(loc, { day: 'numeric', month: 'short' })
}

function dayStamp(at) {
  const d = new Date(Number(at) || 0)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export function historyDayLabel(at, now = Date.now()) {
  const d = new Date(Number(at) || 0)
  if (!Number.isFinite(d.getTime()) || d.getTime() <= 0) return ''
  const stamp = dayStamp(d)
  if (stamp === dayStamp(now)) return t('hist_today')
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (stamp === dayStamp(yesterday)) return t('hist_yesterday')
  const loc = uiLocale()
  return d.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' })
}

export function clearHistory(storage) {
  writeStore(storage, [])
  if (!storage) {
    try { sessionStorage.removeItem(KEY) } catch { /* blocked storage */ }
  }
  return []
}
