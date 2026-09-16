import { t } from './i18n.js?v=158'

const KEY = 'verimots-favorites-v1'
const MAX = 200

function store(storage) {
  if (storage) return storage
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    /* blocked */
  }
  return null
}

// Stored words are in display form, so the tile alphabet includes Ñ (Spanish),
// Ç and the interpunct of the Catalan L·L tile. Length is bounded in characters,
// not tiles: the longest 15-tile word runs to 18 characters in Catalan
// (DODECASIL·LABIQUES) and 17 in Spanish (ACHICHARRONABAMOS).
const WORD_CHARS = /[^A-ZÑÇ·]/g
const MAX_WORD_CHARS = 20

function cleanWord(word) {
  return String(word || '')
    .toUpperCase()
    .replace(WORD_CHARS, '')
}

function points(value) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0
}

export function loadFavorites(storage) {
  try {
    const raw = store(storage)?.getItem(KEY)
    const rows = raw ? JSON.parse(raw) : []
    if (!Array.isArray(rows)) return []
    const seen = new Set()
    return rows
      .map((row) => {
        const word = cleanWord(row?.word)
        if (word.length < 2 || word.length > MAX_WORD_CHARS || seen.has(word)) return null
        seen.add(word)
        return {
          word,
          pts: points(row?.pts),
          at: Number.isFinite(Number(row?.at)) ? Math.max(0, Number(row.at)) : 0,
        }
      })
      .filter(Boolean)
      .slice(0, MAX)
  } catch {
    return []
  }
}

export function isFavorite(word, storage) {
  const key = cleanWord(word)
  if (!key) return false
  return loadFavorites(storage).some((row) => row.word === key)
}

export function toggleFavorite(word, pts, storage) {
  const key = cleanWord(word)
  if (key.length < 2 || key.length > MAX_WORD_CHARS) return loadFavorites(storage)
  const rows = loadFavorites(storage)
  const next = rows.some((row) => row.word === key)
    ? rows.filter((row) => row.word !== key)
    : [{ word: key, pts: points(pts), at: Date.now() }, ...rows].slice(0, MAX)
  try {
    store(storage)?.setItem(KEY, JSON.stringify(next))
  } catch {
    /* private mode */
  }
  return next
}

export function favButtonHtml(word, pts, escapeHtml, extraClass = '') {
  const key = cleanWord(word)
  if (!key) return ''
  const on = isFavorite(key)
  return `<button type="button" class="fav-btn${on ? ' is-on' : ''}${extraClass ? ` ${extraClass}` : ''}"
    data-fav-word="${escapeHtml(key)}" data-fav-pts="${Math.max(0, Math.round(Number(pts) || 0))}"
    aria-pressed="${on ? 'true' : 'false'}" aria-label="${escapeHtml(t(on ? 'fav_remove' : 'fav_add'))}">${on ? '★' : '☆'}</button>`
}

export function paintFavStar(btn, storage) {
  if (!btn) return
  const on = isFavorite(btn.dataset.favWord, storage)
  btn.textContent = on ? '★' : '☆'
  btn.classList.toggle('is-on', on)
  btn.setAttribute('aria-pressed', on ? 'true' : 'false')
  btn.setAttribute('aria-label', t(on ? 'fav_remove' : 'fav_add'))
}
