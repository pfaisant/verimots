import { t, getLang, getDict, dictLabel } from './i18n.js?v=108'
import { favButtonHtml, paintFavStar } from './favorites.js?v=108'

const CAT_KEYS = new Set(['bingo', 'long', 'hard'])

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
const ES_VALUES = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1,
  J: 8, K: 10, L: 1, M: 3, N: 1, Ñ: 8, O: 1, P: 3, Q: 5,
  R: 1, S: 1, T: 1, U: 1, V: 4, W: 10, X: 8, Y: 4, Z: 10,
}

function catLabel(cat) {
  const key = CAT_KEYS.has(cat) ? `cat_${cat}` : 'cat_defi'
  return t(key)
}

export function tileValues(lang = getLang()) {
  return lang === 'en' ? EN_VALUES : lang === 'es' ? ES_VALUES : FR_VALUES
}

export function letterScore(word, lang = getLang(), jokers = []) {
  const values = tileValues(lang)
  const jk = jokers instanceof Set ? jokers : new Set(jokers)
  let n = 0
  const letters = String(word || '')
  for (let i = 0; i < letters.length; i++) {
    if (jk.has(i)) continue
    n += values[letters[i]] || 0
  }
  return n
}

export function playPoints(word, baseScore) {
  return (baseScore || 0) + (String(word || '').length === 7 ? 50 : 0)
}

export function playScore(word, lang = getLang(), jokers = []) {
  return playPoints(word, letterScore(word, lang, jokers))
}

export function playPercent(pts, bestPts) {
  return Math.min(100, Math.round((100 * Number(pts || 0)) / Math.max(1, Number(bestPts || 0))))
}

export function formatAverage(n) {
  if (n == null || !Number.isFinite(Number(n))) return t('avg_empty')
  const loc = getLang() === 'en' ? 'en-GB' : getLang() === 'es' ? 'es-ES' : 'fr-FR'
  const s = Number(n).toLocaleString(loc, { maximumFractionDigits: 1, minimumFractionDigits: 1 })
  return t('avg_score', s)
}

export function formatBoardPercent(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  const loc = getLang() === 'en' ? 'en-GB' : getLang() === 'es' ? 'es-ES' : 'fr-FR'
  return `${Number(n).toLocaleString(loc, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`
}

export function formatChartAverage(n) {
  if (n == null || !Number.isFinite(Number(n))) return ''
  const loc = getLang() === 'en' ? 'en-GB' : getLang() === 'es' ? 'es-ES' : 'fr-FR'
  return Number(n).toLocaleString(loc, { maximumFractionDigits: 1, minimumFractionDigits: 1 })
}

function boardPercentHtml(entry) {
  const avg = formatBoardPercent(entry?.percent)
  const n = Math.max(1, Number(entry?.plays) || 1)
  if (n <= 1) return avg
  return `${avg}<small> · ${t('board_plays', n)}</small>`
}

export function boardScoreHtml(entry) {
  return boardPercentHtml(entry)
}

const SCORE_KEY = 'ods9-defi-scores-v1'
const KIDS_SCORE_KEY = 'verimots-kids-scores-v1'
const TRAINING_STATS_KEY = 'verimots-training-stats-v1'
const MAX_SCORES = 24

function scoreStore(storage) {
  return storage || (typeof localStorage === 'undefined' ? null : localStorage)
}

function scoreKey(kids) {
  return kids ? KIDS_SCORE_KEY : SCORE_KEY
}

export function clampPercent(n) {
  const p = Math.round(Number(n))
  if (!Number.isFinite(p)) return null
  return Math.max(0, Math.min(100, p))
}

export function loadScores(storage, kids = false) {
  try {
    const raw = scoreStore(storage)?.getItem(scoreKey(kids))
    const rows = raw ? JSON.parse(raw) : []
    if (!Array.isArray(rows)) return []
    return rows
      .map((row) => {
        const p = clampPercent(row?.p ?? row)
        return p == null ? null : { p, at: Number(row?.at) || 0 }
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

export function rememberScore(percent, storage, kids = false) {
  const p = clampPercent(percent)
  const store = scoreStore(storage)
  const prev = loadScores(store, kids)
  if (p == null) return prev
  const next = [...prev, { p, at: Date.now() }].slice(-MAX_SCORES)
  try {
    store?.setItem(scoreKey(kids), JSON.stringify(next))
  } catch {
    /* private mode */
  }
  return next
}

export function scoreValues(scores) {
  return (scores || [])
    .map((row) => clampPercent(typeof row === 'number' ? row : row?.p))
    .filter((n) => n != null)
}

export function averageScore(scores) {
  const pts = scoreValues(scores)
  if (!pts.length) return null
  return Math.round((10 * pts.reduce((sum, n) => sum + n, 0)) / pts.length) / 10
}

export function trainingNeededWords(catalog) {
  return new Set((catalog || []).map((entry) => entry.word).filter(Boolean))
}

export function trainingNeededFound(found, needed) {
  let n = 0
  for (const word of needed || []) if (found?.has(word)) n++
  return n
}

export function trainingRoundSolved(found, needed) {
  if (!needed?.size) return false
  for (const word of needed) if (!found?.has(word)) return false
  return true
}

export function loadTrainingStats(storage, lang = getLang()) {
  const empty = { plays: 0, solved: 0, found: 0, total: 0, byPreset: {}, byLength: {}, hard: 0 }
  try {
    const raw = scoreStore(storage)?.getItem(TRAINING_STATS_KEY)
    const all = raw ? JSON.parse(raw) : {}
    const row = all?.[lang]
    return row && typeof row === 'object' ? { ...empty, ...row } : empty
  } catch {
    return empty
  }
}

export function rememberTrainingRound(round, storage, lang = getLang()) {
  const store = scoreStore(storage)
  const previous = loadTrainingStats(store, lang)
  const preset = String(round?.preset || 'all')
  const length = String(Math.max(0, Number(round?.length) || 0))
  const next = {
    ...previous,
    plays: previous.plays + 1,
    solved: previous.solved + (round?.solved ? 1 : 0),
    found: previous.found + Math.max(0, Number(round?.found) || 0),
    total: previous.total + Math.max(0, Number(round?.total) || 0),
    hard: previous.hard + Math.max(0, Number(round?.hard) || 0),
    byPreset: {
      ...previous.byPreset,
      [preset]: (Number(previous.byPreset?.[preset]) || 0) + 1,
    },
    byLength: {
      ...previous.byLength,
      [length]: (Number(previous.byLength?.[length]) || 0) + (round?.solved ? 1 : 0),
    },
  }
  try {
    const raw = store?.getItem(TRAINING_STATS_KEY)
    const all = raw ? JSON.parse(raw) : {}
    store?.setItem(TRAINING_STATS_KEY, JSON.stringify({ ...all, [lang]: next }))
  } catch {
    /* private mode */
  }
  return next
}

export function scoreChartSvg(scores, opts = {}) {
  // One rounded bar per game — bars survive the horizontal stretch of
  // preserveAspectRatio="none" where a line chart's dots deformed.
  const w = opts.w || 360
  const h = opts.h || 44
  const padT = 4
  const padB = 3
  const pts = scoreValues(scores).slice(-24)
  const innerH = Math.max(1, h - padT - padB)
  const yAt = (p) => padT + (1 - p / 100) * innerH
  const base = yAt(0)
  const frame = `<line class="axis" x1="0" y1="${yAt(100).toFixed(1)}" x2="${w}" y2="${yAt(100).toFixed(1)}"/>
    <line class="axis" x1="0" y1="${base.toFixed(1)}" x2="${w}" y2="${base.toFixed(1)}"/>`
  if (!pts.length) {
    return `<svg class="score-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${frame}</svg>`
  }
  const n = pts.length
  const gap = n > 16 ? 2 : 3
  // Cap the per-game slot so 1–3 games render as slim bars hugging the right
  // edge (where the newest game lives) instead of giant full-width blocks.
  const step = Math.min(26, w / n)
  const x0 = w - n * step
  const bw = Math.max(1.5, step - gap)
  const bars = pts
    .map((p, i) => {
      const x = x0 + i * step + gap / 2
      const y = yAt(p)
      const bh = Math.max(1.6, base - y)
      return `<rect class="bar${i === n - 1 ? ' last' : ''}" x="${x.toFixed(1)}" y="${(base - bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="1.4"/>`
    })
    .join('')
  const avg = pts.reduce((a, b) => a + b, 0) / n
  const avgLine = n > 1
    ? `<line class="avg" x1="0" y1="${yAt(avg).toFixed(1)}" x2="${w}" y2="${yAt(avg).toFixed(1)}"/>`
    : ''
  return `<svg class="score-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${frame}${bars}${avgLine}</svg>`
}

export function parseRack(raw) {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-ZÑ]/g, '')
    .slice(0, 7)
}

export function defiShareText(rack, percent) {
  const tiles = [...rack].join(' ')
  const score = percent != null ? `\n${t('share_game_score', percent)}` : '\n'
  return `${t('share_game_title')}\n\n${t('share_game_body')}\n${tiles}\n${score}`
}

export const STUDY_TWOS = 10
export const STUDY_THREES = 12

export function utcDayIndex(date = new Date()) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000)
}

export function dailyStudySlice(list, date = new Date(), size = 10) {
  const words = Array.isArray(list) ? list : []
  if (!words.length || size <= 0) return []
  const take = Math.min(size, words.length)
  const start = ((utcDayIndex(date) % words.length) + words.length) % words.length
  const out = new Array(take)
  for (let i = 0; i < take; i++) out[i] = words[(start + i) % words.length]
  return out
}

export function lexiconFileName(id = getDict()) {
  if (id === 'csw' || id === 'yawl') return 'verimots-en-csw.txt'
  if (id === 'wow24') return 'verimots-en-wow24.txt'
  if (id === 'rla') return 'verimots-es-rla.txt'
  return 'verimots-fr-ods.txt'
}

export function studyDateLabel(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${d}/${m}/${y}`
}

export function studyListText(words, len) {
  const list = Array.isArray(words) ? words : []
  return `${t('share_study_list', len, list.length)}\n\n${list.join(' · ')}\n`
}

export function dailyStudyText(twos, threes, date = new Date()) {
  return `${t('share_study_daily', studyDateLabel(date))}\n\n${t('share_study_twos')}\n${(twos || []).join(' · ')}\n\n${t('share_study_threes')}\n${(threes || []).join(' · ')}\n`
}

export function studyWordText(word, score, def, link) {
  const defLine = def ? `\n${def}\n` : '\n'
  return `Verimots · ${dictLabel()}\n\n*${t('share_valid', word, dictLabel())}*\n${t('letters_pts', word.length, score)}${defLine}\n${link}`
}

export function isInflectionDef(text) {
  return /personne du|impératif de|participe |pluriel de|féminin de|masculin de|singulier de|forme de |forma (?:verbal|flexiva|del)|plural de|femenino de|masculino de|participio de|conjugación de/i.test(
    String(text || '')
  )
}

const DEF_STOP = new Set([
  'ainsi', 'alors', 'apres', 'aussi', 'autre', 'autres', 'avant', 'avec', 'avoir',
  'chez', 'comme', 'contre', 'dans', 'depuis', 'des', 'donc', 'dont', 'entre',
  'est', 'etre', 'fait', 'faire', 'les', 'lors', 'mais', 'meme', 'moins', 'ont',
  'parmi', 'pas', 'pendant', 'plus', 'pour', 'quand', 'que', 'qui', 'sans',
  'selon', 'sont', 'sous', 'sur', 'tout', 'toute', 'toutes', 'tous', 'tres',
  'une', 'vers',
])

export function extractFormOf(text) {
  const s = String(text || '')
  const patterns = [
    /du verbe\s+([A-Za-zÀ-ÿŒœ][A-Za-zÀ-ÿŒœ'-]{1,20})/i,
    /(?:indicatif|subjonctif|conditionnel)(?: présent| passé| imparfait)? de\s+([A-Za-zÀ-ÿŒœ][A-Za-zÀ-ÿŒœ'-]{1,20})/i,
    /impératif de\s+([A-Za-zÀ-ÿŒœ][A-Za-zÀ-ÿŒœ'-]{1,20})/i,
    /pluriel de(?: l['’](?:adjectif|nom|article))?\s+([A-Za-zÀ-ÿŒœ][A-Za-zÀ-ÿŒœ'-]{1,20})/i,
    /féminin de(?: l['’]adjectif)?\s+([A-Za-zÀ-ÿŒœ][A-Za-zÀ-ÿŒœ'-]{1,20})/i,
    /masculin de\s+([A-Za-zÀ-ÿŒœ][A-Za-zÀ-ÿŒœ'-]{1,20})/i,
    /singulier de\s+([A-Za-zÀ-ÿŒœ][A-Za-zÀ-ÿŒœ'-]{1,20})/i,
    /participe (?:passé|présent)(?:[^.]{0,40}?)(?:du verbe|de)\s+([A-Za-zÀ-ÿŒœ][A-Za-zÀ-ÿŒœ'-]{1,20})/i,
    /variante(?: orthographique)? de\s+([A-Za-zÀ-ÿŒœ][A-Za-zÀ-ÿŒœ'-]{1,20})/i,
    /forme(?:s| conjuguée)? de\s+([A-Za-zÀ-ÿŒœ][A-Za-zÀ-ÿŒœ'-]{1,20})/i,
    /inflection of\s+([A-Za-zÀ-ÿŒœ][A-Za-zÀ-ÿŒœ'-]{1,20})/i,
    /alternative form of\s+([A-Za-zÀ-ÿŒœ][A-Za-zÀ-ÿŒœ'-]{1,20})/i,
    /plural of\s+([A-Za-zÀ-ÿŒœ][A-Za-zÀ-ÿŒœ'-]{1,20})/i,
    /(?:simple )?past(?: tense)? of\s+([A-Za-zÀ-ÿŒœ][A-Za-zÀ-ÿŒœ'-]{1,20})/i,
    /present participle of\s+([A-Za-zÀ-ÿŒœ][A-Za-zÀ-ÿŒœ'-]{1,20})/i,
    /(?:third-person singular|3rd-person singular)(?: present)? of\s+([A-Za-zÀ-ÿŒœ][A-Za-zÀ-ÿŒœ'-]{1,20})/i,
    /(?:comparative|superlative)(?: form)? of\s+([A-Za-zÀ-ÿŒœ][A-Za-zÀ-ÿŒœ'-]{1,20})/i,
    /forma (?:verbal|flexiva)(?: de| del verbo)?\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ'-]{1,24})/i,
    /(?:plural|femenino|masculino|participio) de\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ'-]{1,24})/i,
    /conjugación de\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ'-]{1,24})/i,
  ]
  for (const re of patterns) {
    const m = s.match(re)
    if (m?.[1]) return m[1].replace(/[.,;:]+$/, '')
  }
  return ''
}

function foldWord(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
}

export function isProperNounPos(pos) {
  return /nom propre|proper noun|nombre propio/i.test(String(pos || ''))
}

export function lexicalDefinition(payload) {
  if (!payload || payload.found === false) return payload
  const senses = (payload.senses || []).filter((sense) =>
    Array.isArray(sense?.defs)
    && sense.defs.some((definition) => /\p{L}/u.test(String(definition || '')))
    && !isProperNounPos(sense.pos)
  )
  if (!senses.length) {
    return { ...payload, found: false, senses: [] }
  }
  return senses.length === (payload.senses || []).length ? payload : { ...payload, senses }
}

export function wikiUrl(word, lemma) {
  const title = lemma || String(word || '').toLowerCase()
  const host = getLang() === 'en'
    ? 'en.wiktionary.org'
    : getLang() === 'es'
      ? 'es.wiktionary.org'
      : 'fr.wiktionary.org'
  return `https://${host}/wiki/${encodeURIComponent(title)}`
}

export function topWords(catalog, played, n = 5) {
  const list = []
  const seen = new Set()
  for (const entry of catalog || []) {
    if (!entry?.word || seen.has(entry.word)) continue
    seen.add(entry.word)
    list.push(entry)
    if (list.length >= n) break
  }
  if (played?.word && !seen.has(played.word)) list.push(played)
  return list
}

export function linkifyDef(text, escapeHtml) {
  const raw = String(text || '')
  const root = extractFormOf(raw)
  if (root) {
    const safe = escapeHtml(raw)
    const re = new RegExp(`(${root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'i')
    return safe.replace(
      re,
      `<button type="button" class="form-of" data-form-of="${escapeHtml(root)}">$1</button>`
    )
  }
  return raw.replace(/([A-Za-zÀ-ÿŒœ][A-Za-zÀ-ÿŒœ''’-]*)|([^A-Za-zÀ-ÿŒœ]+)/g, (all, word, sep) => {
    if (sep != null) return escapeHtml(sep)
    const folded = foldWord(word)
    if (folded.length < 4 || DEF_STOP.has(folded)) return escapeHtml(word)
    return `<button type="button" class="form-of" data-form-of="${escapeHtml(word)}">${escapeHtml(word)}</button>`
  })
}

function tileAssignments(tiles, word) {
  const assigned = new Map()
  const unmatched = []
  for (let wordIndex = 0; wordIndex < word.length; wordIndex++) {
    const ch = word[wordIndex]
    const rackIndex = [...tiles].findIndex((tile, index) =>
      tile === ch && !assigned.has(index)
    )
    if (rackIndex >= 0) assigned.set(rackIndex, wordIndex)
    else unmatched.push(wordIndex)
  }
  for (const wordIndex of unmatched) {
    const rackIndex = [...tiles].findIndex((tile, index) =>
      tile === '?' && !assigned.has(index)
    )
    if (rackIndex < 0) break
    assigned.set(rackIndex, wordIndex)
  }
  return assigned
}

export function usedTiles(tiles, word) {
  return new Set(tileAssignments(tiles, word).keys())
}

/** Display order for the rack. Official `tiles` string stays in deal order. */
export function rackDisplayOrder(tiles, alpha) {
  const rack = String(tiles || '')
  const idxs = [...rack].map((_, i) => i)
  if (!alpha) return idxs
  const lang = getLang()
  return idxs.sort((a, b) => {
    const blank = (ch) => ch === '?' || ch === '.' || ch === '*'
    const ca = rack[a]
    const cb = rack[b]
    if (blank(ca) !== blank(cb)) return blank(ca) ? 1 : -1
    return ca.localeCompare(cb, lang) || a - b
  })
}

function guessCategory(list, tiles) {
  const top = list[0]
  if (!top) return 'bingo'
  if (top.word.length === 7) return 'bingo'
  if (tiles.length <= 5) return 'hard'
  if (top.word.length >= 6) return 'long'
  return 'hard'
}

export function backBtn(word, escapeHtml) {
  if (!word) return ''
  return `<button type="button" class="def-back" data-def-back="${escapeHtml(word)}">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15.4 6.4 10.8 11l4.6 4.6L14 17l-6-6 6-6z"/></svg>
    ${escapeHtml(word)}
  </button>`
}

function srcLine(payload, escapeHtml) {
  if (!payload) return ''
  const title = payload.lemma || payload.word
  if (!title) return ''
  const href = payload.url || wikiUrl(payload.word, payload.lemma)
  const label = payload.found ? t('wiki_open') : t('wiki_search')
  return `<p class="defs-src"><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${label}</a></p>`
}

export function defBody(payload, escapeHtml, extra = {}) {
  payload = lexicalDefinition(payload)
  if (!payload) return `<p class="pending">${t('def_pending')}</p>`
  if (!payload.found || !payload.senses?.length) {
    return `<p class="empty">${
      payload.offline ? t('def_need_net') : t('def_missing')
    }</p>${srcLine(payload, escapeHtml)}`
  }
  const blob = payload.senses.flatMap((s) => s.defs).join(' ')
  const formOf = extra.formOf || extractFormOf(blob)
  const inflection = payload.senses.every((s) => s.defs.every(isInflectionDef))
  if (inflection && formOf && extra.root) {
    const note = `<p class="form-of-line">${t('form_of')} <button type="button" class="form-of" data-form-of="${escapeHtml(formOf)}">${escapeHtml(formOf)}</button></p>`
    if (extra.root.found) return note + defBody(extra.root, escapeHtml, { asRoot: true })
    return `${note}<p class="empty">${t('def_missing_of', formOf)}</p>${srcLine(payload, escapeHtml)}`
  }
  if (inflection && formOf && !extra.asRoot) {
    return `<p class="form-of-line">${t('form_of')} <button type="button" class="form-of" data-form-of="${escapeHtml(formOf)}">${escapeHtml(formOf)}</button></p>
      <p class="pending">${t('sense_of', formOf)}</p>`
  }
  const sense = payload.senses[0]
  // CHEF: "nom commun 1" (dated) hid "nom commun 2" (the common sense) —
  // when a word has several lexical senses, show each one's first gloss.
  const multi = payload.senses.slice(0, 4).map((s) => (s.defs || [])[0]).filter(Boolean)
  const defs = multi.length > 1 ? multi : (sense.defs || []).slice(0, extra.asRoot ? 2 : 1)
  // The header always names the defined word — vital when the user navigated
  // to a root via a "forme de" link and the panel no longer shows their play.
  const headWord = String(extra.word || payload.word || '').toUpperCase()
  const posBits = [headWord && escapeHtml(headWord), sense.pos && escapeHtml(sense.pos)].filter(Boolean)
  return `${posBits.length ? `<div class="pos">${posBits.join(' · ')}</div>` : ''}
    <ol>${defs.map((d) => `<li>${linkifyDef(d, escapeHtml)}</li>`).join('')}</ol>
    ${srcLine(payload, escapeHtml)}`
}

const KIDS_FOUND_KEY = 'verimots-kids-found-v1'

export function loadKidsFound(storage) {
  try {
    const n = Number((storage || localStorage)?.getItem(KIDS_FOUND_KEY))
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  } catch {
    return 0
  }
}

export function rememberKidsFound(storage) {
  const n = loadKidsFound(storage) + 1
  try {
    ;(storage || localStorage)?.setItem(KIDS_FOUND_KEY, String(n))
  } catch {
    /* private mode */
  }
  return n
}

export function initGame({ ask, tilesHtml, escapeHtml, normalize, ready, define, isCompetitive, isKids, isTraining, onDeal, onPlayed }) {
  // One source of truth for the header title: the game the user picked,
  // nothing else. Deal categories ("hard letters", "long word"…) never leak
  // in — they read as the app hopping between games on every deal.
  function kickerText(cat) {
    if (cat === 'kids') return t('kids_cat')
    if (cat === 'training') return t('cat_training')
    const comp = typeof isCompetitive === 'function' && isCompetitive()
    return comp ? t('menu_comp') : t('menu_find')
  }
  const rackEl = document.getElementById('game-rack')
  const catEl = document.getElementById('game-cat')
  const form = document.getElementById('game-form')
  const input = document.getElementById('game-q')
  const liveEl = document.getElementById('game-live')
  const resultEl = document.getElementById('game-result')
  const globalEl = document.getElementById('game-global')
  const waEl = document.getElementById('game-wa')
  const chartEl = document.getElementById('game-chart')
  const nextBtn = document.getElementById('game-next')
  let nextAction = null
  nextBtn?.addEventListener('click', () => nextAction?.())
  const authEl = document.getElementById('game-auth')
  const userEl = document.getElementById('game-user')
  const boardEl = document.getElementById('game-board')
  const modeDefi = document.getElementById('mode-defi')
  const modeTraining = document.getElementById('mode-training')
  const modeKids = document.getElementById('mode-kids')
  const modeComp = document.getElementById('mode-comp')
  const hintBtn = document.getElementById('game-hint')
  const trainingEl = document.getElementById('training-tools')
  const trainingProgressEl = document.getElementById('training-progress')
  const trainingTimerEl = document.getElementById('training-timer')
  const trainingRevealBtn = document.getElementById('training-reveal')
  const alphaBtn = document.getElementById('game-alpha')
  const skipBtn = document.getElementById('game-skip')

  let rack = ''
  let rackAlpha = false
  let catalog = []
  let best = null
  let category = 'bingo'
  let closed = false
  let officialPlay = false
  let dealSeed = ''
  let hintLevel = 0
  let activeMode = ''
  let modeSeq = 0
  let dealSeq = 0
  let trainingPreset = 'all'
  let trainingFound = new Set()
  let trainingNeeded = new Set()
  let trainingTotal = 0
  let trainingTargetLength = 0
  let trainingRoundRecorded = false
  let trainingTimer = 0
  let trainingEndsAt = 0
  let trainingBonusIndex = -1
  let dealPending = false
  let trainingRoundReady = false
  let probeSeq = 0
  const submitPromises = new Map()

  let trainingMinLen = 5
  try {
    const saved = localStorage.getItem('verimots-training-preset')
    if (['all', 'seven', 'eight', 'plusOne', 'joker', 'hard'].includes(saved)) trainingPreset = saved
    const savedMin = Number(localStorage.getItem('verimots-training-min'))
    if (Number.isInteger(savedMin) && savedMin >= 2 && savedMin <= 7) trainingMinLen = savedMin
  } catch {
    /* private mode */
  }
  const trainingPresetSelect = document.getElementById('training-preset-select')
  const trainingMinBtn = document.getElementById('training-min')
  try {
    rackAlpha = localStorage.getItem('verimots-rack-alpha') === '1'
  } catch {
    /* private mode */
  }

  function kidsOn() {
    return typeof isKids === 'function' ? isKids() : !!isKids
  }

  function trainingOn() {
    if (activeMode) return activeMode === 'training'
    return typeof isTraining === 'function' ? isTraining() : !!isTraining
  }

  function stopTrainingTimer() {
    if (trainingTimer) clearInterval(trainingTimer)
    trainingTimer = 0
    trainingEndsAt = 0
  }

  function paintTrainingProgress(extra = '') {
    if (!trainingProgressEl) return
    const base = t('training_progress', trainingNeededFound(trainingFound, trainingNeeded), trainingTotal)
    const seconds = trainingEndsAt ? Math.max(0, Math.ceil((trainingEndsAt - Date.now()) / 1000)) : null
    trainingProgressEl.textContent = [base, seconds == null ? '' : `${seconds}s`, extra].filter(Boolean).join(' · ')
  }

  function startTrainingTimer() {
    stopTrainingTimer()
    const seconds = Math.max(0, Number(trainingTimerEl?.value) || 0)
    if (!seconds || !trainingOn() || !rack || closed || dealPending || !trainingRoundReady) {
      paintTrainingProgress()
      return
    }
    trainingEndsAt = Date.now() + seconds * 1000
    trainingTimer = window.setInterval(() => {
      paintTrainingProgress()
      if (trainingEndsAt && Date.now() >= trainingEndsAt) finishTraining(false)
    }, 250)
    paintTrainingProgress()
  }

  function paintTrainingStats(stats = loadTrainingStats()) {
    if (!globalEl || !trainingOn()) return
    globalEl.hidden = false
    globalEl.textContent = t('training_stats', stats.solved, stats.plays)
  }

  function setClosed(on) {
    closed = on
    document.body.classList.toggle('game-closed', on)
    paintTrainingControls()
    paintRackTools()
  }

  function challengeUrl() {
    const u = new URL(location.origin + location.pathname)
    u.searchParams.set('vue', 'jeu')
    if (rack) u.searchParams.set('d', rack)
    if (category) u.searchParams.set('c', category)
    return u.toString()
  }

  function waHref(percent) {
    const text = `${defiShareText(rack, percent)}${challengeUrl()}`
    return `https://wa.me/?text=${encodeURIComponent(text)}`
  }

  function wordStudyUrl(word) {
    const u = new URL(location.origin + location.pathname)
    u.searchParams.set('w', word)
    return u.toString()
  }

  function paintShare(percent) {
    if (!waEl) return
    if (!rack) {
      waEl.classList.add('is-off')
      waEl.removeAttribute('href')
      return
    }
    waEl.classList.remove('is-off')
    waEl.href = waHref(percent)
    waEl.setAttribute('aria-label', t('share_wa'))
  }

  function paintStudyShare(word, pts, def = '') {
    if (!waEl || !word) return
    waEl.classList.remove('is-off')
    waEl.href = `https://wa.me/?text=${encodeURIComponent(studyWordText(word, pts, def, wordStudyUrl(word)))}`
    waEl.setAttribute('aria-label', t('share_study_word'))
  }

  function paintChart(rows, kids) {
    if (!chartEl) return
    const dock = document.getElementById('game-dock')
    const scores = rows || loadScores(null, kids == null ? kidsOn() : !!kids)
    const last = scores.at(-1)
    const avg = averageScore(scores)
    const spark = scores.length >= 2
    const show = spark || !!last
    chartEl.hidden = !show
    if (dock) dock.hidden = !show
    document.body.classList.toggle('has-chart', show)
    if (!show) {
      chartEl.innerHTML = ''
      chartEl.setAttribute('aria-label', t('chart_empty'))
      return
    }
    const avgHtml = spark && avg != null
      ? `<span class="game-chart-avg">${formatChartAverage(avg)}<small>${t('chart_avg')}</small></span>`
      : ''
    chartEl.innerHTML = `${avgHtml}${spark ? scoreChartSvg(scores) : ''}${
      last ? `<span class="game-chart-last">${last.p}<small>/100</small></span>` : ''
    }`
    chartEl.setAttribute(
      'aria-label',
      last ? t('chart_last', last.p, formatChartAverage(avg)) : t('chart_empty')
    )
  }

  function paintKidsMeta() {
    if (globalEl) globalEl.textContent = t('kids_found', loadKidsFound())
    if (waEl) waEl.classList.add('is-off')
    paintChart(loadScores(null, true))
  }

  async function paintGlobal() {
    if (trainingOn()) {
      paintTrainingStats()
      if (waEl) waEl.classList.add('is-off')
      if (chartEl) chartEl.hidden = true
      const dock = document.getElementById('game-dock')
      if (dock) dock.hidden = true
      document.body.classList.remove('has-chart')
      return
    }
    if (globalEl) {
      globalEl.hidden = true
      globalEl.textContent = ''
    }
    if (kidsOn()) {
      paintKidsMeta()
      return
    }
    if (waEl) waEl.classList.remove('is-off')
    paintChart()
  }

  function catalogFrom(groups) {
    const lang = getLang()
    const list = []
    for (const g of groups || []) {
      for (const entry of g.words) {
        const jokers = entry.jokers || []
        list.push({ word: entry.word, pts: playScore(entry.word, lang, jokers), jokers })
      }
    }
    list.sort((a, b) => b.pts - a.pts || b.word.length - a.word.length)
    return list
  }

  function alphaBtnEnabled() {
    try {
      return localStorage.getItem('verimots-alpha-btn') === '1'
    } catch {
      return false
    }
  }

  function paintRackTools() {
    if (alphaBtn) {
      alphaBtn.hidden = !alphaBtnEnabled()
      alphaBtn.setAttribute('aria-pressed', rackAlpha ? 'true' : 'false')
      alphaBtn.setAttribute('aria-label', t('rack_alpha_aria'))
      alphaBtn.textContent = t('rack_alpha')
    }
    if (skipBtn) {
      skipBtn.textContent = t('play_skip')
      skipBtn.hidden = closed || dealPending || trainingOn() || !rack
    }
  }

  let rackSig = ''
  let rackDealSig = ''

  function paintRack() {
    const used = usedTiles(rack, normalize(input.value))
    const order = rackDisplayOrder(rack, rackAlpha)
    const tap = !closed && !dealPending
    const sig = JSON.stringify([rack, order, tap])
    rackEl.dataset.n = String(rack.length)
    // Only rebuild the tiles when the rack itself changes: typing just retags
    // them, so the used/unused states can animate instead of being replaced.
    if (sig !== rackSig || !rackEl.firstElementChild) {
      const dealSig = JSON.stringify(rack)
      rackEl.innerHTML = tilesHtml(rack, [], { tap, order })
      rackEl.classList.toggle('dealt', dealSig !== rackDealSig)
      rackDealSig = dealSig
      rackSig = sig
    }
    rackEl.querySelectorAll('.tile').forEach((el) => {
      const i = Number(el.dataset.rackI)
      el.classList.toggle('used', used.has(i))
      const bonus = i === trainingBonusIndex
      el.classList.toggle('training-extra', bonus)
      if (bonus) el.title = '+1'
      else el.removeAttribute('title')
    })
    paintRackTools()
  }

  function setLive(text, kind) {
    liveEl.textContent = text || ''
    liveEl.className = kind ? `game-live ${kind}` : 'game-live'
  }

  function applyDeal(tiles, cat, groups, seed = '', trainingMeta = null) {
    stopTrainingTimer()
    dealPending = false
    rack = tiles
    catalog = catalogFrom(groups)
    // The free "all" combinations mode drowns in 2-letter words — the
    // min-length chip narrows the round to words worth hunting.
    if ((cat === 'training' || trainingOn()) && trainingPreset === 'all' && trainingMinLen > 2) {
      const narrowed = catalog.filter((entry) => entry.word.length >= trainingMinLen)
      if (narrowed.length) catalog = narrowed
    }
    best = catalog[0] || null
    dealSeed = String(seed || '').toUpperCase()
    hintLevel = 0
    category = cat === 'kids' || kidsOn()
      ? 'kids'
      : cat === 'training' || trainingOn()
        ? 'training'
        : CAT_KEYS.has(cat)
          ? cat
          : guessCategory(catalog, tiles)
    trainingBonusIndex = category === 'training' && Number.isInteger(trainingMeta?.bonusIndex)
      ? trainingMeta.bonusIndex
      : -1
    catEl.textContent = kickerText(category)
    input.maxLength = rack.length || 7
    form.hidden = false
    if (hintBtn) {
      hintBtn.hidden = category !== 'kids' || closed
      hintBtn.disabled = false
      hintBtn.textContent = t('kids_hint')
    }
    paintRack()
    if (category === 'training') {
      trainingRoundReady = true
      trainingFound = new Set()
      trainingNeeded = trainingNeededWords(catalog)
      trainingTotal = trainingNeeded.size
      trainingTargetLength = Number(trainingMeta?.targetLength) || rack.length
      trainingRoundRecorded = false
      paintTrainingProgress()
      startTrainingTimer()
      if (waEl) waEl.classList.add('is-off')
    } else if (category === 'kids') {
      trainingRoundReady = false
      if (waEl) waEl.classList.add('is-off')
    } else {
      trainingRoundReady = false
      paintShare()
    }
    paintTrainingControls()
    onDeal?.(rack, category)
  }

  async function deal(forced, forcedCat, opts = {}) {
    const requestId = ++dealSeq
    const requestMode = activeMode
    const requestLang = getLang()
    const requestDict = getDict()
    stopTrainingTimer()
    dealPending = true
    trainingRoundReady = false
    setClosed(false)
    nextAction = null
    if (nextBtn) nextBtn.hidden = true
    officialPlay = !!opts.official || (
      !trainingOn() && (kidsOn() || (typeof isCompetitive === 'function' && isCompetitive()))
    )
    if (opts.seed) dealSeed = String(opts.seed).toUpperCase()
    form.hidden = false
    resultEl.hidden = true
    resultEl.innerHTML = ''
    resultEl.className = 'game-result'
    input.disabled = true
    input.value = ''
    setLive('')
    if (!ready()) {
      dealPending = false
      paintTrainingControls()
      setLive(t('loading_lex'))
      return
    }
    paintTrainingControls()
    setLive(t('loading_deal'))
    const wanted = parseRack(forced)
    let tiles = ''
    let cat = ''
    let groups = []
    let seed = ''
    let trainingMeta = null
    try {
      if (trainingOn()) {
        const res = await ask('training', {
          preset: trainingPreset,
          excludeSeed: dealSeed,
          excludeRack: rack,
        })
        if (requestId !== dealSeq || requestMode !== activeMode || requestLang !== getLang() || requestDict !== getDict()) return
        if ((res.lang && res.lang !== requestLang) || (res.dict && res.dict !== requestDict)) throw new Error('stale')
        if (!res?.rack) throw new Error('empty')
        tiles = res.rack
        cat = 'training'
        seed = res.seed || ''
        groups = res.groups || []
        trainingMeta = res
      } else if (kidsOn()) {
        const res = wanted.length >= 2
          ? await ask('kids', { rack: wanted, seed: opts.seed || dealSeed || '' })
          : await ask('kids', { excludeSeed: dealSeed })
        if (requestId !== dealSeq || requestMode !== activeMode || requestLang !== getLang() || requestDict !== getDict()) return
        if ((res.lang && res.lang !== requestLang) || (res.dict && res.dict !== requestDict)) throw new Error('stale')
        if (wanted.length >= 2) {
          tiles = wanted
          cat = 'kids'
          seed = opts.seed || dealSeed || ''
        } else {
          if (!res?.rack) throw new Error('empty')
          tiles = res.rack
          cat = 'kids'
          seed = res.seed || ''
        }
        groups = res.groups || []
      } else if (wanted.length >= 2) {
        const res = await ask('anagram', { rack: wanted, min: 2, max: wanted.length })
        if (requestId !== dealSeq || requestMode !== activeMode || requestLang !== getLang() || requestDict !== getDict()) return
        if ((res.lang && res.lang !== requestLang) || (res.dict && res.dict !== requestDict)) throw new Error('stale')
        tiles = wanted
        cat = forcedCat || ''
        groups = res.groups || []
      } else {
        const res = await ask('challenge', { excludeSeed: dealSeed, excludeRack: rack })
        if (requestId !== dealSeq || requestMode !== activeMode || requestLang !== getLang() || requestDict !== getDict()) return
        if ((res.lang && res.lang !== requestLang) || (res.dict && res.dict !== requestDict)) throw new Error('stale')
        if (!res?.rack) throw new Error('empty')
        tiles = res.rack
        cat = res.category || ''
        seed = res.seed || ''
        groups = res.groups || []
      }
    } catch {
      if (requestId === dealSeq && requestMode === activeMode && requestLang === getLang() && requestDict === getDict()) {
        dealPending = false
        paintTrainingControls()
        setLive(t('deal_fail'))
      }
      return
    }
    if (requestId !== dealSeq || requestMode !== activeMode || requestLang !== getLang() || requestDict !== getDict()) return
    applyDeal(tiles, cat, groups, seed, trainingMeta)
    setLive('')
    input.disabled = false
    input.focus()
  }

  function preview() {
    if (closed) return
    paintRack()
    const word = normalize(input.value)
    if (!word) {
      setLive('')
      return
    }
    const hit = catalog.find((w) => w.word === word)
    if (hit) {
      setLive(`${hit.pts} pts`, 'ok')
      return
    }
    if (word.length < 2) {
      setLive('')
      return
    }
    const seq = ++probeSeq
    ask('probe', { word, rack })
      .then((probe) => {
        if (!probe || seq !== probeSeq || normalize(input.value) !== word) return
        // While typing, only celebrate valid words — the negative verdicts
        // stay for the actual submit (validate) so the table isn't nagging.
        if (probe.formable && probe.valid) setLive(`${probe.score} pts`, 'ok')
        else setLive('')
      })
      .catch(() => {})
  }

  function giveHint() {
    if (closed || !kidsOn() || !hintBtn) return
    const target = catalog.find((w) => w.word === dealSeed) || best || catalog[0]
    if (!target) return
    hintLevel = Math.min(2, hintLevel + 1)
    if (hintLevel === 1) setLive(t('kids_hint_letter', target.word[0]), 'ok')
    else {
      setLive(t('kids_hint_word', target.word), 'ok')
      hintBtn.disabled = true
    }
  }

  function recordTraining(solved) {
    if (trainingRoundRecorded) return loadTrainingStats()
    trainingRoundRecorded = true
    const hard = [...trainingFound].filter((word) => /[JKÑQWXYZ]/.test(word)).length
    return rememberTrainingRound({
      preset: trainingPreset,
      length: trainingTargetLength,
      solved,
      found: trainingNeededFound(trainingFound, trainingNeeded),
      total: trainingTotal,
      hard,
    })
  }

  function finishTraining(solved) {
    stopTrainingTimer()
    if (!trainingOn() || closed || dealPending || !trainingRoundReady) return
    setClosed(true)
    input.disabled = true
    form.hidden = true
    paintRack()
    const stats = recordTraining(!!solved)
    paintTrainingStats(stats)
    resultEl.hidden = false
    resultEl.className = `game-result training-result${solved ? ' hot' : ''}`
    const answers = catalog
      .map((entry) => `<span class="training-answer${trainingFound.has(entry.word) ? ' is-found' : ''}">${escapeHtml(entry.word)}<small>${entry.pts}</small></span>`)
      .join('')
    resultEl.innerHTML = `
      <div class="training-summary">
        <strong>${escapeHtml(solved ? t('training_complete') : t('training_progress', trainingNeededFound(trainingFound, trainingNeeded), trainingTotal))}</strong>
      </div>
      <div class="training-answers">${answers}</div>`
    nextAction = () => deal()
    if (nextBtn) {
      nextBtn.hidden = false
      nextBtn.setAttribute('aria-label', t('training_new'))
    }
    paintTrainingProgress(solved ? t('training_complete') : '')
  }

  function paintTrainingControls() {
    if (!trainingEl) return
    trainingEl.hidden = !trainingOn()
    if (trainingPresetSelect) {
      trainingPresetSelect.value = trainingPreset
      trainingPresetSelect.disabled = dealPending
    }
    if (trainingMinBtn) {
      trainingMinBtn.hidden = trainingPreset !== 'all'
      trainingMinBtn.textContent = trainingMinLen >= 7 ? '7' : `${trainingMinLen}+`
      trainingMinBtn.setAttribute('aria-label', t('training_min_cd', trainingMinLen))
      trainingMinBtn.title = t('training_min_cd', trainingMinLen)
    }
    if (trainingRevealBtn) {
      trainingRevealBtn.textContent = t('training_reveal')
      trainingRevealBtn.disabled = dealPending || closed || !trainingRoundReady
    }
    if (trainingTimerEl) trainingTimerEl.disabled = dealPending || closed || !trainingRoundReady
    trainingEl.querySelectorAll('[data-training-label]').forEach((element) => {
      element.textContent = t(element.dataset.trainingLabel)
    })
    paintTrainingProgress()
  }

  async function resolvedDef(word) {
    if (!define) return { payload: { found: false }, formOf: '', root: null }
    const payload = await define(word, { stable: true })
    const blob = (payload?.senses || []).flatMap((s) => s.defs).join(' ')
    const formOf = extractFormOf(blob)
    const inflection = payload?.found && (payload.senses || []).every((s) => s.defs.every(isInflectionDef))
    let root = null
    if (inflection && formOf) root = await define(formOf, { stable: true })
    return { payload, formOf, root }
  }

  function paintDef(id, resolved, word = '') {
    const box = resultEl.querySelector(id)
    if (!box) return
    const home = { ...resolved, word: resolved.word || word }
    box._home = home
    box.innerHTML = defBody(home.payload, escapeHtml, { formOf: home.formOf, root: home.root, word: home.word })
  }

  function resultPanelHtml(tops, start, mineWord) {
    return `
      <div class="game-top" role="tablist" aria-label="${escapeHtml(t('best_words'))}">
        ${tops
          .map(
            (w, i) => `<button type="button" role="tab" data-def-tab="${i}" data-def-word="${escapeHtml(w.word)}" data-def-pts="${w.pts}" aria-selected="${i === start ? 'true' : 'false'}" class="${mineWord && w.word === mineWord ? 'is-mine' : ''}">
          <span class="game-top-word">${escapeHtml(w.word)}</span>
          <span class="game-top-pts">${w.pts}</span>
        </button>`
          )
          .join('')}
      </div>
      <div class="game-def-panel">
        ${favButtonHtml(tops[start]?.word, tops[start]?.pts, escapeHtml, 'game-def-fav')}
        <div class="game-def-body" id="def-body">${defBody(null, escapeHtml)}</div>
      </div>`
  }

  function paintResultFav(word, pts) {
    const btn = resultEl.querySelector('.game-def-fav')
    if (!btn) return
    btn.dataset.favWord = word || ''
    btn.dataset.favPts = String(Math.max(0, Math.round(Number(pts) || 0)))
    btn.hidden = !word
    paintFavStar(btn)
  }

  function wireResultTabs(shown, canPaint) {
    let wantTop = ''
    async function showTop(word, pts) {
      if (!word) return
      paintResultFav(word, pts)
      if (!define) return
      wantTop = word
      if (shown.has(word)) {
        paintDef('#def-body', shown.get(word), word)
        return
      }
      const box = resultEl.querySelector('#def-body')
      if (box) box.innerHTML = defBody(null, escapeHtml)
      const resolved = await resolvedDef(word)
      shown.set(word, resolved)
      // A later tab click supersedes this fetch — never paint a stale word.
      if (wantTop !== word) return
      if (canPaint()) paintDef('#def-body', resolved, word)
    }
    resultEl.querySelectorAll('[data-def-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        resultEl.querySelectorAll('[data-def-tab]').forEach((b) =>
          b.setAttribute('aria-selected', b === btn ? 'true' : 'false')
        )
        showTop(btn.dataset.defWord, Number(btn.dataset.defPts) || 0)
      })
    })
    return showTop
  }

  // Ends the round without recording anything: no local score, no ranked
  // submit — just reveal the best words so the player can learn and move on.
  function skipRound() {
    if (closed || dealPending || trainingOn() || !rack) return
    const dealId = dealSeq
    setClosed(true)
    input.disabled = true
    form.hidden = true
    if (hintBtn) hintBtn.hidden = true
    paintRack()
    setLive('')
    officialPlay = false
    const tops = topWords(catalog, null, 5)
    resultEl.hidden = false
    resultEl.className = 'game-result'
    resultEl.innerHTML = `
      <div class="game-score">
        <div class="game-pct">—</div>
        <div class="game-score-words">
          <p class="game-vs">${best ? t('top_word', escapeHtml(best.word), best.pts) : ''}</p>
        </div>
      </div>
      ${resultPanelHtml(tops, 0, '')}`
    nextAction = () => deal()
    if (nextBtn) {
      nextBtn.hidden = false
      nextBtn.setAttribute('aria-label', t('again'))
    }
    const showTop = wireResultTabs(new Map(), () => closed && dealId === dealSeq && !dealPending)
    showTop(tops[0]?.word, tops[0]?.pts)
  }

  function isPlayContextCurrent(context) {
    return context.dealId === dealSeq
      && context.mode === activeMode
      && context.lang === getLang()
  }

  async function syncRankedScore(percent, word, context) {
    if (!context.ranked || !isPlayContextCurrent(context)) return false
    const pending = submitPromises.get(context.dealId)
    if (pending) return pending
    const promise = (async () => {
      const { submitCompete, fetchLeaderboard, getCurrentUser, getTrailData, competeAccepted } =
        await import('./competitive.js?v=108')
      if (!isPlayContextCurrent(context)) return false
      if (context.official && officialPlay) {
        if (!getCurrentUser()) {
          officialPlay = false
        } else {
          const result = await submitCompete(percent, word, context.lang, { kids: context.kids, rack: context.rack })
          if (!isPlayContextCurrent(context)) return false
          if (competeAccepted(result)) officialPlay = false
        }
      }
      if (!isPlayContextCurrent(context)) return false
      const accepted = !officialPlay
      void (async () => {
        const trail = getTrailData()
        const board = await fetchLeaderboard(trail?.trailId, context.lang, { kids: context.kids })
        if (isPlayContextCurrent(context)) paintLeaderboard(board)
      })().catch(() => {})
      return accepted
    })()
      .catch(() => false)
      .finally(() => {
        submitPromises.delete(context.dealId)
      })
    submitPromises.set(context.dealId, promise)
    return promise
  }

  async function validate(raw) {
    if (closed) return
    const word = normalize(raw)
    let hit = catalog.find((w) => w.word === word)
    let synthetic = false
    if (!hit) {
      // Curated catalogs (kids lists) deliberately miss valid words — ATOM on
      // AOTTOM must be playable. Probe rack + dictionary before refusing.
      let probe = null
      try {
        probe = await ask('probe', { word, rack })
      } catch {}
      if (!probe || closed || normalize(input.value) !== word || (probe.dict && probe.dict !== getDict())) return
      if (!probe.formable) {
        setLive(word.length < 2 ? (kidsOn() ? t('kids_need') : t('need_best')) : t('not_on_rack'), 'bad')
        rackEl.classList.remove('shake')
        void rackEl.offsetWidth
        rackEl.classList.add('shake')
        return
      }
      if (!probe.valid) {
        setLive(t('not_in_dict', dictLabel()), 'bad')
        rackEl.classList.remove('shake')
        void rackEl.offsetWidth
        rackEl.classList.add('shake')
        return
      }
      hit = { word, pts: playPoints(word, probe.score), jokers: [] }
      synthetic = true
      catalog.push(hit)
      catalog.sort((a, b) => b.pts - a.pts)
      best = catalog[0]
    }
    if (trainingOn()) {
      if (trainingFound.has(hit.word)) {
        setLive(t('training_progress', trainingNeededFound(trainingFound, trainingNeeded), trainingTotal), 'bad')
        input.value = ''
        return
      }
      trainingFound.add(hit.word)
      input.value = ''
      const needed = trainingNeededFound(trainingFound, trainingNeeded)
      const left = Math.max(0, trainingTotal - needed)
      setLive(left
        ? `${hit.word} · ${hit.pts} pts · ${t('training_same_rack', left)}`
        : `${hit.word} · ${hit.pts} pts`, 'ok')
      paintTrainingProgress()
      paintRack()
      onPlayed?.({ word: hit.word, pts: hit.pts, best: '', bestPts: 0 })
      if (trainingRoundSolved(trainingFound, trainingNeeded)) finishTraining(true)
      return
    }
    const playKids = kidsOn()
    const playContext = {
      dealId: dealSeq,
      mode: activeMode,
      lang: getLang(),
      kids: playKids,
      // Off-catalog words can't be scored by the ranked server trails — keep
      // them local (chart + anonymous stats only).
      ranked: !synthetic && (playKids || !!(isCompetitive && isCompetitive())),
      official: officialPlay && !synthetic,
      rack,
    }
    setClosed(true)
    input.disabled = true
    form.hidden = true
    if (hintBtn) hintBtn.hidden = true
    paintRack()
    const max = best?.pts || hit.pts
    const percent = playPercent(hit.pts, max)
    const same = best && best.word === hit.word
    resultEl.hidden = false
    resultEl.className = `game-result ${percent >= 100 ? 'hot' : percent >= 60 ? 'warm' : ''}`
    const vs = same
      ? t('best_word')
      : percent >= 100
        ? t('tied', escapeHtml(best.word), best.pts)
        : t('top_word', escapeHtml(best.word), best.pts)
    const tops = topWords(catalog, hit, 5)
    const start = Math.max(0, tops.findIndex((w) => w.word === hit.word))
    const shown = new Map()
    resultEl.innerHTML = `
      <div class="game-score">
        <div class="game-pct">${percent}<small>%</small></div>
        <div class="game-score-words">
          <p class="game-break"><strong>${escapeHtml(hit.word)}</strong> ${hit.pts}</p>
          <p class="game-vs">${vs}</p>
        </div>
      </div>
      ${resultPanelHtml(tops, start, hit.word)}`
    setLive('')
    if (playKids) {
      rememberKidsFound()
      paintStudyShare(hit.word, hit.pts)
      paintChart(rememberScore(percent, null, true))
      if (globalEl) globalEl.textContent = t('kids_found', loadKidsFound())
    } else {
      paintShare(percent)
      paintChart(rememberScore(percent))
    }
    onPlayed?.({ word: hit.word, pts: hit.pts, best: best?.word || dealSeed, bestPts: best?.pts })
    nextAction = async () => {
      if (!isPlayContextCurrent(playContext)) return
      if (playContext.official && officialPlay && !(await syncRankedScore(percent, hit.word, playContext))) return
      if (!isPlayContextCurrent(playContext)) return
      await deal()
    }
    if (nextBtn) {
      nextBtn.hidden = false
      nextBtn.setAttribute('aria-label', t('again'))
    }

    const showTop = wireResultTabs(shown, () => closed && isPlayContextCurrent(playContext))
    const rankedPromise = playContext.ranked
      ? syncRankedScore(percent, hit.word, playContext)
      : null
    await showTop(tops[start]?.word, tops[start]?.pts)
    if (playKids && isPlayContextCurrent(playContext)) {
      const resolved = shown.get(tops[start]?.word)
      paintStudyShare(hit.word, hit.pts, resolved?.payload?.senses?.[0]?.defs?.[0] || '')
    }
    if (!isPlayContextCurrent(playContext)) return
    if (playContext.ranked) {
      await rankedPromise
    } else {
      try {
        const res = await fetch('/api/game/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ percent }),
        })
        const data = await res.json()
        if (data?.ok && isPlayContextCurrent(playContext) && trainingOn() && globalEl) {
          globalEl.hidden = false
          globalEl.textContent = formatAverage(data.average)
        }
      } catch {
        /* offline */
      }
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    validate(input.value)
  })
  hintBtn?.addEventListener('click', () => giveHint())
  trainingRevealBtn?.addEventListener('click', () => finishTraining(false))
  trainingTimerEl?.addEventListener('change', () => startTrainingTimer())
  trainingPresetSelect?.addEventListener('change', async () => {
    const preset = trainingPresetSelect.value
    if (!['all', 'seven', 'eight', 'plusOne', 'joker', 'hard'].includes(preset)) return
    trainingPreset = preset
    try {
      localStorage.setItem('verimots-training-preset', preset)
    } catch {
      /* private mode */
    }
    paintTrainingControls()
    if (trainingOn()) await deal()
  })
  trainingMinBtn?.addEventListener('click', async () => {
    trainingMinLen = trainingMinLen >= 7 ? 2 : trainingMinLen + 1
    try {
      localStorage.setItem('verimots-training-min', String(trainingMinLen))
    } catch {
      /* private mode */
    }
    paintTrainingControls()
    if (trainingOn()) await deal()
  })
  input.addEventListener('input', preview)
  alphaBtn?.addEventListener('click', () => {
    rackAlpha = !rackAlpha
    try {
      localStorage.setItem('verimots-rack-alpha', rackAlpha ? '1' : '0')
    } catch {
      /* private mode */
    }
    paintRack()
  })
  skipBtn?.addEventListener('click', () => skipRound())
  rackEl.addEventListener('click', (e) => {
    if (closed || dealPending) return
    const tile = e.target.closest('[data-rack-i]')
    if (!tile) return
    const i = Number(tile.dataset.rackI)
    const ch = rack[i]
    if (!ch) return
    const word = normalize(input.value)
    const assignments = tileAssignments(rack, word)
    if (assignments.has(i)) {
      const cut = assignments.get(i)
      input.value = word.slice(0, cut) + word.slice(cut + 1)
    } else if (ch === '?') {
      setLive(t('joker_type_letter'))
      input.focus()
      return
    } else {
      input.value = word + ch
    }
    preview()
    input.focus()
  })
  resultEl.addEventListener('click', async (e) => {
    const back = e.target.closest('[data-def-back]')
    if (back) {
      const box = back.closest('.game-def-body')
      if (box?._home) paintDef(`#${box.id}`, box._home)
      return
    }
    const btn = e.target.closest('[data-form-of]')
    if (!btn || !define) return
    const root = btn.dataset.formOf
    const box = btn.closest('.game-def-body')
    if (!box || !root) return
    const homeWord = box._home?.word || box._home?.payload?.word || box.dataset.originWord || ''
    box.innerHTML = `<p class="pending">${t('sense_of', escapeHtml(root))}</p>`
    const resolved = await resolvedDef(root)
    if (closed) {
      box.innerHTML = `${backBtn(homeWord, escapeHtml)}${defBody(resolved.payload, escapeHtml, { asRoot: true })}`
    }
  })

  async function switchMode(mode, opts = {}) {
    // The old mode-switch row is gone (replaced by the game menu); mode state
    // itself is still driven through here by app.js.
    const competitive = mode === true || mode === 'competitive'
    const kids = mode === 'kids'
    const training = mode === 'training'
    const next = competitive ? 'competitive' : kids ? 'kids' : training ? 'training' : 'defi'
    const changed = activeMode !== next
    activeMode = next
    if (next !== 'training') stopTrainingTimer()
    document.body.classList.toggle('kids', next === 'kids')
    document.body.classList.toggle('training', next === 'training')
    modeDefi?.setAttribute('aria-pressed', next === 'defi' ? 'true' : 'false')
    modeTraining?.setAttribute('aria-pressed', next === 'training' ? 'true' : 'false')
    modeKids?.setAttribute('aria-pressed', next === 'kids' ? 'true' : 'false')
    modeComp?.setAttribute('aria-pressed', next === 'competitive' ? 'true' : 'false')
    if (hintBtn) hintBtn.hidden = next !== 'kids'
    paintTrainingControls()
    if (!changed && rack && !opts.force) return
    const requestId = ++modeSeq
    ++dealSeq
    if (next === 'competitive' || next === 'kids') {
      // Leaving training: its "n/n rounds" meta must not linger in the header.
      if (globalEl && next === 'competitive') {
        globalEl.hidden = true
        globalEl.textContent = ''
      }
      await initRanked(next === 'kids', requestId)
      return
    }
    if (authEl) authEl.hidden = true
    if (userEl) userEl.hidden = true
    paintGlobal()
    paintLeaderboard()
    await deal()
  }

  async function initCompetitive() {
    return initRanked(false)
  }

  async function initRanked(kids, requestId = modeSeq) {
    const { initGoogleSignIn, checkSession, getCurrentUser, handleGoogleCallback, fetchDailyTrail, fetchLeaderboard } = await import('./competitive.js?v=108')
    const user = await checkSession()
    if (requestId !== modeSeq || activeMode !== (kids ? 'kids' : 'competitive')) return
    if (user) {
      if (authEl) authEl.hidden = true
      if (userEl) {
        userEl.hidden = false
        const pic = document.getElementById('user-pic')
        const name = document.getElementById('user-name')
        if (pic) {
          const src = String(user.picture || '')
          pic.hidden = !src
          pic.onerror = () => {
            pic.removeAttribute('src')
            pic.hidden = true
          }
          if (src) pic.src = src
          else pic.removeAttribute('src')
        }
        if (name) name.textContent = user.name || t('user_fallback')
        const statsEl = document.getElementById('user-stats')
        if (statsEl) {
          const s = user.stats || {}
          const bits = []
          if (s.streak) bits.push(t('streak_d', s.streak))
          if (s.best) bits.push('best ' + s.best + ' %')
          if (s.words) bits.push(t('words_n', s.words))
          statsEl.textContent = bits.join(' · ')
        }
        document.dispatchEvent(new CustomEvent('verimots-auth', { detail: user }))
      }
    } else {
      if (userEl) userEl.hidden = true
      if (authEl) authEl.hidden = false
      try {
        await initGoogleSignIn()
      } catch {
        /* ranked play remains available without Google */
      }
      if (requestId !== modeSeq || activeMode !== (kids ? 'kids' : 'competitive')) return
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: '617674779621-vu2iv3rjfcs08nrf5m6apn2ivnh9rim7.apps.googleusercontent.com',
          callback: async (response) => {
            const result = await handleGoogleCallback(response)
            if (result.ok) {
              await switchMode(kids ? 'kids' : 'competitive', { force: true })
            }
          }
        })
        const btn = document.getElementById('google-signin-btn')
        if (btn) {
          btn.innerHTML = ''
          window.google.accounts.id.renderButton(btn, {
            theme: 'filled_blue',
            size: 'large',
            text: 'signin_with',
            locale: getLang()
          })
        }
      }
    }

    const [trail, adultBoard, kidsBoard] = await Promise.all([
      fetchDailyTrail(getLang(), { kids }),
      fetchLeaderboard(null, getLang()),
      fetchLeaderboard(null, getLang(), { kids: true }),
    ])
    if (requestId !== modeSeq || activeMode !== (kids ? 'kids' : 'competitive')) return
    lastBoard = adultBoard
    lastKidsBoard = kidsBoard
    paintLeaderboard()
    const mine = kids ? lastKidsBoard : lastBoard
    if (kids) paintKidsMeta()
    if (mine?.me) {
      await deal()
    } else if (trail?.rack) {
      await deal(trail.rack, kids ? 'kids' : trail.category, { official: true, seed: trail.seed })
    } else {
      await deal()
    }
  }

  let lastBoard = null
  let lastKidsBoard = null

  function boardBlock(empty, data) {
    if (!data) {
      return `<p class="board-empty">${escapeHtml(empty)}</p>`
    }
    if (!data.ok) {
      return `<p class="board-empty">${escapeHtml(t('board_unavailable'))}</p>`
    }
    const top = Array.isArray(data.top) ? data.top.slice(0, 10) : []
    if (!top.length) {
      return `<p class="board-empty">${escapeHtml(empty)}</p>`
    }
    const me = data.me
    const rows = top.map((entry) => {
      const isMeRow = me && entry.rank === me.rank
      return `<div class="board-row${isMeRow ? ' is-me' : ''}">
        <span class="board-rank">${entry.rank}</span>
        <span class="board-name">${escapeHtml(entry.pseudo)}</span>
        <span class="board-word">${entry.word ? escapeHtml(entry.word) : ''}</span>
        <span class="board-percent">${boardPercentHtml(entry)}</span>
      </div>`
    })
    if (me && me.rank > 10) {
      rows.push(`<div class="board-row is-me">
        <span class="board-rank">${me.rank}</span>
        <span class="board-name">${escapeHtml(me.pseudo)}</span>
        <span class="board-word">${me.word ? escapeHtml(me.word) : ''}</span>
        <span class="board-percent">${boardPercentHtml(me)}</span>
      </div>`)
    }
    return `<div class="board-list">${rows.join('')}</div>`
  }

  function paintLeaderboard(board) {
    if (!boardEl) return
    if (board) {
      if (board.kids) lastKidsBoard = board
      else lastBoard = board
    }
    const ranked = !trainingOn() && (kidsOn() || (typeof isCompetitive === 'function' && isCompetitive()))
    if (!ranked) {
      boardEl.hidden = true
      boardEl.innerHTML = ''
      return
    }
    const kidsTab = kidsOn()
    const data = kidsTab ? lastKidsBoard : lastBoard
    const empty = kidsTab ? t('kids_board_empty') : t('board_empty')
    boardEl.hidden = false
    boardEl.innerHTML = `
      <p class="board-title">${escapeHtml(t('board_title'))}</p>
      ${boardBlock(empty, data)}`
    if (waEl) waEl.classList.add('is-off')
    paintChart(loadScores(null, kidsTab), kidsTab)
  }

  function paintChrome() {
    if (catEl) {
      catEl.textContent = kickerText(
        category === 'kids' || kidsOn() ? 'kids' : category === 'training' || trainingOn() ? 'training' : category
      )
    }
    if (modeDefi) modeDefi.textContent = t('mode_defi')
    if (modeTraining) modeTraining.textContent = t('mode_training')
    if (modeKids) modeKids.textContent = t('mode_kids')
    if (modeComp) modeComp.textContent = t('mode_comp')
    if (hintBtn) {
      hintBtn.textContent = t('kids_hint')
      hintBtn.hidden = !kidsOn() || closed
    }
    const authHelp = document.querySelector('#game-auth .auth-help')
    if (authHelp) authHelp.textContent = t('auth_help')
    const logout = document.getElementById('logout-btn')
    if (logout) logout.textContent = t('sign_out')
    if (input) {
      input.placeholder = t('play_hint')
      const lab = document.querySelector('label[for="game-q"]')
      if (lab) lab.textContent = kidsOn() ? t('kids_play') : t('play_label')
    }
    paintTrainingControls()
    paintRackTools()
    if (lastBoard || lastKidsBoard) paintLeaderboard()
    if (closed) {
      if (nextBtn && !nextBtn.hidden) {
        nextBtn.setAttribute('aria-label', trainingOn() ? t('training_new') : t('again'))
      }
    } else {
      preview()
    }
  }

  async function refresh() {
    paintChrome()
    paintGlobal()
    if (trainingOn()) {
      await switchMode('training', { force: true })
      return
    }
    if (kidsOn()) {
      await switchMode('kids', { force: true })
      return
    }
    if (isCompetitive && isCompetitive()) {
      await switchMode('competitive', { force: true })
      return
    }
    if (!rack || !ready()) return
    try {
      const res = await ask('anagram', { rack, min: 2, max: rack.length })
      if (res.lang && res.lang !== getLang()) return
      applyDeal(rack, category, res.groups || [])
      setClosed(false)
      form.hidden = false
      resultEl.hidden = true
      resultEl.innerHTML = ''
      input.disabled = false
    } catch {
      /* keep current catalog */
    }
  }

  document.addEventListener('verimots-lang', () => {
    paintChrome()
  })

  return {
    async open(opts = {}) {
      if (isCompetitive && isCompetitive()) {
        await switchMode('competitive')
      } else if (kidsOn()) {
        await switchMode('kids')
      } else if (typeof isTraining === 'function' && isTraining()) {
        await switchMode('training')
      } else {
        await switchMode('defi')
        const fromUrl = parseRack(opts.rack)
        if (fromUrl.length >= 2 && fromUrl !== rack) await deal(fromUrl, opts.category)
      }
      if (!closed) input.focus()
    },
    async showBoard() {
      const { fetchLeaderboard } = await import('./competitive.js?v=108')
      lastBoard = await fetchLeaderboard(null, getLang())
      lastKidsBoard = await fetchLeaderboard(null, getLang(), { kids: true })
      paintLeaderboard()
    },
    refresh,
    deal,
    switchMode,
  }
}
