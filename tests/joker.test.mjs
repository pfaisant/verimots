// The joker tile: which letters a blank may become, how the rack highlight
// follows the player's choice, and that the choice never earns points.
import test from 'node:test'
import assert from 'node:assert/strict'

import { blankTargets, isBlankTile, tileGlyph } from '../web/tiles.js'
import { usedTiles, blankIndexes, letterScore, parseRack } from '../web/game.js'

test('a blank may only become a tile the bag actually holds', () => {
  const fr = blankTargets('fr')
  assert.equal(fr.length, 26)
  assert.ok(!fr.includes('Ñ'), 'the French bag has no Ñ')

  const en = blankTargets('en')
  assert.ok(en.includes('W') && en.includes('K'))
})

test('FISE blanks cannot stand for K or W, and can stand for CH/LL/RR', () => {
  const fise = blankTargets('es', 'fise')
  assert.ok(!fise.includes('K'), 'no K tile in the international set')
  assert.ok(!fise.includes('W'), 'no W tile in the international set')
  assert.deepEqual(
    ['1', '2', '3'].filter((c) => fise.includes(c)).map(tileGlyph),
    ['CH', 'LL', 'RR']
  )
  assert.ok(fise.includes('Ñ'))
})

test('the North-American set adds K and W but drops the CH tile', () => {
  const na = blankTargets('es', 'na')
  assert.ok(na.includes('K') && na.includes('W'))
  assert.ok(!na.includes('1'), 'no CH tile in the North-American set')
  assert.ok(na.includes('2') && na.includes('3'))
})

test('blankIndexes finds the jokers in a rack', () => {
  assert.deepEqual(blankIndexes('AB?DE'), [2])
  assert.deepEqual(blankIndexes('?A?'), [0, 2])
  assert.deepEqual(blankIndexes('ABCDE'), [])
  assert.ok(isBlankTile('?') && !isBlankTile('A'))
})

test('real tiles take priority over a picker choice, matching the score solver', () => {
  const picks = new Map([[0, 'B']])
  assert.deepEqual([...usedTiles('?ABEIN', 'BIEN', picks)].sort((a, b) => a - b), [2, 3, 4, 5])
  assert.equal(letterScore('BIEN', 'fr'), 6)
})

test('two blanks are each used once and a missing letter can keep its chosen blank', () => {
  assert.deepEqual([...usedTiles('A??', 'ABC', new Map([[2, 'B'], [1, 'C']]))].sort(), [0, 1, 2])
  assert.deepEqual([...usedTiles('A??', 'AA', new Map([[2, 'A']]))].sort(), [0, 2])
})

test('Catalan blanks include Ç, NY, QU and L·L but exclude K, W and Y', () => {
  const ca = blankTargets('ca')
  for (const code of ['Ç', '4', '5', '6']) assert.ok(ca.includes(code))
  for (const code of ['K', 'W', 'Y', 'Q']) assert.ok(!ca.includes(code))
})

test('a pick for a letter the word does not use is ignored', () => {
  const picks = new Map([[0, 'Z']])
  assert.deepEqual([...usedTiles('?ABEIN', 'BIEN', picks)].sort((a, b) => a - b), [2, 3, 4, 5])
})

test('a pick on a tile that is not a blank is ignored', () => {
  const picks = new Map([[1, 'B']])
  assert.deepEqual([...usedTiles('?ABEIN', 'BIEN', picks)].sort((a, b) => a - b), [2, 3, 4, 5])
})

test('unmatched letters still fall back to a blank without any pick', () => {
  assert.deepEqual([...usedTiles('A?O', 'AÑO')].sort((a, b) => a - b), [0, 1, 2])
  assert.deepEqual([...usedTiles('AA?', 'ABA')].sort((a, b) => a - b), [0, 1, 2])
})

test('whatever letter the joker becomes, it scores 0', () => {
  assert.equal(letterScore('BIEN', 'fr'), 6)
  assert.equal(letterScore('BIEN', 'fr', [0]), 3, 'the B is on a joker')
  // Z is worth 10 in French — on a joker it is still worth nothing.
  assert.equal(letterScore('ZEBU', 'fr'), 15)
  assert.equal(letterScore('ZEBU', 'fr', [0]), 5)
})

test('a shared rack keeps its blanks instead of silently dropping them', () => {
  assert.equal(parseRack('A??EINS'), 'A??EINS')
})
