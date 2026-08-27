import { t, getLang, getDict, getEsEdition, dictLabel } from './i18n.js?v=131'
import { favButtonHtml, paintFavStar } from './favorites.js?v=131'
import { tileSpec, encodeTiles, decodeRack, tileTokens, tileCount, usesHardTiles } from './tiles.js?v=131'

const CAT_KEYS = new Set(['bingo', 'long', 'hard'])

/** Display string → tile-encoded string with the current language/edition. */
function encW(value) {
  return encodeTiles(String(value || '').toUpperCase(), getLang(), getEsEdition())
}

/** Tile length of a display string (CH/LL/RR count as one in Spanish). */
function tlen(value) {
  return encW(value).length
}

function catLabel(cat) {
  const key = CAT_KEYS.has(cat) ? `cat_${cat}` : 'cat_defi'
  return t(key)
}

export function tileValues(lang = getLang(), edition = getEsEdition()) {
  return tileSpec(lang, edition).values
}

export function letterScore(word, lang = getLang(), jokers = []) {
  const values = tileValues(lang)
  const jk = jokers instanceof Set ? jokers : new Set(jokers)
  let n = 0
  const letters = encodeTiles(String(word || '').toUpperCase(), lang, getEsEdition())
  for (let i = 0; i < letters.length; i++) {
    if (jk.has(i)) continue
    n += values[letters[i]] || 0
  }
  return n
}

export function playPoints(word, baseScore, lang = getLang()) {
  return (baseScore || 0) + (tileCount(String(word || '').toUpperCase(), lang, getEsEdition()) === 7 ? 50 : 0)
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
  const sentinel = '\ue000'
  const up = String(raw || '')
    .normalize('NFC')
    .replace(/ñ/gi, sentinel)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replaceAll(sentinel, 'Ñ')
    .replace(/[^A-ZÑ123·\-\s]/g, '')
  const enc = encodeTiles(up, getLang(), getEsEdition()).slice(0, 7)
  return decodeRack(enc, getLang(), getEsEdition())
}

export function defiShareText(rack, percent) {
  const tiles = tileTokens(rack, getLang(), getEsEdition()).join(' ')
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
    // Whole word only — a bare match underlined "broder" INSIDE "broderie",
    // cutting the link off mid-word.
    const re = new RegExp(
      `(?<![A-Za-zÀ-ÿŒœ])(${root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?![A-Za-zÀ-ÿŒœ])`,
      'i'
    )
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
  const rackCodes = [...encW(tiles)]
  const wordCodes = [...encW(word)]
  const assigned = new Map()
  const unmatched = []
  for (let wordIndex = 0; wordIndex < wordCodes.length; wordIndex++) {
    const ch = wordCodes[wordIndex]
    const rackIndex = rackCodes.findIndex((tile, index) =>
      tile === ch && !assigned.has(index)
    )
    if (rackIndex >= 0) assigned.set(rackIndex, wordIndex)
    else unmatched.push(wordIndex)
  }
  for (const wordIndex of unmatched) {
    const rackIndex = rackCodes.findIndex((tile, index) =>
      (tile === '?' || tile === '.' || tile === '*') && !assigned.has(index)
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
  const rack = tileTokens(String(tiles || ''), getLang(), getEsEdition())
  const idxs = rack.map((_, i) => i)
  if (!alpha) return idxs
  const lang = getLang()
  return idxs.sort((a, b) => {
    const blank = (g) => g === '?'
    const ca = rack[a]
    const cb = rack[b]
    if (blank(ca) !== blank(cb)) return blank(ca) ? 1 : -1
    return ca.localeCompare(cb, lang) || a - b
  })
}

function guessCategory(list, tiles) {
  const top = list[0]
  if (!top) return 'bingo'
  if (tlen(top.word) === 7) return 'bingo'
  if (tlen(tiles) <= 5) return 'hard'
  if (tlen(top.word) >= 6) return 'long'
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
  const trainingFoundEl = document.getElementById('training-found')
  const skipBtn = document.getElementById('game-skip')
  const trainingHintBtn = document.getElementById('training-hint')
  const trainingRevealWordBtn = document.getElementById('training-reveal-word')
  const trainingHintBox = document.getElementById('training-hint-box')
  const findToolsRow = document.getElementById('find-tools-row')
  const findBestBtn = document.getElementById('find-best')
  const findGiveupBtn = document.getElementById('find-giveup')
  const clearInputBtn = document.getElementById('game-clear')
  const userInfoBtn = document.getElementById('user-info')
  const userSheet = document.getElementById('user-sheet')
  let lastUser = null

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
  let trainingFoundPlays = []
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
  // Words handed to the player (red) and words whose definition was shown
  // as a hint (orange once found).
  let trainingRevealed = new Set()
  let trainingHinted = new Set()
  let trainingHintSeq = 0
  let findBestShown = false

  const TRAINING_PRESETS = ['all', 'seven', 'eight', 'plusOne', 'joker', 'hard', 'small']
  let trainingMinLen = 6
  try {
    const saved = localStorage.getItem('verimots-training-preset')
    if (TRAINING_PRESETS.includes(saved)) trainingPreset = saved
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

  const trainingDefBox = document.getElementById('training-def-box')
  let trainingDefWord = ''
  let trainingDefSeq = 0

  function trainingAnswerHtml(entry, found) {
    return `<button type="button" class="${trainingAnswerClass(entry.word, found)}${trainingDefWord === entry.word ? ' is-open' : ''}" data-training-def="${escapeHtml(entry.word)}" data-training-pts="${entry.pts}">${escapeHtml(entry.word)}<small>${entry.pts}</small></button>`
  }

  function hideTrainingDef() {
    trainingDefSeq++
    trainingDefWord = ''
    for (const box of document.querySelectorAll('.training-def-box')) {
      box.hidden = true
      box.innerHTML = ''
    }
    document.querySelectorAll('.training-answer.is-open').forEach((el) => el.classList.remove('is-open'))
  }

  // Tap a found/revealed chip → its definition, in the box nearest the list.
  async function showTrainingDef(word, pts, box) {
    if (!box || !define) return
    if (trainingDefWord === word) {
      hideTrainingDef()
      return
    }
    hideTrainingDef()
    trainingDefWord = word
    document.querySelectorAll(`.training-answer[data-training-def="${word}"]`).forEach((el) => el.classList.add('is-open'))
    const seq = ++trainingDefSeq
    box.hidden = false
    box.innerHTML = `<div class="game-def-panel">${favButtonHtml(word, pts, escapeHtml, 'game-def-fav')}<div class="game-def-body">${defBody(null, escapeHtml)}</div></div>`
    const fav = box.querySelector('.game-def-fav')
    if (fav) paintFavStar(fav)
    const resolved = await resolvedDef(word)
    if (seq !== trainingDefSeq) return
    const body = box.querySelector('.game-def-body')
    if (body) {
      body._home = { ...resolved, word }
      body.innerHTML = defBody(resolved.payload, escapeHtml, { formOf: resolved.formOf, root: resolved.root, word })
    }
  }

  function trainingAnswerClass(word, found) {
    if (trainingRevealed.has(word)) return 'training-answer is-revealed'
    if (found && trainingHinted.has(word)) return 'training-answer is-found is-hinted'
    return found ? 'training-answer is-found' : 'training-answer'
  }

  /** Live list of this round's found words, newest first. */
  function paintTrainingFound() {
    if (!trainingFoundEl) return
    const show = trainingOn() && !closed && trainingFoundPlays.length > 0
    trainingFoundEl.hidden = !show
    trainingFoundEl.innerHTML = show
      ? trainingFoundPlays.map((p) => trainingAnswerHtml(p, true)).join('')
      : ''
  }

  function hideTrainingHint() {
    trainingHintSeq++
    if (!trainingHintBox) return
    trainingHintBox.hidden = true
    trainingHintBox.innerHTML = ''
  }

  function trainingRemaining() {
    return catalog.filter((entry) => !trainingFound.has(entry.word))
  }

  // Hands over one remaining word: it counts as found so the round can end,
  // but stays red in every list so the player knows it wasn't theirs.
  function revealTrainingWord() {
    if (!trainingOn() || closed || dealPending || !trainingRoundReady) return
    const left = trainingRemaining()
    if (!left.length) return
    const pick = left[Math.floor(Math.random() * left.length)]
    trainingRevealed.add(pick.word)
    trainingFound.add(pick.word)
    trainingFoundPlays.unshift(pick)
    hideTrainingHint()
    setLive('')
    paintTrainingFound()
    paintTrainingProgress()
    paintTrainingControls()
    paintRack()
    if (trainingRoundSolved(trainingFound, trainingNeeded)) finishTraining(false)
  }

  // Shows the definition of a remaining word without the word itself. The
  // word turns orange once found. Prefers words not yet hinted.
  async function giveTrainingHint() {
    if (!trainingOn() || closed || dealPending || !trainingRoundReady || !trainingHintBox) return
    const left = trainingRemaining()
    if (!left.length) return
    const fresh = left.filter((entry) => !trainingHinted.has(entry.word))
    const pool = fresh.length ? fresh : left
    const pick = pool[Math.floor(Math.random() * pool.length)]
    trainingHinted.add(pick.word)
    const seq = ++trainingHintSeq
    const dealId = dealSeq
    const head = `<span class="training-hint-head"><strong>${escapeHtml(t('training_hint_title'))}</strong><span>${escapeHtml(t('training_hint_len', pick.word.length))} · ${pick.pts} pts</span></span>`
    trainingHintBox.hidden = false
    trainingHintBox.innerHTML = `${head}<p class="pending">${escapeHtml(t('def_pending'))}</p>`
    paintTrainingControls()
    let text = ''
    try {
      const { payload, root } = await resolvedDef(pick.word)
      const source = root?.found ? root : payload
      const senses = (lexicalDefinition(source)?.senses || [])
      text = senses.flatMap((s) => s.defs || []).find((d) => /\p{L}/u.test(String(d || ''))) || ''
    } catch {
      text = ''
    }
    if (seq !== trainingHintSeq || dealId !== dealSeq || closed) return
    // Never leak the word itself through its own definition.
    const masked = text.replace(new RegExp(pick.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '…')
    trainingHintBox.innerHTML = `${head}<p>${masked ? escapeHtml(masked) : escapeHtml(t('training_hint_none'))}</p>`
  }

  function findModeOn() {
    return category !== 'kids' && category !== 'training'
      && !(typeof isCompetitive === 'function' && isCompetitive())
  }

  function bingoOn() {
    return category !== 'kids' && category !== 'training'
      && !!(typeof isCompetitive === 'function' && isCompetitive())
  }

  // "Find a word": peek at the best score, or give up to see the word.
  // Bingo: a hint (length + points of the top word) and "Passer" (scored 0 %).
  function paintFindTools() {
    if (!findToolsRow) return
    const bingo = bingoOn()
    const show = !!rack && !closed && !dealPending && (findModeOn() || bingo)
    findToolsRow.hidden = !show
    if (!show) return
    if (findBestBtn) {
      findBestBtn.textContent = bingo
        ? (findBestShown && best ? t('bingo_best_is', best.word.length, best.pts) : t('bingo_hint'))
        : (findBestShown && best ? t('find_best_is', best.pts) : t('find_best_btn'))
      findBestBtn.classList.toggle('is-shown', findBestShown)
      findBestBtn.disabled = !best
    }
    if (findGiveupBtn) {
      findGiveupBtn.textContent = bingo ? t('bingo_pass') : t('find_giveup')
      findGiveupBtn.classList.toggle('is-pass', bingo)
    }
  }

  // Bingo "Passer": the round ends with 0 % — recorded locally and on the
  // ranked board, so passing is never free.
  async function passRound() {
    if (closed || dealPending || trainingOn() || kidsOn() || !rack) return
    const playContext = {
      dealId: dealSeq,
      mode: activeMode,
      lang: getLang(),
      kids: false,
      ranked: !!(isCompetitive && isCompetitive()),
      official: officialPlay,
      rack,
    }
    setClosed(true)
    input.disabled = true
    form.hidden = true
    if (hintBtn) hintBtn.hidden = true
    paintRack()
    setLive('')
    const tops = topWords(catalog, null, 5)
    resultEl.hidden = false
    resultEl.className = 'game-result'
    resultEl.innerHTML = `
      <div class="game-score">
        <div class="game-pct">0<small>%</small></div>
        <div class="game-score-words">
          <p class="game-break"><strong>${escapeHtml(t('passed'))}</strong></p>
          <p class="game-vs">${best ? t('top_word', escapeHtml(best.word), best.pts) : ''}</p>
        </div>
      </div>
      ${resultPanelHtml(tops, 0, '')}`
    paintShare(0)
    paintChart(rememberScore(0))
    nextAction = async () => {
      if (!isPlayContextCurrent(playContext)) return
      if (playContext.official && officialPlay && !(await syncRankedScore(0, '', playContext))) return
      if (!isPlayContextCurrent(playContext)) return
      await deal()
    }
    if (nextBtn) {
      nextBtn.hidden = false
      nextBtn.setAttribute('aria-label', t('again'))
    }
    const showTop = wireResultTabs(new Map(), () => closed && isPlayContextCurrent(playContext))
    const rankedPromise = playContext.ranked ? syncRankedScore(0, '', playContext) : null
    await showTop(tops[0]?.word, tops[0]?.pts)
    if (!isPlayContextCurrent(playContext)) return
    if (rankedPromise) {
      await rankedPromise
    } else {
      try {
        await fetch('/api/game/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ percent: 0 }),
        })
      } catch {
        /* offline */
      }
    }
  }

  function paintClearBtn() {
    if (!clearInputBtn) return
    clearInputBtn.hidden = closed || dealPending || !input.value
    clearInputBtn.setAttribute('aria-label', t('clear'))
  }

  function statTile(label, value, extra = '') {
    return `<div class="user-stat${extra ? ` ${extra}` : ''}"><span class="user-stat-label">${escapeHtml(label)}</span><strong class="user-stat-value">${value}</strong></div>`
  }

  // "Mes statistiques": this week's standing (from the live board) on top,
  // all-time streak / record / words below. Avatar + name as the header.
  function paintUserSheet() {
    const body = document.getElementById('user-sheet-body')
    const title = document.getElementById('user-sheet-title')
    const sub = document.getElementById('user-sheet-sub')
    if (!body) return
    if (title) title.textContent = t('user_stats_title')
    if (sub) sub.hidden = true
    const loc = getLang() === 'en' ? 'en-GB' : getLang() === 'es' ? 'es-ES' : 'fr-FR'
    const s = lastUser?.stats || {}
    const streak = Number(s.streak) || 0
    const bestPct = Number(s.best) || 0
    const wordsN = Number(s.words) || 0
    const me = (kidsOn() ? lastKidsBoard : lastBoard)?.me || null
    const pic = String(lastUser?.picture || '')
    const head = `<div class="user-sheet-head">
      ${pic ? `<img class="user-sheet-pic" src="${escapeHtml(pic)}" alt="" width="44" height="44" referrerpolicy="no-referrer" />` : `<span class="user-sheet-pic user-sheet-pic-fallback">${escapeHtml((lastUser?.name || '?').trim().charAt(0).toUpperCase())}</span>`}
      <span class="user-sheet-who"><strong>${escapeHtml(lastUser?.name || t('user_fallback'))}</strong><small>${escapeHtml(t('stat_account'))}</small></span>
    </div>`
    if (!streak && !bestPct && !wordsN && !me) {
      body.innerHTML = `${head}<p class="empty">${escapeHtml(t('stat_empty'))}</p>`
      return
    }
    const pct = (n) => `${Number(n).toLocaleString(loc, { maximumFractionDigits: 1 })}<small>%</small>`
    const week = me
      ? `<p class="user-sheet-section">${escapeHtml(t('stat_week_title'))}</p>
        <div class="user-stats-grid">
          ${statTile(t('stat_rank'), `<small>#</small>${Number(me.rank) || '—'}`, 'is-rank')}
          ${statTile(t('stat_avg'), pct(me.percent || 0))}
          ${statTile(t('stat_plays'), Number(me.plays) || 1)}
        </div>
        ${me.word ? `<p class="user-sheet-line">${escapeHtml(t('stat_last_word'))} <strong>${escapeHtml(me.word)}</strong>${me.pts ? ` <span>${me.pts} pts</span>` : ''}</p>` : ''}`
      : ''
    body.innerHTML = `${head}${week}
      <p class="user-sheet-section">${escapeHtml(t('stat_alltime_title'))}</p>
      <div class="user-stats-grid">
        ${statTile(t('stat_streak'), `${streak}<small> ${escapeHtml(t(streak === 1 ? 'stat_day' : 'stat_days'))}</small>`)}
        ${statTile(t('stat_best'), pct(bestPct))}
        ${statTile(t('stat_words'), wordsN.toLocaleString(loc))}
      </div>`
  }

  function setUserSheetOpen(on) {
    if (!userSheet) return
    userSheet.hidden = !on
    userInfoBtn?.setAttribute('aria-expanded', on ? 'true' : 'false')
    if (on) paintUserSheet()
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
    paintFindTools()
    paintClearBtn()
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
      // Bingo has its own "Passer" (scored 0 %) in the tools row.
      skipBtn.hidden = closed || dealPending || trainingOn() || bingoOn() || !rack
    }
  }

  let rackSig = ''
  let rackDealSig = ''

  function paintRack() {
    const used = usedTiles(rack, normalize(input.value))
    const order = rackDisplayOrder(rack, rackAlpha)
    const tap = !closed && !dealPending
    const sig = JSON.stringify([rack, order, tap])
    rackEl.dataset.n = String(tlen(rack))
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
      const narrowed = catalog.filter((entry) => tlen(entry.word) >= trainingMinLen)
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
    trainingRevealed = new Set()
    trainingHinted = new Set()
    hideTrainingHint()
    hideTrainingDef()
    findBestShown = false
    if (category === 'training') {
      trainingRoundReady = true
      trainingFound = new Set()
      trainingFoundPlays = []
      paintTrainingFound()
      trainingNeeded = trainingNeededWords(catalog)
      trainingTotal = trainingNeeded.size
      trainingTargetLength = Number(trainingMeta?.targetLength) || tlen(rack)
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
    paintFindTools()
    paintClearBtn()
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
    hideTrainingHint()
    paintClearBtn()
    paintFindTools()
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
    // Plain challenge: say the goal outright — every letter is optional.
    const plain = category !== 'kids' && category !== 'training'
      && !(typeof isCompetitive === 'function' && isCompetitive())
    setLive(plain ? t('find_goal') : '')
    input.disabled = false
    input.focus()
  }

  // In "find a word", nudge without scolding: valid but below the top word
  // shows "n pts — on peut faire mieux".
  function liveScoreText(pts) {
    const findLike = category !== 'training'
      && !(typeof isCompetitive === 'function' && isCompetitive())
    if (findLike && best && pts < best.pts) return t('find_better', pts)
    return `${pts} pts`
  }

  // Valid-but-beatable words glow amber rather than green: a nudge, not a win.
  function liveScoreKind(pts) {
    const findLike = category !== 'training'
      && !(typeof isCompetitive === 'function' && isCompetitive())
    return findLike && best && pts < best.pts ? 'meh' : 'ok'
  }

  function preview() {
    if (closed) return
    paintRack()
    paintClearBtn()
    const word = normalize(input.value)
    if (!word) {
      setLive('')
      return
    }
    const hit = catalog.find((w) => w.word === word)
    if (hit) {
      setLive(liveScoreText(hit.pts), liveScoreKind(hit.pts))
      return
    }
    if (tlen(word) < 2 || trainingOn()) {
      // Training: only catalog words glow — no dictionary fallback.
      setLive('')
      return
    }
    const seq = ++probeSeq
    ask('probe', { word, rack })
      .then((probe) => {
        if (!probe || seq !== probeSeq || normalize(input.value) !== word) return
        // While typing, only celebrate valid words — the negative verdicts
        // stay for the actual submit (validate) so the table isn't nagging.
        if (probe.formable && probe.valid) {
          const pts = playPoints(word, probe.score)
          setLive(liveScoreText(pts), liveScoreKind(pts))
        } else setLive('')
      })
      .catch(() => {})
  }

  function giveHint() {
    if (closed || !kidsOn() || !hintBtn) return
    const target = catalog.find((w) => w.word === dealSeed) || best || catalog[0]
    if (!target) return
    hintLevel = Math.min(2, hintLevel + 1)
    if (hintLevel === 1) setLive(t('kids_hint_letter', tileTokens(target.word, getLang(), getEsEdition())[0]), 'ok')
    else {
      setLive(t('kids_hint_word', target.word), 'ok')
      hintBtn.disabled = true
    }
  }

  function recordTraining(solved) {
    if (trainingRoundRecorded) return loadTrainingStats()
    trainingRoundRecorded = true
    const hard = [...trainingFound].filter((word) => usesHardTiles(encW(word), tileSpec(getLang(), getEsEdition()).hard)).length
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
    paintTrainingFound()
    input.disabled = true
    form.hidden = true
    paintRack()
    const stats = recordTraining(!!solved)
    paintTrainingStats(stats)
    resultEl.hidden = false
    resultEl.className = `game-result training-result${solved ? ' hot' : ''}`
    hideTrainingHint()
    hideTrainingDef()
    const answers = catalog
      .map((entry) => trainingAnswerHtml(entry, trainingFound.has(entry.word)))
      .join('')
    resultEl.innerHTML = `
      <div class="training-summary">
        <strong>${escapeHtml(solved ? t('training_complete') : t('training_progress', trainingNeededFound(trainingFound, trainingNeeded), trainingTotal))}</strong>
      </div>
      <div class="training-answers">${answers}</div>
      <div class="training-def-box" hidden></div>`
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
    const idle = dealPending || closed || !trainingRoundReady
    const left = idle ? 0 : trainingRemaining().length
    if (trainingRevealBtn) {
      trainingRevealBtn.textContent = t('training_reveal')
      trainingRevealBtn.disabled = idle
    }
    if (trainingHintBtn) {
      trainingHintBtn.textContent = t('training_hint')
      trainingHintBtn.disabled = idle || !left || !define
    }
    if (trainingRevealWordBtn) {
      trainingRevealWordBtn.textContent = t('training_reveal_word')
      trainingRevealWordBtn.disabled = idle || !left
    }
    const modeLabel = trainingEl.querySelector('.training-mode-label')
    if (modeLabel) modeLabel.textContent = t('training_mode_label')
    if (trainingTimerEl) trainingTimerEl.disabled = idle
    const statusEl = document.getElementById('training-status')
    if (statusEl) statusEl.hidden = !trainingOn() || closed || dealPending
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
        await import('./competitive.js?v=131')
      if (!isPlayContextCurrent(context)) return false
      if (context.official && officialPlay) {
        if (!getCurrentUser()) {
          officialPlay = false
        } else {
          const result = await submitCompete(percent, word, context.lang, { kids: context.kids, rack: context.rack, pass: !word })
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
        // The all-time standing moved too.
        const all = await fetchLeaderboard(null, context.lang, { kids: context.kids, scope: 'all' })
        if (context.kids) lastAllKidsBoard = all
        else lastAllBoard = all
        if (isPlayContextCurrent(context) && boardScope === 'all') paintLeaderboard()
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
    if (trainingOn() && !hit) {
      // Combinaisons only accepts catalog words — the dictionary-probe
      // fallback let a 5-letter word through a 6+ round. Explain why instead.
      let probe = null
      try {
        probe = await ask('probe', { word, rack })
      } catch {}
      if (closed || normalize(input.value) !== word) return
      const small = trainingPreset === 'small'
      const minLen = trainingPreset === 'all' || small ? (small ? 2 : trainingMinLen) : (trainingTargetLength || tlen(rack))
      const exact = trainingPreset !== 'all' && !small
      const wordTiles = tlen(word)
      if (wordTiles < 2) setLive(t('need_best'), 'bad')
      else if (probe && !probe.formable) setLive(t('not_on_rack'), 'bad')
      else if (probe && !probe.valid) setLive(t('not_in_dict', dictLabel()), 'bad')
      else if (small && wordTiles > 3) setLive(t('training_too_long', 3), 'bad')
      else if (exact && wordTiles !== minLen) setLive(t('training_need_len', minLen), 'bad')
      else if (wordTiles < minLen) setLive(t('training_too_short', minLen), 'bad')
      else setLive(t('not_playable'), 'bad')
      rackEl.classList.remove('shake')
      void rackEl.offsetWidth
      rackEl.classList.add('shake')
      return
    }
    if (!hit) {
      // Curated catalogs (kids lists) deliberately miss valid words — ATOM on
      // AOTTOM must be playable. Probe rack + dictionary before refusing.
      let probe = null
      try {
        probe = await ask('probe', { word, rack })
      } catch {}
      if (!probe || closed || normalize(input.value) !== word || (probe.dict && probe.dict !== getDict())) return
      if (!probe.formable) {
        setLive(tlen(word) < 2 ? (kidsOn() ? t('kids_need') : t('need_best')) : t('not_on_rack'), 'bad')
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
      setLive(left ? t('training_same_rack', left) : '', 'ok')
      trainingFoundPlays.unshift(hit)
      if (trainingHinted.has(hit.word)) hideTrainingHint()
      paintTrainingFound()
      paintTrainingProgress()
      paintTrainingControls()
      paintRack()
      paintClearBtn()
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
  async function setTrainingPreset(preset, opts = {}) {
    if (!TRAINING_PRESETS.includes(preset)) return
    const changed = trainingPreset !== preset
    trainingPreset = preset
    try {
      localStorage.setItem('verimots-training-preset', preset)
    } catch {
      /* private mode */
    }
    paintTrainingControls()
    if (!opts.silent && trainingOn() && (changed || opts.redeal)) await deal()
  }
  trainingPresetSelect?.addEventListener('change', () => setTrainingPreset(trainingPresetSelect.value, { redeal: true }))
  trainingHintBtn?.addEventListener('click', () => giveTrainingHint())
  trainingRevealWordBtn?.addEventListener('click', () => revealTrainingWord())
  findBestBtn?.addEventListener('click', () => {
    findBestShown = !findBestShown
    paintFindTools()
  })
  findGiveupBtn?.addEventListener('click', () => (bingoOn() ? passRound() : skipRound()))
  clearInputBtn?.addEventListener('click', () => {
    input.value = ''
    preview()
    input.focus()
  })
  userInfoBtn?.addEventListener('click', () => setUserSheetOpen(userSheet?.hidden))
  document.getElementById('user-sheet-close')?.addEventListener('click', () => setUserSheetOpen(false))
  userSheet?.addEventListener('click', (e) => {
    if (e.target === userSheet) setUserSheetOpen(false)
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && userSheet && !userSheet.hidden) setUserSheetOpen(false)
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
    const tokens = tileTokens(rack, getLang(), getEsEdition())
    const glyph = tokens[i]
    if (!glyph) return
    const word = normalize(input.value)
    const assignments = tileAssignments(rack, word)
    if (assignments.has(i)) {
      const cut = assignments.get(i)
      const wordTokens = tileTokens(word, getLang(), getEsEdition())
      wordTokens.splice(cut, 1)
      input.value = wordTokens.join('')
    } else if (glyph === '?') {
      setLive(t('joker_type_letter'))
      input.focus()
      return
    } else {
      input.value = word + glyph
    }
    preview()
    input.focus()
  })
  function onTrainingChip(e, box) {
    const chip = e.target.closest('[data-training-def]')
    if (!chip) return false
    showTrainingDef(chip.dataset.trainingDef, Number(chip.dataset.trainingPts) || 0, box)
    return true
  }
  trainingFoundEl?.addEventListener('click', (e) => onTrainingChip(e, trainingDefBox))
  boardEl?.addEventListener('click', (e) => {
    const scopeBtn = e.target.closest('[data-board-scope]')
    if (scopeBtn) {
      setBoardScope(scopeBtn.dataset.boardScope)
      return
    }
    if (e.target.closest('[data-board-more]')) {
      boardExpanded = !boardExpanded
      paintLeaderboard()
    }
  })
  resultEl.addEventListener('click', async (e) => {
    if (onTrainingChip(e, resultEl.querySelector('.training-def-box'))) return
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
    setAuthGate(false)
    paintGlobal()
    paintLeaderboard()
    await deal()
  }

  async function initCompetitive() {
    return initRanked(false)
  }

  // The account card lives on the Infos page; it mirrors the session state.
  function paintUserCard(user) {
    lastUser = user || null
    if (userEl) userEl.hidden = !user
    if (!user) return
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
    if (userInfoBtn) userInfoBtn.setAttribute('aria-label', t('user_stats_title'))
    if (userSheet && !userSheet.hidden) paintUserSheet()
  }

  function setAuthGate(on) {
    if (authEl) authEl.hidden = !on
    document.body.classList.toggle('auth-gate', !!on)
  }

  async function initRanked(kids, requestId = modeSeq) {
    const { initGoogleSignIn, checkSession, getCurrentUser, handleGoogleCallback, fetchDailyTrail, fetchLeaderboard } = await import('./competitive.js?v=131')
    const user = await checkSession()
    if (requestId !== modeSeq || activeMode !== (kids ? 'kids' : 'competitive')) return
    if (user) {
      setAuthGate(false)
      paintUserCard(user)
      document.dispatchEvent(new CustomEvent('verimots-auth', { detail: user }))
    } else {
      paintUserCard(null)
      // Ranked play needs an account: the sign-in gate takes the whole panel.
      setAuthGate(true)
      if (catEl) catEl.textContent = t(kids ? 'kids_cat' : 'mode_comp')
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

    if (!user) return
    const [trail, adultBoard, kidsBoard, allBoard] = await Promise.all([
      fetchDailyTrail(getLang(), { kids }),
      fetchLeaderboard(null, getLang()),
      fetchLeaderboard(null, getLang(), { kids: true }),
      fetchLeaderboard(null, getLang(), { kids, scope: 'all' }),
    ])
    if (requestId !== modeSeq || activeMode !== (kids ? 'kids' : 'competitive')) return
    lastBoard = adultBoard
    lastKidsBoard = kidsBoard
    if (kids) lastAllKidsBoard = allBoard
    else lastAllBoard = allBoard
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
  let lastAllBoard = null
  let lastAllKidsBoard = null
  let boardExpanded = false
  let boardPage = false
  let boardScope = 'week'
  try {
    if (localStorage.getItem('verimots-board-scope') === 'all') boardScope = 'all'
  } catch {
    /* private mode */
  }

  async function loadGeneralBoard(kids) {
    const { fetchLeaderboard } = await import('./competitive.js?v=131')
    const requestedLang = getLang()
    const data = await fetchLeaderboard(null, requestedLang, { kids, scope: 'all' })
    if (getLang() !== requestedLang || data.lang !== requestedLang) return null
    if (kids) lastAllKidsBoard = data
    else lastAllBoard = data
    return data
  }

  async function setBoardScope(next) {
    boardScope = next === 'all' ? 'all' : 'week'
    boardExpanded = false
    try {
      localStorage.setItem('verimots-board-scope', boardScope)
    } catch {
      /* private mode */
    }
    paintLeaderboard()
    if (boardScope === 'all' && !(kidsOn() ? lastAllKidsBoard : lastAllBoard)) {
      await loadGeneralBoard(kidsOn())
      paintLeaderboard()
    }
  }

  function boardBlock(empty, data) {
    if (!data) {
      return `<p class="board-empty">${escapeHtml(empty)}</p>`
    }
    if (!data.ok) {
      return `<p class="board-empty">${escapeHtml(t('board_unavailable'))}</p>`
    }
    const all = Array.isArray(data.top) ? data.top : []
    if (!all.length) {
      return `<p class="board-empty">${escapeHtml(empty)}</p>`
    }
    const me = data.me
    const limit = 10
    const top = boardExpanded ? all : all.slice(0, limit)
    const rows = top.map((entry) => {
      const isMeRow = me && entry.rank === me.rank
      return `<div class="board-row${isMeRow ? ' is-me' : ''}">
        <span class="board-rank">${entry.rank}</span>
        <span class="board-name">${escapeHtml(entry.pseudo)}</span>
        <span class="board-word">${entry.word ? escapeHtml(entry.word) : ''}</span>
        <span class="board-percent">${boardPercentHtml(entry)}</span>
      </div>`
    })
    if (all.length > limit) {
      rows.push(`<button type="button" class="board-more" data-board-more>${escapeHtml(boardExpanded ? t('board_less') : t('board_more', all.length))}</button>`)
    }
    if (me && me.rank > top.length) {
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
    const ranked = boardPage || (!trainingOn() && (kidsOn() || (typeof isCompetitive === 'function' && isCompetitive())))
    if (!ranked) {
      boardEl.hidden = true
      boardEl.innerHTML = ''
      return
    }
    const kidsTab = kidsOn()
    const general = boardScope === 'all'
    const data = general ? (kidsTab ? lastAllKidsBoard : lastAllBoard) : (kidsTab ? lastKidsBoard : lastBoard)
    const empty = kidsTab ? t('kids_board_empty') : t('board_empty')
    boardEl.hidden = false
    const tab = (scope, label) => `<button type="button" data-board-scope="${scope}" aria-pressed="${boardScope === scope ? 'true' : 'false'}">${escapeHtml(label)}</button>`
    boardEl.innerHTML = `
      <div class="board-head">
        <p class="board-title">${escapeHtml(general ? t('board_general_title') : t('board_title'))}</p>
        <div class="board-tabs" role="group">${tab('week', t('board_week'))}${tab('all', t('board_general'))}</div>
      </div>
      ${!data ? `<p class="board-empty">${escapeHtml(t('loading'))}</p>` : boardBlock(empty, data)}`
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
    paintFindTools()
    paintClearBtn()
    if (userInfoBtn) userInfoBtn.setAttribute('aria-label', t('user_stats_title'))
    if (userSheet && !userSheet.hidden) paintUserSheet()
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
    // Leaderboards are independent per language. Never leave the previous
    // language's rows visible while the newly selected board is loading.
    lastBoard = null
    lastKidsBoard = null
    lastAllBoard = null
    lastAllKidsBoard = null
    boardExpanded = false
    paintChrome()
    if (boardPage) paintLeaderboard()
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
    // Leaderboard tab: paint regardless of the active game mode.
    async setBoardPage(on) {
      boardPage = !!on
      if (!on) {
        paintLeaderboard()
        return
      }
      paintLeaderboard()
      const { fetchLeaderboard } = await import('./competitive.js?v=131')
      const requestedLang = getLang()
      const [week, kidsWeek] = await Promise.all([
        fetchLeaderboard(null, requestedLang),
        fetchLeaderboard(null, requestedLang, { kids: true }),
      ])
      if (getLang() !== requestedLang || week.lang !== requestedLang || kidsWeek.lang !== requestedLang) return
      lastBoard = week
      lastKidsBoard = kidsWeek
      if (boardScope === 'all') await loadGeneralBoard(kidsOn())
      if (boardPage) paintLeaderboard()
    },
    async showBoard() {
      const { fetchLeaderboard } = await import('./competitive.js?v=131')
      const requestedLang = getLang()
      const [week, kidsWeek] = await Promise.all([
        fetchLeaderboard(null, requestedLang),
        fetchLeaderboard(null, requestedLang, { kids: true }),
      ])
      if (getLang() !== requestedLang || week.lang !== requestedLang || kidsWeek.lang !== requestedLang) return
      lastBoard = week
      lastKidsBoard = kidsWeek
      lastAllBoard = null
      lastAllKidsBoard = null
      if (boardScope === 'all') await loadGeneralBoard(kidsOn())
      paintLeaderboard()
    },
    refresh,
    deal,
    switchMode,
    setTrainingPreset,
    setUser: paintUserCard,
  }
}
