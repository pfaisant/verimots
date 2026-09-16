/* Verimots tile model — shared by the app, the worker and the game server.
 *
 * Some languages have tiles that are written with more than one character.
 *
 * Spanish Scrabble uses digraph tiles, and two official tile sets exist:
 *
 * - 'fise'  International (100 tiles): CH, LL, RR are single tiles; K and W
 *           do not exist and a blank may not stand for them (FISE rule), so
 *           words containing K or W are valid in the list but unplayable.
 * - 'na'    North America "Edición en español" (103 tiles): K and W exist,
 *           LL and RR are single tiles, but there is no CH tile.
 *
 * Catalan Scrabble (100 tiles) has NY, QU and L·L (ela geminada) as single
 * tiles, plus Ç; there is no K, W or Y tile — Y only ever appears inside NY.
 * The Q tile is played as QU, the convention Catalan clubs and the DISC word
 * list follow.
 *
 * Internally a word or rack is an ENCODED string: one char per tile, with
 * multi-character tiles folded to digits — '1' = CH, '2' = LL, '3' = RR,
 * '4' = NY, '5' = QU, '6' = L·L. Every index, length, joker position or
 * shuffle then stays tile-correct. Display strings are the decoded form
 * ("CHORRO"); Spanish racks may carry a '·' separator to keep two single
 * tiles (L·L) from merging into a digraph on re-encode. Catalan needs no
 * such separator: no run of Catalan tiles is ambiguous, and there '·' is
 * part of the L·L tile itself.
 */

export const TILE_SEP = '·'

const GLYPHS = { 1: 'CH', 2: 'LL', 3: 'RR', 4: 'NY', 5: 'QU', 6: 'L·L' }

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
// Catalan (100 tiles) — no K, W or Y tile; Q is the QU tile.
// Source: Federació Internacional d'Scrabble en Català.
export const CA_VALUES = {
  A: 1, B: 3, C: 2, Ç: 10, D: 2, E: 1, F: 4, G: 3, H: 8, I: 1,
  J: 8, L: 1, 6: 10, M: 2, N: 1, 4: 10, O: 1, P: 3, 5: 8, R: 1,
  S: 1, T: 1, U: 1, V: 4, X: 10, Z: 8,
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
// 98 letter tiles + 2 blanks = 100.
export const CA_BAG = {
  A: 12, B: 2, C: 3, Ç: 1, D: 3, E: 13, F: 1, G: 2, H: 1, I: 8,
  J: 1, L: 4, 6: 1, M: 3, N: 6, 4: 1, O: 5, P: 2, 5: 1, R: 8,
  S: 8, T: 5, U: 4, V: 1, X: 1, Z: 1,
}

const HARD_DEFAULT = ['J', 'K', 'Ñ', 'Q', 'W', 'X', 'Y', 'Z']
const HARD_ES_FISE = ['J', 'Ñ', 'Q', 'X', 'Y', 'Z', '1', '2', '3']
const HARD_ES_NA = ['J', 'K', 'Ñ', 'Q', 'W', 'X', 'Y', 'Z', '2', '3']
// Every Catalan tile worth 8 or more.
const HARD_CA = ['Ç', 'H', 'J', 'X', 'Z', '4', '5', '6']

// Tile display order for the values list.
const ORDER_FISE = ['A', 'B', 'C', '1', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'L', '2', 'M', 'N', 'Ñ', 'O', 'P', 'Q', 'R', '3', 'S', 'T', 'U', 'V', 'X', 'Y', 'Z']
const ORDER_NA = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', '2', 'M', 'N', 'Ñ', 'O', 'P', 'Q', 'R', '3', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']
const ORDER_CA = ['A', 'B', 'C', 'Ç', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'L', '6', 'M', 'N', '4', 'O', 'P', '5', 'R', 'S', 'T', 'U', 'V', 'X', 'Z']
const ORDER_AZ = Object.keys(FR_VALUES)

const PLAIN_SEPARATORS = new Set([TILE_SEP, '-', ' ', ',', '/', "'"])
// Catalan writes the L·L tile with the interpunct, so '·' cannot separate.
const CA_SEPARATORS = new Set(['-', ' ', ',', '/', "'"])

const SPECS = {
  fr: {
    values: FR_VALUES, bag: FR_BAG, hard: new Set(HARD_DEFAULT), groups: null,
    order: ORDER_AZ, blockedBlank: null, separators: PLAIN_SEPARATORS, sep: TILE_SEP, typed: null,
  },
  en: {
    values: EN_VALUES, bag: EN_BAG, hard: new Set(HARD_DEFAULT), groups: null,
    order: ORDER_AZ, blockedBlank: null, separators: PLAIN_SEPARATORS, sep: TILE_SEP, typed: null,
  },
  'es-fise': {
    values: ES_FISE_VALUES, bag: ES_FISE_BAG, hard: new Set(HARD_ES_FISE),
    groups: [['CH', '1'], ['LL', '2'], ['RR', '3']],
    order: ORDER_FISE, blockedBlank: /[KW]/, separators: PLAIN_SEPARATORS, sep: TILE_SEP,
    typed: { 1: '1', 2: '2', 3: '3' },
  },
  'es-na': {
    values: ES_NA_VALUES, bag: ES_NA_BAG, hard: new Set(HARD_ES_NA),
    groups: [['LL', '2'], ['RR', '3']],
    order: ORDER_NA, blockedBlank: null, separators: PLAIN_SEPARATORS, sep: TILE_SEP,
    // CH by digit is C + H here: the NA bag has no CH tile.
    typed: { 1: 'CH', 2: '2', 3: '3' },
  },
  ca: {
    values: CA_VALUES, bag: CA_BAG, hard: new Set(HARD_CA),
    // Longest first: L·L must win over a bare L.
    groups: [['L·L', '6'], ['NY', '4'], ['QU', '5']],
    order: ORDER_CA, blockedBlank: null, separators: CA_SEPARATORS, sep: null,
    typed: { 4: '4', 5: '5', 6: '6' },
  },
}

export function tileSpec(lang = 'fr', edition = 'fise') {
  if (lang === 'es') return SPECS[`es-${normalizeEsEdition(edition)}`]
  if (lang === 'ca') return SPECS.ca
  return SPECS[lang === 'en' ? 'en' : 'fr']
}

function isBlankChar(ch) {
  return ch === '?' || ch === '.' || ch === '*'
}

/**
 * Display → encoded. Input is an uppercased display string (A–Z, Ñ, Ç, blanks
 * as ? . *, optional separators). Multi-character tiles fold into one tile,
 * longest match first, unless split by a separator; the tile digits (1/2/3 in
 * Spanish, 4/5/6 in Catalan) are direct tile entry.
 */
export function encodeTiles(raw, lang = 'fr', edition = 'fise') {
  const spec = tileSpec(lang, edition)
  // 'Ŀ' (L with middle dot) is one way a keyboard offers the ela geminada.
  const s = lang === 'ca'
    ? String(raw || '').replace(/[Ŀŀ]/g, 'L·').replace(/[•‧∙]/g, '·')
    : String(raw || '')
  if (!spec.groups) {
    let plain = ''
    for (const ch of s) if (!spec.separators.has(ch) && !/[0-9]/.test(ch)) plain += ch
    return plain
  }
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (spec.separators.has(ch)) continue
    if (/[0-9]/.test(ch)) {
      out += spec.typed[ch] || ''
      continue
    }
    const group = spec.groups.find(([sequence]) => s.startsWith(sequence, i))
    if (group) {
      out += group[1]
      i += group[0].length - 1
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
 *
 * Catalan needs no separator (spec.sep is null): no run of Catalan tiles
 * re-encodes ambiguously, because there is no bare Q or Y tile and '·' only
 * ever comes from L·L. tests/tiles.test.mjs proves that over every pair and
 * triple of tiles.
 */
export function decodeRack(encoded, lang = 'fr', edition = 'fise') {
  const spec = tileSpec(lang, edition)
  if (!spec.groups || !spec.sep) return decodeWord(encoded)
  const codes = [...String(encoded || '')]
  let out = ''
  for (const code of codes) {
    const glyph = GLYPHS[code] || code
    const prev = out.slice(-1)
    const merges = prev && spec.groups.some(([sequence]) => sequence === prev + glyph[0])
    if (merges) out += spec.sep
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
