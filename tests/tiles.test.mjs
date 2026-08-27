import test from 'node:test'
import assert from 'node:assert/strict'
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
import { setLang, t } from '../web/i18n.js?v=131'
import { letterScore, playPoints, playScore, parseRack, usedTiles } from '../web/game.js'
import { kidsAnagrams, dealKids } from '../web/kids.js'
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

test('official bags: FISE has 100 tiles, North America 103', () => {
  const sum = (bag) => Object.values(bag).reduce((a, b) => a + b, 0)
  assert.equal(sum(tileSpec('es', 'fise').bag) + 2, 100)
  assert.equal(sum(tileSpec('es', 'na').bag) + 2, 103)
  assert.equal(sum(tileSpec('fr').bag) + 2, 102)
  assert.equal(sum(tileSpec('en').bag) + 2, 100)
  // No K/W tiles internationally; CH only exists internationally.
  assert.equal(tileSpec('es', 'fise').bag.K, undefined)
  assert.equal(tileSpec('es', 'na').bag.K, 1)
  assert.equal(tileSpec('es', 'fise').bag['1'], 1)
  assert.equal(tileSpec('es', 'na').bag['1'], undefined)
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

test('edition strings exist in all three languages', () => {
  for (const lang of ['fr', 'en', 'es']) {
    setLang(lang)
    assert.notEqual(t('es_edition_fise'), 'es_edition_fise')
    assert.notEqual(t('es_edition_na'), 'es_edition_na')
    assert.notEqual(t('unplayable_kw'), 'unplayable_kw')
  }
  setLang('fr')
})
