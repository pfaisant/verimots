/* Verimots tile model — shared by the app, the worker and the game server.
 *
 * Spanish Scrabble uses digraph tiles, and two official tile sets exist:
 *
 * - 'fise'  International (100 tiles): CH, LL, RR are single tiles; K and W
 *           do not exist and a blank may not stand for them (FISE rule), so
 *           words containing K or W are valid in the list but unplayable.
 * - 'na'    North America "Edición en español" (103 tiles): K and W exist,
 *           LL and RR are single tiles, but there is no CH tile.
 *
 * Internally a word or rack is an ENCODED string: one char per tile, with
 * digraphs folded to digits — '1' = CH, '2' = LL, '3' = RR. Every index,
 * length, joker position or shuffle then stays tile-correct. Display strings
 * are the decoded form ("CHORRO"); racks may carry a '·' separator to keep
 * two single tiles (L·L) from merging into a digraph on re-encode.
 */

export const TILE_SEP = '·'

const GLYPHS = { 1: 'CH', 2: 'LL', 3: 'RR' }

export function normalizeEsEdition(value) {
  return value === 'na' ? 'na' : 'fise'
}

export const FR_VALUES = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1,
  J: 8, K: 10, L: 1, M: 2, N: 1, O: 1, P: 3, Q: 8, R: 1,
  S: 1, T: 1, U: 1, V: 4, W: 10, X: 10, Y: 10, Z: 10,
}
export const EN_VALUES = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1,
  J: 8, K: 5, L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1,
  S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10,
}
// International (FISE) — no K or W tiles.
export const ES_FISE_VALUES = {
  A: 1, B: 3, C: 3, 1: 5, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1,
  J: 8, L: 1, 2: 8, M: 3, N: 1, Ñ: 8, O: 1, P: 3, Q: 5, R: 1,
  3: 8, S: 1, T: 1, U: 1, V: 4, X: 8, Y: 4, Z: 10,
}
// North America — K and W exist, no CH tile.
export const ES_NA_VALUES = {
  A: 1, B: 3, C: 2, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1,
  J: 6, K: 8, L: 1, 2: 8, M: 3, N: 1, Ñ: 8, O: 1, P: 3, Q: 8, R: 1,
  3: 8, S: 1, T: 1, U: 1, V: 4, W: 8, X: 8, Y: 4, Z: 10,
}

export const FR_BAG = {
  A: 9, B: 2, C: 2, D: 3, E: 15, F: 2, G: 2, H: 2, I: 8,
  J: 1, K: 1, L: 5, M: 3, N: 6, O: 6, P: 2, Q: 1, R: 6,
  S: 6, T: 6, U: 6, V: 2, W: 1, X: 1, Y: 1, Z: 1,
}
export const EN_BAG = {
  A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9,
  J: 1, K: 1, L: 4, M: 2, N: 6, O: 8, P: 2, Q: 1, R: 6,
  S: 4, T: 6, U: 4, V: 2, W: 2, X: 1, Y: 2, Z: 1,
}
// 98 letter tiles + 2 blanks = 100.
export const ES_FISE_BAG = {
  A: 12, B: 2, C: 4, 1: 1, D: 5, E: 12, F: 1, G: 2, H: 2, I: 6,
  J: 1, L: 4, 2: 1, M: 2, N: 5, Ñ: 1, O: 9, P: 2, Q: 1, R: 5,
  3: 1, S: 6, T: 4, U: 5, V: 1, X: 1, Y: 1, Z: 1,
}
// 101 letter tiles + 2 blanks = 103.
export const ES_NA_BAG = {
  A: 11, B: 3, C: 4, D: 4, E: 11, F: 2, G: 2, H: 2, I: 6,
  J: 2, K: 1, L: 4, 2: 1, M: 3, N: 5, Ñ: 1, O: 8, P: 2, Q: 1, R: 4,
  3: 1, S: 7, T: 4, U: 6, V: 2, W: 1, X: 1, Y: 1, Z: 1,
}

const HARD_DEFAULT = ['J', 'K', 'Ñ', 'Q', 'W', 'X', 'Y', 'Z']
const HARD_ES_FISE = ['J', 'Ñ', 'Q', 'X', 'Y', 'Z', '1', '2', '3']
const HARD_ES_NA = ['J', 'K', 'Ñ', 'Q', 'W', 'X', 'Y', 'Z', '2', '3']

// Tile display order for the values list.
const ORDER_FISE = ['A', 'B', 'C', '1', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'L', '2', 'M', 'N', 'Ñ', 'O', 'P', 'Q', 'R', '3', 'S', 'T', 'U', 'V', 'X', 'Y', 'Z']
const ORDER_NA = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', '2', 'M', 'N', 'Ñ', 'O', 'P', 'Q', 'R', '3', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']
const ORDER_AZ = Object.keys(FR_VALUES)

const SPECS = {
  fr: { values: FR_VALUES, bag: FR_BAG, hard: new Set(HARD_DEFAULT), digraphs: null, order: ORDER_AZ, blockedBlank: null },
  en: { values: EN_VALUES, bag: EN_BAG, hard: new Set(HARD_DEFAULT), digraphs: null, order: ORDER_AZ, blockedBlank: null },
  'es-fise': {
    values: ES_FISE_VALUES, bag: ES_FISE_BAG, hard: new Set(HARD_ES_FISE),
    digraphs: { C: { H: '1' }, L: { L: '2' }, R: { R: '3' } },
    order: ORDER_FISE, blockedBlank: /[KW]/,
  },
  'es-na': {
    values: ES_NA_VALUES, bag: ES_NA_BAG, hard: new Set(HARD_ES_NA),
    digraphs: { L: { L: '2' }, R: { R: '3' } },
    order: ORDER_NA, blockedBlank: null,
  },
}

export function tileSpec(lang = 'fr', edition = 'fise') {
  if (lang === 'es') return SPECS[`es-${normalizeEsEdition(edition)}`]
  return SPECS[lang === 'en' ? 'en' : 'fr']
}

const SEPARATORS = new Set([TILE_SEP, '-', ' ', ',', '/', "'"])

function isBlankChar(ch) {
  return ch === '?' || ch === '.' || ch === '*'
}

/** True for a rack tile that is a blank ('?', or the '.'/'*' typed forms). */
export function isBlankTile(code) {
  return isBlankChar(code)
}

/**
 * Tile codes a blank may legally stand for, in display order. A blank can
 * only become a tile the bag actually holds: that is what keeps K and W out
 * of the FISE picker, since the international set has neither.
 */
export function blankTargets(lang = 'fr', edition = 'fise') {
  const spec = tileSpec(lang, edition)
  return spec.order.filter(
    (code) => (spec.bag[code] || 0) > 0 && !(spec.blockedBlank && spec.blockedBlank.test(code))
  )
}

/**
 * Display → encoded. Input is an uppercased display string (A–Z, Ñ, blanks
 * as ? . *, optional separators). In Spanish, CH/LL/RR fold into one tile
 * unless split by a separator; typed digits 1/2/3 are direct tile entry.
 */
export function encodeTiles(raw, lang = 'fr', edition = 'fise') {
  const s = String(raw || '')
  const spec = tileSpec(lang, edition)
  if (!spec.digraphs) {
    let plain = ''
    for (const ch of s) if (!SEPARATORS.has(ch) && !/[0-9]/.test(ch)) plain += ch
    return plain
  }
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (SEPARATORS.has(ch)) continue
    if (ch === '1') {
      // CH by digit: a real tile in FISE, C + H in the NA edition.
      out += spec.digraphs.C ? '1' : 'CH'
      continue
    }
    if (ch === '2' || ch === '3') {
      out += ch
      continue
    }
    if (/[0-9]/.test(ch)) continue
    const pair = spec.digraphs[ch]
    if (pair && pair[s[i + 1]]) {
      out += pair[s[i + 1]]
      i += 1
      continue
    }
    out += ch
  }
  return out
}

/** One tile code → its display glyph ('1' → 'CH'). */
export function tileGlyph(code) {
  return GLYPHS[code] || String(code || '')
}

/** Encoded → display word ("1O3O" → "CHORRO"). */
export function decodeWord(encoded) {
  let out = ''
  for (const ch of String(encoded || '')) out += GLYPHS[ch] || ch
  return out
}

/**
 * Encoded rack → display, inserting '·' wherever two adjacent single tiles
 * would otherwise merge back into a digraph (L,L → "L·L"), so that
 * encodeTiles(decodeRack(x)) === x.
 */
export function decodeRack(encoded, lang = 'fr', edition = 'fise') {
  const spec = tileSpec(lang, edition)
  if (!spec.digraphs) return decodeWord(encoded)
  const codes = [...String(encoded || '')]
  let out = ''
  for (const code of codes) {
    const glyph = GLYPHS[code] || code
    const prev = out.slice(-1)
    if (prev && spec.digraphs[prev] && spec.digraphs[prev][glyph[0]]) out += TILE_SEP
    out += glyph
  }
  return out
}

/** Tile tokens of a display or encoded string, as encoded one-char codes. */
export function tileCodes(raw, lang = 'fr', edition = 'fise') {
  return [...encodeTiles(raw, lang, edition)]
}

/** Tile tokens as display glyphs (['CH','O','?',…]) for rendering. */
export function tileTokens(raw, lang = 'fr', edition = 'fise') {
  return tileCodes(raw, lang, edition).map((c) => (isBlankChar(c) ? '?' : tileGlyph(c)))
}

/** Number of tiles in a display or encoded string (blanks count). */
export function tileCount(raw, lang = 'fr', edition = 'fise') {
  return encodeTiles(raw, lang, edition).length
}

/** Sum of tile values over an encoded string; jokers (tile indexes) score 0. */
export function scoreTiles(encoded, values, jokers = null) {
  let n = 0
  const s = String(encoded || '')
  for (let i = 0; i < s.length; i++) {
    if (jokers && (jokers.has ? jokers.has(i) : jokers.includes(i))) continue
    n += values[s[i]] || 0
  }
  return n
}

/** True when the encoded word uses a hard tile outside its joker positions. */
export function usesHardTiles(encoded, hard, jokers = []) {
  const jk = jokers instanceof Set ? jokers : new Set(jokers)
  const s = String(encoded || '')
  for (let i = 0; i < s.length; i++) {
    if (!jk.has(i) && hard.has(s[i])) return true
  }
  return false
}

/**
 * True when the word cannot be placed with this tile set at all: the FISE
 * bag has no K or W and its blanks may not represent them.
 */
export function unplayableWord(encoded, lang = 'fr', edition = 'fise') {
  const spec = tileSpec(lang, edition)
  return Boolean(spec.blockedBlank && spec.blockedBlank.test(String(encoded || '')))
}
