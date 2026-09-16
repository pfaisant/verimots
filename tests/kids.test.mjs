import test from 'node:test'
import assert from 'node:assert/strict'
import { dealKids, kidsAnagrams, kidsWords, kidsLong } from '../web/kids.js'
import { loadKidsFound, rememberKidsFound } from '../web/game.js'
import { tileCount } from '../web/tiles.js'
import { readFileSync } from 'node:fs'

const HARD = /[JKÑQWXYZ]/

test('kids short words avoid hard letters; long easy words may include them', () => {
  for (const lang of ['fr', 'en', 'es']) {
    const words = kidsWords(lang)
    const longs = kidsLong(lang)
    assert.ok(words.length > 80)
    assert.ok(longs.length > 8)
    for (const w of longs) assert.match(w, /^[A-ZÑ]{6,8}$/)
    for (const w of words) {
      assert.match(w, /^[A-ZÑ]{3,8}$/)
      if (w.length <= 5) assert.equal(HARD.test(w), false)
    }
  }
  assert.ok(kidsLong('fr').includes('CHEVAUX'))
  assert.ok(kidsLong('en').includes('HORSES'))
  assert.ok(kidsLong('es').includes('CABALLO'))
  assert.ok(kidsWords('en').includes('PIP'))
})

test('a kids deal always includes an easy long word', () => {
  for (const lang of ['fr', 'en', 'es']) {
    const d = dealKids(lang)
    assert.equal(d.category, 'kids')
    assert.ok(d.rack.length >= 6 && d.rack.length <= 8)
    assert.ok(kidsLong(lang).includes(d.seed))
    const plays = kidsAnagrams(d.rack, lang).flatMap((g) => g.words)
    assert.ok(plays.some((p) => p.word === d.seed))
  }
  const chevaux = dealKids('fr', () => 0)
  assert.equal(chevaux.seed, 'CHEVAUX')
  assert.equal(chevaux.rack.length, 7)
  const next = dealKids('fr', () => 0, chevaux.seed)
  assert.notEqual(next.seed, chevaux.seed)
  const animales = kidsAnagrams('ANIMALES', 'es').flatMap((g) => g.words)
  assert.ok(animales.some((p) => p.word === 'ANIMALES'))
})

test('kids anagrams ignore adult-only forms', () => {
  const groups = kidsAnagrams('CHAT', 'fr')
  const words = groups.flatMap((g) => g.words.map((w) => w.word))
  assert.ok(words.includes('CHAT'))
  assert.equal(words.includes('TACH'), false)
})

test('kids found counter increments locally', () => {
  const mem = {
    data: null,
    getItem() {
      return this.data
    },
    setItem(_k, v) {
      this.data = v
    },
  }
  assert.equal(loadKidsFound(mem), 0)
  assert.equal(rememberKidsFound(mem), 1)
  assert.equal(rememberKidsFound(mem), 2)
  assert.equal(loadKidsFound(mem), 2)
})

test('Catalan beginner words are tile-clean and always playable', () => {
  const words = kidsWords('ca')
  const longs = kidsLong('ca')
  assert.ok(words.length > 150, `${words.length} short Catalan words`)
  assert.ok(longs.length > 40, `${longs.length} long Catalan words`)
  // Short racks stay easy: no Ç, J, X, Z, and no NY/QU/L·L tile.
  for (const w of words) {
    if (tileCount(w, 'ca') <= 5) assert.equal(/[JÇXZ]|NY|QU|L·L/.test(w), false, w)
  }
  for (const w of longs) {
    const n = tileCount(w, 'ca')
    assert.ok(n >= 6 && n <= 8, `${w} is ${n} tiles`)
  }
  assert.ok(longs.includes('CAVALL'))
  // The geminate seed exercises the three-character tile end to end.
  assert.ok(longs.includes('COL·LEGI'))
  const deal = dealKids('ca')
  assert.equal(deal.category, 'kids')
  assert.ok(longs.includes(deal.seed), deal.seed)
  const plays = kidsAnagrams(deal.rack, 'ca').flatMap((g) => g.words)
  assert.ok(plays.some((p) => p.word === deal.seed), `${deal.rack} plays ${deal.seed}`)
  assert.equal(tileCount(deal.rack, 'ca'), tileCount(deal.seed, 'ca'))
})

test('Android beginner pools match web/kids.js word for word', () => {
  const java = readFileSync(new URL('../android/app/src/main/java/cc/pfa87/ods9/Kids.java', import.meta.url), 'utf8')
  const block = (name) => {
    const head = java.indexOf(`String[] ${name} = `)
    assert.ok(head > 0, `${name} exists`)
    const body = java.slice(java.indexOf('\n', head), java.indexOf(';', head))
    return body.match(/"[^"]*"/g).flatMap((chunk) => chunk.slice(1, -1).trim().split(/\s+/)).filter(Boolean)
  }
  for (const [lang, shortName, longName] of [
    ['fr', 'FR_SHORT', 'FR_LONG'],
    ['en', 'EN_SHORT', 'EN_LONG'],
    ['es', 'ES_SHORT', 'ES_LONG'],
    ['ca', 'CA_SHORT', 'CA_LONG'],
  ]) {
    const longs = kidsLong(lang)
    const shorts = kidsWords(lang).filter((w) => !longs.includes(w))
    // Java filters its short pool for hard letters at read time, so compare
    // the sets the two platforms actually deal from.
    assert.deepEqual(new Set(block(longName)), new Set(longs), `${longName} vs kidsLong('${lang}')`)
    const javaShorts = new Set(block(shortName).filter((w) => !/[JKÑQWXYZ]/.test(w)))
    for (const w of shorts) assert.ok(javaShorts.has(w), `${shortName} is missing ${w}`)
  }
})
