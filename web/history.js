const KEY = 'ods9-session-v1'
const MAX = 80

function readStore(storage) {
  try {
    const raw = (storage || globalThis.sessionStorage).getItem(KEY)
    const rows = raw ? JSON.parse(raw) : []
    return Array.isArray(rows) ? rows : []
  } catch {
    return []
  }
}

function writeStore(storage, rows) {
  try {
    ;(storage || globalThis.sessionStorage).setItem(KEY, JSON.stringify(rows))
  } catch {
    /* private mode */
  }
}

export function loadHistory(storage) {
  return readStore(storage)
}

export function mergeHistory(remote, storage) {
  const incoming = Array.isArray(remote) ? remote : []
  const map = new Map()
  for (const row of [...incoming, ...readStore(storage)]) {
    const word = String(row?.word || '')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
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
    .replace(/[^A-Z]/g, '')
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
  return src === 'dico' ? 'Dico' : 'Défi'
}
