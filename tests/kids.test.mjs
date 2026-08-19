import test from 'node:test'
import assert from 'node:assert/strict'
import { dealKids, kidsAnagrams, kidsWords, kidsLong } from '../dashboard/s/kids.js'
import { loadKidsFound, rememberKidsFound } from '../dashboard/s/game.js'

const HARD = /[JKQWXYZ]/

test('kids short words avoid hard letters; long easy words may include them', () => {
  for (const lang of ['fr', 'en']) {
    const words = kidsWords(lang)
    const longs = kidsLong(lang)
    assert.ok(words.length > 80)
    assert.ok(longs.length > 8)
    for (const w of longs) assert.match(w, /^[A-Z]{6,7}$/)
    for (const w of words) {
      assert.match(w, /^[A-Z]{3,7}$/)
      if (w.length <= 5) assert.equal(HARD.test(w), false)
    }
  }
  assert.ok(kidsLong('fr').includes('CHEVAUX'))
  assert.ok(kidsLong('en').includes('HORSES'))
  assert.ok(kidsWords('en').includes('PIP'))
})

test('a kids deal always includes an easy long word', () => {
  for (const lang of ['fr', 'en']) {
    const d = dealKids(lang)
    assert.equal(d.category, 'kids')
    assert.ok(d.rack.length === 6 || d.rack.length === 7)
    assert.ok(kidsLong(lang).includes(d.seed))
    const plays = kidsAnagrams(d.rack, lang).flatMap((g) => g.words)
    assert.ok(plays.some((p) => p.word === d.seed))
  }
  const chevaux = dealKids('fr', () => 0)
  assert.equal(chevaux.seed, 'CHEVAUX')
  assert.equal(chevaux.rack.length, 7)
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
