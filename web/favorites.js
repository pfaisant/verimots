import { t } from './i18n.js?v=123'

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

function cleanWord(word) {
  return String(word || '')
    .toUpperCase()
    .replace(/[^A-ZÑ]/g, '')
}

export function loadFavorites(storage) {
  try {
    const raw = store(storage)?.getItem(KEY)
    const rows = raw ? JSON.parse(raw) : []
    if (!Array.isArray(rows)) return []
    return rows
      .map((row) => {
        const word = cleanWord(row?.word)
        if (word.length < 2) return null
        return {
          word,
          pts: Math.max(0, Math.round(Number(row?.pts) || 0)),
          at: Number(row?.at) || 0,
        }
      })
      .filter(Boolean)
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
  if (key.length < 2) return loadFavorites(storage)
  const rows = loadFavorites(storage)
  const next = rows.some((row) => row.word === key)
    ? rows.filter((row) => row.word !== key)
    : [{ word: key, pts: Math.max(0, Math.round(Number(pts) || 0)), at: Date.now() }, ...rows].slice(0, MAX)
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
