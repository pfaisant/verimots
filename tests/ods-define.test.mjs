import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanWikitext, extractSenses, rankTitles, lookupQuery } from '../scripts/ods-define.mjs'

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

test('extractEnglishSenses skips numbered "Etymology 1" headings', () => {
  // Regression: Wiktionary numbers repeated sections, so "Etymology 1" leaked
  // in as a fake part of speech that swallowed the noun's definitions — the
  // app then showed a definition under an ETYMOLOGY label.
  const wiki = `==English==
===Etymology 1===
From Middle English male ("a bag").

===Noun===
{{en-noun}}
# {{lb|en|now|_|regional}} A [[bag]] or [[wallet]].

===Etymology 2===
See {{m|en|mail}} above.

===Noun===
# Armoured clothing.
`
  const senses = extractSenses(wiki, 'en')
  assert.equal(senses.length, 2)
  assert.deepEqual(senses.map((s) => s.pos), ['noun', 'noun'])
  assert.match(senses[0].defs[0], /bag/)
  assert.doesNotMatch(senses.map((s) => s.pos).join(' '), /etymology/)
})

test('extractSenses reads Spanish numbered definitions and preserves Ñ', () => {
  const wiki = `== {{lengua|es}} ==
=== Etimología ===
Del latín.
=== Sustantivo masculino ===
;1: Periodo de doce [[mes]]es.
;2: {{ámbito|España}} Curso escolar.
=== Traducciones ===
* English: year
== {{lengua|fr}} ==
=== {{S|nom|fr}} ===
# autre langue
`
  const senses = extractSenses(wiki, 'es')
  assert.equal(senses.length, 1)
  assert.equal(senses[0].pos, 'sustantivo masculino')
  assert.equal(senses[0].defs.length, 2)
  assert.match(senses[0].defs[0], /doce meses/)
  assert.doesNotMatch(senses[0].defs.join(' '), /autre langue|Del latín/)
  assert.equal(lookupQuery('AÑO', 'es'), 'año')
  assert.equal(lookupQuery('CAMIÓN', 'es'), 'camion')
  assert.equal(rankTitles('AÑO', ['ano', 'año', 'Año'], 'es')[0], 'año')
})

test('extractSenses reads live-style Spanish template headings', () => {
  const wiki = `== {{lengua|es}} ==
=== Etimología 1 ===
==== {{sustantivo masculino|es}} ====
;1: Intervalo de [[tiempo]] que tarda la Tierra alrededor del Sol.
;2: Periodo entre fechas de un calendario.
==== Traducciones ====
* English: year
== {{lengua|an}} ==
==== {{sustantivo masculino|an}} ====
;1: otra lengua
`
  const senses = extractSenses(wiki, 'es')
  assert.equal(senses.length, 1)
  assert.equal(senses[0].pos, 'sustantivo masculino')
  assert.deepEqual(senses[0].defs, [
    'Intervalo de tiempo que tarda la Tierra alrededor del Sol.',
    'Periodo entre fechas de un calendario.',
  ])
})

test('extractSenses expands Spanish form templates without punctuation-only definitions', () => {
  const verb = extractSenses(`== {{lengua|es}} ==
=== Forma verbal ===
;1: {{forma verbo|comer|p=3p|t=pret ind|m=indicativo|pronominal=s}}.
`, 'es')
  const noun = extractSenses(`== {{lengua|es}} ==
=== Forma sustantiva ===
;1: {{forma sustantivo plural|niña}}.
`, 'es')
  assert.equal(verb[0].defs[0], 'Forma de comer.')
  assert.equal(noun[0].defs[0], 'Plural de niña.')
})

test('cleanWikitext expands English plural-of templates', () => {
  assert.match(cleanWikitext('{{plural of|en|keum}}'), /Plural of keum/)
})

test('rankTitles prefers the accented French lemma over a typo page', () => {
  const ranked = rankTitles('ECOLE', ['Ecole', 'école', 'écolé', 'School'])
  assert.equal(ranked[0], 'école')
})

test('rankTitles maps a hyphenated compound to the last segment', () => {
  const ranked = rankTitles('faires', ['faires', 'faire', 'savoir-faires', 'affaires'])
  assert.ok(ranked.indexOf('savoir-faires') < ranked.indexOf('faire'))
  assert.ok(ranked.indexOf('savoir-faires') < ranked.indexOf('affaires'))
})

test('lookupQuery keeps hyphens for Wiktionary titles', () => {
  assert.equal(lookupQuery('savoir-faire'), 'savoir-faire')
  assert.equal(lookupQuery('SAVOIR-FAIRES'), 'savoir-faires')
  assert.equal(lookupQuery('FAIRES'), 'faires')
})

test('rankTitles prefers QI the abbreviation over qi the energy', () => {
  assert.equal(rankTitles('QI', ['QI', 'qi', 'Qi'])[0], 'QI')
})

test('rankTitles keeps French rut ahead of Vietnamese lookalikes', () => {
  const ranked = rankTitles('RUT', ['RUT', 'Rut', 'rut', 'Rút', 'rứt', 'rút', 'rụt', 'ruts'])
  assert.ok(ranked.indexOf('rut') >= 0 && ranked.indexOf('rut') < 3)
  assert.ok(ranked.indexOf('rut') < ranked.indexOf('rứt'))
})
