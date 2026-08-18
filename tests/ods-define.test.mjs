import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanWikitext, extractSenses, rankTitles } from '../scripts/ods-define.mjs'

test('cleanWikitext strips links and keeps useful labels', () => {
  const text = cleanWikitext("{{en particulier}} [[établissement|Établissement]] où l’on [[enseigner|enseigne]].")
  assert.match(text, /Établissement/)
  assert.match(text, /enseigne/)
  assert.match(text, /en particulier/i)
  assert.doesNotMatch(text, /\[\[/)
})

test('extractSenses reads French noun definitions and skips etymology', () => {
  const wiki = `{{voir|écolé}}

== {{langue|en}} ==
=== {{S|nom|en}} ===
# English school.

== {{langue|fr}} ==
=== {{S|étymologie}} ===
: Du latin.

=== {{S|nom|fr}} ===
'''école''' {{pron|e.kɔl|fr}} {{f}}
# [[lieu|Lieu]] [[dédier|dédié]] à l’[[apprentissage]].
#* {{exemple | lang=fr | phrase d'exemple }}
# {{en particulier}} [[établissement|Établissement]] d'enseignement.

=== {{S|anagrammes}} ===
* [[côlée]]

== {{langue|it}} ==
=== {{S|nom|it}} ===
# scuola.
`
  const senses = extractSenses(wiki)
  assert.equal(senses.length, 1)
  assert.equal(senses[0].pos, 'nom')
  assert.equal(senses[0].defs.length, 2)
  assert.match(senses[0].defs[0], /Lieu/)
  assert.match(senses[0].defs[1], /Établissement/)
  assert.doesNotMatch(senses[0].defs.join(' '), /English|scuola|exemple/)
})

test('extractEnglishSenses reads English noun senses', () => {
  const wiki = `==English==
===Etymology===
From old stuff.

===Noun===
{{en-noun}}
# A [[small]] [[animal]].
# {{lb|en|slang}} A [[person]].

===Anagrams===
* [[foo]]

==French==
===Noun===
# pas ça
`
  const senses = extractSenses(wiki, 'en')
  assert.equal(senses.length, 1)
  assert.equal(senses[0].pos, 'noun')
  assert.equal(senses[0].defs.length, 2)
  assert.match(senses[0].defs[0], /animal/)
  assert.match(senses[0].defs[1], /person/)
  assert.doesNotMatch(senses[0].defs.join(' '), /pas ça|old stuff/)
})

test('cleanWikitext expands English plural-of templates', () => {
  assert.match(cleanWikitext('{{plural of|en|keum}}'), /Plural of keum/)
})

test('rankTitles prefers the accented French lemma over a typo page', () => {
  const ranked = rankTitles('ECOLE', ['Ecole', 'école', 'écolé', 'School'])
  assert.equal(ranked[0], 'école')
})

test('rankTitles prefers QI the abbreviation over qi the energy', () => {
  assert.equal(rankTitles('QI', ['QI', 'qi', 'Qi'])[0], 'QI')
})

test('rankTitles keeps French rut ahead of Vietnamese lookalikes', () => {
  const ranked = rankTitles('RUT', ['RUT', 'Rut', 'rut', 'Rút', 'rứt', 'rút', 'rụt', 'ruts'])
  assert.ok(ranked.indexOf('rut') >= 0 && ranked.indexOf('rut') < 3)
  assert.ok(ranked.indexOf('rut') < ranked.indexOf('rứt'))
})
