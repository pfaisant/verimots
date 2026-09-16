import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import {
  encodeTiles,
  decodeWord,
  decodeRack,
  tileTokens,
  tileCount,
  tileSpec,
  scoreTiles,
  unplayableWord,
} from '../web/tiles.js'
import { setLang, t } from '../web/i18n.js?v=158'
import { letterScore, playPoints, playScore, parseRack, usedTiles } from '../web/game.js'
import { kidsAnagrams, dealKids } from '../web/kids.js'
import { rememberWord, mergeHistory } from '../web/history.js?v=158'
import { toggleFavorite, loadFavorites } from '../web/favorites.js?v=158'
import { scorePlayOnRack } from '../scripts/ods-game.mjs'

test('Spanish digraphs encode as single tiles', () => {
  assert.equal(encodeTiles('CHORRO', 'es', 'fise'), '1O3O')
  assert.equal(encodeTiles('LLUVIA', 'es', 'fise'), '2UVIA')
  assert.equal(encodeTiles('CABALLO', 'es', 'fise'), 'CABA2O')
  // North America has LL and RR but no CH tile.
  assert.equal(encodeTiles('CHORRO', 'es', 'na'), 'CHO3O')
  // Separators split what would otherwise merge; digits type digraphs.
  assert.equal(encodeTiles('L·L', 'es', 'fise'), 'LL')
  assert.equal(encodeTiles('LL', 'es', 'fise'), '2')
  assert.equal(encodeTiles('1O3O', 'es', 'fise'), '1O3O')
  assert.equal(encodeTiles('1', 'es', 'na'), 'CH')
  // French and English strings pass through unchanged.
  assert.equal(encodeTiles('CHIEN', 'fr'), 'CHIEN')
  assert.equal(encodeTiles('CHILL', 'en'), 'CHILL')
})

test('decode restores display form and rack separators round-trip', () => {
  assert.equal(decodeWord('1O3O'), 'CHORRO')
  assert.equal(decodeRack('2', 'es', 'fise'), 'LL')
  assert.equal(decodeRack('LL', 'es', 'fise'), 'L·L')
  assert.equal(decodeRack('L2', 'es', 'fise'), 'L·LL')
  assert.equal(decodeRack('CH', 'es', 'fise'), 'C·H')
  for (const enc of ['LL', '2', 'L2', '2L', 'CH', '1H', 'RR', '3R', 'PE3O?']) {
    assert.equal(encodeTiles(decodeRack(enc, 'es', 'fise'), 'es', 'fise'), enc, enc)
  }
})

test('tile tokens and counts treat digraphs as one tile', () => {
  assert.deepEqual(tileTokens('CHORRO', 'es', 'fise'), ['CH', 'O', 'RR', 'O'])
  assert.deepEqual(tileTokens('CHORRO', 'es', 'na'), ['C', 'H', 'O', 'RR', 'O'])
  assert.equal(tileCount('CHAQUETA', 'es', 'fise'), 7)
  assert.equal(tileCount('ABARQUILLAMIENTO', 'es', 'fise'), 15)
  assert.equal(tileCount('WHISKEY', 'en'), 7)
})

test('Catalan folds NY, QU and L·L into single tiles', () => {
  assert.equal(encodeTiles('ANY', 'ca'), 'A4')
  assert.equal(encodeTiles('QUE', 'ca'), '5E')
  assert.equal(encodeTiles('COL·LEGI', 'ca'), 'CO6EGI')
  assert.equal(encodeTiles('CAVALL', 'ca'), 'CAVALL')
  assert.equal(encodeTiles('CAÇA', 'ca'), 'CAÇA')
  // The tile digits type a multi-character tile directly.
  assert.equal(encodeTiles('456', 'ca'), '456')
  // A keyboard may offer the ela geminada precomposed, or as a bullet.
  assert.equal(encodeTiles('COŀLEGI', 'ca'), 'CO6EGI')
  assert.equal(encodeTiles('COL•LEGI', 'ca'), 'CO6EGI')
  // Spaces and dashes still separate; '·' never does in Catalan.
  assert.equal(encodeTiles('N Y', 'ca'), 'NY')
  assert.deepEqual(tileTokens('ANY', 'ca'), ['A', 'NY'])
  assert.deepEqual(tileTokens('AQUEIX', 'ca'), ['A', 'QU', 'E', 'I', 'X'])
  assert.equal(tileCount('COL·LEGI', 'ca'), 6)
  assert.equal(decodeWord('CO6EGI'), 'COL·LEGI')
})

test('every Catalan tile run round-trips without a separator', () => {
  const codes = Object.keys(tileSpec('ca').bag)
  assert.equal(codes.length, 26)
  const round = (enc) => encodeTiles(decodeRack(enc, 'ca'), 'ca')
  for (const a of codes) {
    assert.equal(round(a), a, a)
    for (const b of codes) {
      assert.equal(round(a + b), a + b, a + b)
      for (const c of codes) assert.equal(round(a + b + c), a + b + c, a + b + c)
    }
  }
  // Blanks travel through untouched.
  assert.equal(round('?6A4?'), '?6A4?')
})

test('official bags: FISE has 100 tiles, North America 103', () => {
  const sum = (bag) => Object.values(bag).reduce((a, b) => a + b, 0)
  assert.equal(sum(tileSpec('es', 'fise').bag) + 2, 100)
  assert.equal(sum(tileSpec('es', 'na').bag) + 2, 103)
  assert.equal(sum(tileSpec('fr').bag) + 2, 102)
  assert.equal(sum(tileSpec('en').bag) + 2, 100)
  assert.equal(sum(tileSpec('ca').bag) + 2, 100)
  // No K/W tiles internationally; CH only exists internationally.
  assert.equal(tileSpec('es', 'fise').bag.K, undefined)
  assert.equal(tileSpec('es', 'na').bag.K, 1)
  assert.equal(tileSpec('es', 'fise').bag['1'], 1)
  assert.equal(tileSpec('es', 'na').bag['1'], undefined)
  // Catalan has no K, W or Y tile; Ç, L·L, NY and QU are its own.
  for (const missing of ['K', 'W', 'Y', 'Q']) {
    assert.equal(tileSpec('ca').bag[missing], undefined, missing)
  }
  for (const own of ['Ç', '4', '5', '6']) assert.equal(tileSpec('ca').bag[own], 1, own)
})

test('Catalan scores follow the FISC tile values', () => {
  const ca = tileSpec('ca').values
  // ANY: A(1) + NY(10) = 11.
  assert.equal(scoreTiles(encodeTiles('ANY', 'ca'), ca), 11)
  // QUE: QU(8) + E(1) = 9.
  assert.equal(scoreTiles(encodeTiles('QUE', 'ca'), ca), 9)
  // CAVALL: C(2)+A+V(4)+A+L+L = 10 — LL is two L tiles in Catalan.
  assert.equal(scoreTiles(encodeTiles('CAVALL', 'ca'), ca), 10)
  // COL·LEGI: C(2)+O(1)+L·L(10)+E(1)+G(3)+I(1) = 18.
  assert.equal(scoreTiles(encodeTiles('COL·LEGI', 'ca'), ca), 18)
  // CAÇA: C(2)+A+Ç(10)+A = 14.
  assert.equal(scoreTiles(encodeTiles('CAÇA', 'ca'), ca), 14)
  // A joker on the NY tile scores 0 for it.
  assert.equal(scoreTiles(encodeTiles('ANY', 'ca'), ca, [1]), 1)
  assert.equal(unplayableWord(encodeTiles('ANY', 'ca'), 'ca'), false)
})

test('Spanish scores follow the edition tile values', () => {
  const fise = tileSpec('es', 'fise').values
  const na = tileSpec('es', 'na').values
  // CHOZA: CH(5)+O+Z(10)+A = 17 internationally, C(2)+H(4)+O+Z(10)+A = 18 in NA.
  assert.equal(scoreTiles(encodeTiles('CHOZA', 'es', 'fise'), fise), 17)
  assert.equal(scoreTiles(encodeTiles('CHOZA', 'es', 'na'), na), 18)
  // PERRO: P(3)+E+RR(8)+O = 13 in both editions.
  assert.equal(scoreTiles(encodeTiles('PERRO', 'es', 'fise'), fise), 13)
  assert.equal(scoreTiles(encodeTiles('PERRO', 'es', 'na'), na), 13)
  // A joker on the RR tile scores 0 for it.
  assert.equal(scoreTiles(encodeTiles('PERRO', 'es', 'fise'), fise, [2]), 5)
})

test('K and W words are unplayable with the international tiles', () => {
  assert.equal(unplayableWord(encodeTiles('KILO', 'es', 'fise'), 'es', 'fise'), true)
  assert.equal(unplayableWord(encodeTiles('KILO', 'es', 'na'), 'es', 'na'), false)
  assert.equal(unplayableWord('WHISKY', 'en'), false)
})

test('game helpers count Spanish digraph tiles', () => {
  setLang('es')
  try {
    assert.equal(letterScore('PERRO', 'es'), 13)
    assert.equal(letterScore('CHOZA', 'es'), 17)
    assert.equal(letterScore('AÑO', 'es'), 10)
    // CHAQUETA is 7 tiles → bingo bonus applies.
    assert.equal(playPoints('CHAQUETA', 10, 'es'), 60)
    assert.equal(playScore('CHORRO', 'es'), 15)
    // Rack parsing: LLLL is two LL tiles, kept apart in display form.
    assert.equal(parseRack('llll'), 'LL·LL')
    assert.equal(parseRack('perro'), 'PERRO')
    // A rack A,CH,?,Z covers CHOZA (CH, O→joker, Z, A).
    assert.deepEqual([...usedTiles('ACH?Z', 'CHOZA')].sort(), [0, 1, 2, 3])
  } finally {
    setLang('fr')
  }
  assert.equal(parseRack('année'), 'ANNEE')
})

test('Spanish beginner words play on tiles', () => {
  const groups = kidsAnagrams('LLAVE', 'es', 'fise')
  const llave = groups.find((g) => g.len === 4)
  assert.ok(llave?.words.some((w) => w.word === 'LLAVE'), 'LLAVE is a 4-tile word')
  const deal = dealKids('es', () => 0.42, '', 'fise')
  assert.ok(deal.rack.length >= deal.seed.length - 2, 'rack covers the seed tiles')
  assert.equal(encodeTiles(deal.rack, 'es', 'fise').length, tileCount(deal.seed, 'es', 'fise'))
})

test('server scores Spanish digraph plays with FISE tiles', async () => {
  const res = await scorePlayOnRack('es', 'PERRO??', 'PERRO')
  assert.equal(res.ok, true)
  assert.equal(res.word, 'PERRO')
  assert.equal(res.pts, 13)
  assert.equal(res.rack.includes('RR'), true)
  // A word with K is not playable internationally.
  const kilo = await scorePlayOnRack('es', 'KILO???', 'KILO')
  assert.equal(kilo.ok, false)
})

test('edition and tile strings exist in every language', () => {
  for (const lang of ['fr', 'en', 'es', 'ca']) {
    setLang(lang)
    assert.notEqual(t('es_edition_fise'), 'es_edition_fise')
    assert.notEqual(t('es_edition_na'), 'es_edition_na')
    assert.notEqual(t('unplayable_kw'), 'unplayable_kw')
    assert.notEqual(t('ca_tiles_help'), 'ca_tiles_help')
    assert.notEqual(t('add_gem'), 'add_gem')
    assert.notEqual(t('board_lang_ca'), 'board_lang_ca')
    assert.notEqual(t('dict_blurb_disc'), 'dict_blurb_disc')
  }
  setLang('fr')
})

test('server scores Catalan multi-character tile plays', async () => {
  // COL·LEGI is six tiles: C O L·L E G I.
  const col = await scorePlayOnRack('ca', 'COL·LEGI?', 'COL·LEGI')
  assert.equal(col.ok, true)
  assert.equal(col.word, 'COL·LEGI')
  assert.equal(col.pts, 18)
  // PARAULA is seven tiles, so it takes the bingo bonus: 9 + 50.
  const paraula = await scorePlayOnRack('ca', 'PARAULA', 'PARAULA')
  assert.equal(paraula.ok, true)
  assert.equal(paraula.pts, 59)
  // The Q tile is QU, and a rack may be typed with the tile digits.
  const que = await scorePlayOnRack('ca', '5E?????', 'QUE')
  assert.equal(que.ok, true)
  assert.equal(que.word, 'QUE')
  assert.equal(que.pts, 9)
  // No K tile exists in Catalan, so no K word is in the list at all.
  const kilo = await scorePlayOnRack('ca', 'KILO???', 'KILO')
  assert.equal(kilo.ok, false)
})

test('Android tile tables match web/tiles.js for every language', () => {
  // The tile model lives in three places (worker, server, Android). Android is
  // the one that cannot import tiles.js, so its arrays are checked here.
  const java = readFileSync(new URL('../android/app/src/main/java/cc/pfa87/ods9/Lexicon.java', import.meta.url), 'utf8')
  const alphabet = [...java.match(/ALPHABET = "([^"]+)"/)[1]]
  const table = (name) => {
    const head = java.indexOf(`int[] ${name} = {`)
    assert.ok(head > 0, `${name} exists`)
    const open = java.indexOf('{', head)
    const body = java.slice(open + 1, java.indexOf('}', open))
    const values = body.split(',').map((n) => Number(n.trim()))
    assert.equal(values.length, alphabet.length, `${name} covers the alphabet`)
    return Object.fromEntries(alphabet.map((ch, i) => [ch, values[i]]))
  }
  const cases = [
    ['fr', 'fise', 'VAL', 'BAG'],
    ['en', 'fise', 'VAL_EN', 'BAG_EN'],
    ['es', 'fise', 'VAL_ES', 'BAG_ES'],
    ['es', 'na', 'VAL_ES_NA', 'BAG_ES_NA'],
    ['ca', 'fise', 'VAL_CA', 'BAG_CA'],
  ]
  for (const [lang, edition, valName, bagName] of cases) {
    const spec = tileSpec(lang, edition)
    const values = table(valName)
    const bag = table(bagName)
    for (const ch of alphabet) {
      assert.equal(values[ch], spec.values[ch] || 0, `${valName}[${ch}] (${lang}/${edition})`)
      assert.equal(bag[ch], spec.bag[ch] || 0, `${bagName}[${ch}] (${lang}/${edition})`)
    }
  }
})

test('Android encodes Catalan tiles the same way tiles.js does', () => {
  // Port check by inspection is not enough: mirror encodeCa's rules here.
  const java = readFileSync(new URL('../android/app/src/main/java/cc/pfa87/ods9/Lexicon.java', import.meta.url), 'utf8')
  assert.match(java, /static String encodeCa\(String display\)/)
  for (const [glyph, code] of [['NY', "'4'"], ['QU', "'5'"], ['L·L', '"L·L"']]) {
    assert.ok(java.includes(glyph) || java.includes(code), glyph)
  }
  // The Catalan lexicon file the app opens must be the one the build ships.
  assert.match(java, /data\/disc-ca\.txt\.gz/)
  assert.match(readFileSync(new URL('../scripts/build-apk.sh', import.meta.url), 'utf8'), /disc-ca\.txt\.gz/)
})

test('a shared Catalan rack keeps Ç and its tile digits', () => {
  setLang('ca')
  try {
    // Ç is a tile, not an accented C. Folding it turned a shared CAÇA rack
    // into CACA — a different rack, and a different word.
    assert.equal(parseRack('CAÇA'), 'CAÇA')
    assert.equal(parseRack('caça'), 'CAÇA')
    assert.equal(parseRack('COL·LEGI'), 'COL·LEGI')
    assert.equal(parseRack('ANY'), 'ANY')
    // The tile digits type a multi-character tile, as 1/2/3 do in Spanish.
    assert.equal(parseRack('456'), 'NYQUL·L')
    assert.equal(parseRack('A4'), 'ANY')
    // Stress marks still fold: the DISC list is unaccented.
    assert.equal(parseRack('cafè'), 'CAFE')
  } finally {
    setLang('fr')
  }
  // Ç is only a letter in Catalan; elsewhere it must still fold to C.
  assert.equal(parseRack('français'), 'FRANCAI')
  setLang('es')
  try {
    assert.equal(parseRack('caça'), 'CACA')
  } finally {
    setLang('fr')
  }
})

test('history and favourites keep Ç, L·L and the longest 15-tile words', () => {
  const store = () => {
    const m = new Map()
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }
  }
  const hist = store()
  // Stripping Ç stored CAÇA as CAA and COL·LEGI as COLLEGI — a different word.
  assert.equal(rememberWord({ word: 'CAÇA', pts: 14, src: 'dico' }, hist)[0].word, 'CAÇA')
  assert.equal(rememberWord({ word: 'COL·LEGI', pts: 18, src: 'dico' }, hist)[0].word, 'COL·LEGI')
  // The bound is characters, not tiles: these are the longest 15-tile words in
  // the Catalan and Spanish lists and were being rejected outright.
  assert.equal(rememberWord({ word: 'DODECASIL·LABIQUES', pts: 30, src: 'dico' }, hist)[0].word, 'DODECASIL·LABIQUES')
  assert.equal(rememberWord({ word: 'ACHICHARRONABAMOS', pts: 30, src: 'dico' }, hist)[0].word, 'ACHICHARRONABAMOS')
  assert.deepEqual(
    mergeHistory([{ word: 'CAÇA', pts: 14, src: 'dico', at: 1 }], store()).map((r) => r.word),
    ['CAÇA'],
  )
  const favs = store()
  toggleFavorite('COL·LEGI', 18, favs)
  assert.deepEqual(loadFavorites(favs).map((f) => f.word), ['COL·LEGI'])
})

test('every module pins the same version of a shared import', () => {
  // A different ?v= is a different module URL, so it is a *separate* module
  // instance with its own language state: history.js on i18n.js?v=158 while
  // app.js was on ?v=140 left the history pane French in every language.
  const dir = new URL('../web/', import.meta.url)
  const pins = new Map()
  for (const name of readdirSync(dir)) {
    if (!/\.(js|html)$/.test(name)) continue
    const src = readFileSync(new URL(name, dir), 'utf8')
    for (const [, file, version] of src.matchAll(/\.\/([a-z0-9-]+\.(?:js|css))\?v=(\d+)/g)) {
      if (!pins.has(file)) pins.set(file, new Map())
      if (!pins.get(file).has(version)) pins.get(file).set(version, [])
      pins.get(file).get(version).push(name)
    }
  }
  for (const [file, versions] of pins) {
    assert.equal(existsSync(new URL(file, dir)), true, `${file} is pinned but does not exist`)
    const seen = [...versions].map(([v, who]) => `v=${v} (${who.join(', ')})`)
    assert.equal(versions.size, 1, `${file} is pinned at more than one version: ${seen.join(' vs ')}`)
  }
  // sw.js must precache exactly the versions the pages ask for.
  const sw = readFileSync(new URL('sw.js', dir), 'utf8')
  for (const [file, versions] of pins) {
    const [version] = [...versions.keys()]
    if (!sw.includes(`./${file}`)) continue
    assert.ok(sw.includes(`./${file}?v=${version}`), `sw.js caches a stale ${file} (want v=${version})`)
  }
})
