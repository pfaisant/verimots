import { t, getLang } from './i18n.js?v=131'

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
    return Array.isArray(rows) ? rows : []
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
  const local = readStore(webStore())
  if (local.length) return local
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

export function mergeHistory(remote, storage) {
  const incoming = Array.isArray(remote) ? remote : []
  const map = new Map()
  for (const row of [...incoming, ...readStore(storage)]) {
    const word = String(row?.word || '')
      .toUpperCase()
      .replace(/[^A-ZÑ]/g, '')
    if (word.length < 2) continue
    const prev = map.get(word)
    if (!prev || (row.at || 0) > (prev.at || 0)) {
      map.set(word, {
        word,
        pts: Math.max(0, Math.round(Number(row.pts) || 0)),
        src: row.src === 'dico' ? 'dico' : 'defi',
        at: Number(row.at) || Date.now(),
      })
    }
  }
  const next = [...map.values()].sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, MAX)
  writeStore(storage, next)
  return next
}

export function rememberWord(entry, storage) {
  const word = String(entry?.word || '')
    .toUpperCase()
    .replace(/[^A-ZÑ]/g, '')
  if (word.length < 2 || word.length > 15) return readStore(storage)
  const pts = Math.max(0, Math.round(Number(entry.pts) || 0))
  const src = entry.src === 'dico' ? 'dico' : 'defi'
  const next = [
    { word, pts, src, at: Date.now() },
    ...readStore(storage).filter((row) => row.word !== word),
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
  const loc = getLang() === 'en' ? 'en-GB' : getLang() === 'es' ? 'es-ES' : 'fr-FR'
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
  if (stamp === dayStamp(now - 86400000)) return t('hist_yesterday')
  const loc = getLang() === 'en' ? 'en-GB' : getLang() === 'es' ? 'es-ES' : 'fr-FR'
  return d.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' })
}

export function clearHistory(storage) {
  writeStore(storage, [])
  return []
}
