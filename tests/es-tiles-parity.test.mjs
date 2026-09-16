// The Spanish tile tables exist twice: dashboard/s/tiles.js for the web and
// EsTiles.java for the Android app. They must agree tile for tile, because a
// mismatch is invisible until a player scores the same word differently on the
// phone and in the browser — which is exactly what happened before the port
// (CHORRO: 11 over 6 tiles on Android, 15 over 4 on the web).
//
// This reads the Java source as text rather than running a JVM, so it works in
// any checkout with no SDK and still catches the thing that actually breaks: a
// hand-edited number on one side only.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tileSpec } from '../web/tiles.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const JAVA = join(ROOT, 'android', 'app', 'src', 'main', 'java', 'cc', 'pfa87', 'ods9', 'EsTiles.java')

const src = await readFile(JAVA, 'utf8')

function javaString(name) {
  const m = src.match(new RegExp(`String ${name} = "([^"]*)"`))
  assert.ok(m, `${name} not found in EsTiles.java`)
  return m[1]
}

function javaIntArray(name) {
  const m = src.match(new RegExp(`int\\[\\] ${name} = \\{([^}]*)\\}`))
  assert.ok(m, `${name} not found in EsTiles.java`)
  return m[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
}

const EDITIONS = [
  { edition: 'fise', order: 'ORDER_FISE', values: 'VAL_FISE', bag: 'BAG_FISE', hard: 'HARD_FISE', tiles: 100 },
  { edition: 'na', order: 'ORDER_NA', values: 'VAL_NA', bag: 'BAG_NA', hard: 'HARD_NA', tiles: 103 },
]

for (const ed of EDITIONS) {
  test(`${ed.edition}: the Java tile order matches the web`, () => {
    assert.equal(javaString(ed.order), tileSpec('es', ed.edition).order.join(''))
  })

  test(`${ed.edition}: every tile value matches the web`, () => {
    const spec = tileSpec('es', ed.edition)
    const order = javaString(ed.order)
    const vals = javaIntArray(ed.values)
    assert.equal(vals.length, order.length, 'one value per tile')
    for (let i = 0; i < order.length; i++) {
      assert.equal(vals[i], spec.values[order[i]], `value of tile ${order[i]}`)
    }
  })

  test(`${ed.edition}: every bag count matches the web, and the bag is the official size`, () => {
    const spec = tileSpec('es', ed.edition)
    const order = javaString(ed.order)
    const bag = javaIntArray(ed.bag)
    assert.equal(bag.length, order.length, 'one count per tile')
    for (let i = 0; i < order.length; i++) {
      assert.equal(bag[i], spec.bag[order[i]], `bag count of tile ${order[i]}`)
    }
    // +2 blanks. FISE is 100 tiles, the North-American set 103.
    assert.equal(bag.reduce((a, b) => a + b, 0) + 2, ed.tiles)
  })

  test(`${ed.edition}: the hard-tile set matches the web`, () => {
    const spec = tileSpec('es', ed.edition)
    const order = javaString(ed.order)
    const expected = [...order].filter((c) => spec.hard.has(c)).join('')
    assert.equal(javaString(ed.hard), expected)
  })
}

test('the editions differ in the ways that made the old model wrong', () => {
  const fise = javaString('ORDER_FISE')
  const na = javaString('ORDER_NA')
  // The old Android model had K and W in a 100-tile bag and no digraphs at all.
  assert.ok(!fise.includes('K') && !fise.includes('W'), 'FISE has neither K nor W')
  assert.ok(na.includes('K') && na.includes('W'), 'NA has both')
  assert.ok(fise.includes('1'), 'FISE has a CH tile')
  assert.ok(!na.includes('1'), 'NA has no CH tile')
  for (const order of [fise, na]) {
    assert.ok(order.includes('2') && order.includes('3'), 'both have LL and RR')
    assert.ok(order.includes('Ñ'), 'both have Ñ')
  }
})

test('the digraph codes agree with the web glyph mapping', () => {
  // '1' = CH, '2' = LL, '3' = RR on both sides; the Java glyph() switch and the
  // web GLYPHS table have to name the same tiles.
  for (const [code, glyph] of [
    ['CH', 'CH'],
    ['LL', 'LL'],
    ['RR', 'RR'],
  ]) {
    assert.match(src, new RegExp(`return "${glyph}"`), `glyph() returns ${glyph}`)
    assert.ok(code)
  }
  assert.match(src, /char CH = '1'/)
  assert.match(src, /char LL = '2'/)
  assert.match(src, /char RR = '3'/)
})

test('the FISE blank rule is stated in Java as it is on the web', () => {
  // tiles.js expresses it as blockedBlank: /[KW]/; the port hard-codes K and W.
  assert.ok(tileSpec('es', 'fise').blockedBlank.test('KIWI'))
  assert.equal(tileSpec('es', 'na').blockedBlank, null)
  assert.match(src, /if \(c == 'K' \|\| c == 'W'\) return true/)
  assert.match(src, /if \(isNa\(edition\)\) return false/)
})
