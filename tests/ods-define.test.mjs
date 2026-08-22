import test from 'node:test'
import assert from 'node:assert/strict'
import { adjectiveFromParticiple, cleanWikitext, extractSenses, isJunkDef, lemmaFromInflection, rankTitles, lookupQuery, senseKind, voirTitles } from '../scripts/ods-define.mjs'

test('cleanWikitext drops Wiktionary label separators', () => {
  const text = cleanWikitext('{{lb|en|now|_|regional}} A [[bag]] or [[wallet]].')
  assert.match(text, /A bag or wallet/)
  assert.match(text, /\(now\)/)
  assert.match(text, /\(regional\)/)
  assert.doesNotMatch(text, /\(_\)/)
})

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
  assert.doesNotMatch(senses[0].defs[0], /\(_\)/)
  assert.match(senses[0].defs[0], /\(now\).*\(regional\)/)
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

test('cleanWikitext keeps French spelling-variant and domain templates', () => {
  const text = cleanWikitext('# {{instruments à vent|fr}} {{variante ortho de|ney}}')
  assert.match(text, /instruments à vent/i)
  assert.match(text, /Variante orthographique de ney/)
})

test('extractSenses reads nay as the flute, not an empty proper-noun miss', () => {
  const wiki = `== {{langue|fr}} ==
=== {{S|étymologie}} ===
: De l’arabe.

=== {{S|nom|fr}} ===
{{fr-rég|ne}}
'''nay''' {{pron|ne|fr}} {{m}}
# {{instruments à vent|fr}} {{variante ortho de|ney}}
#* {{exemple | lang=fr | Sa chaise l’attendait entre Sami et Fouad. | source=Kattan}}
`
  const senses = extractSenses(wiki)
  assert.equal(senses.length, 1)
  assert.equal(senses[0].pos, 'nom')
  assert.match(senses[0].defs[0], /Variante orthographique de ney/)
  assert.match(senses[0].defs[0], /instruments à vent/i)
})

test('extractSenses skips French proper nouns like NAY', () => {
  const wiki = `== {{langue|fr}} ==
=== {{S|nom propre|fr}} ===
'''Nay'''
# [[commune|Commune]] des [[Pyrénées-Atlantiques]].

=== {{S|nom|fr}} ===
# Variante de [[nai]].
`
  const senses = extractSenses(wiki)
  assert.equal(senses.length, 1)
  assert.equal(senses[0].pos, 'nom')
  assert.match(senses[0].defs[0], /nai/)
  assert.doesNotMatch(senses.map((s) => s.pos).join(' '), /propre/)
})

test('extractSenses drops a word that is only a proper noun', () => {
  const wiki = `== {{langue|fr}} ==
=== {{S|nom propre|fr}} ===
# Ville du Béarn.
`
  assert.deepEqual(extractSenses(wiki), [])
})

test('extractEnglishSenses reads ====Noun==== under English and skips Translingual', () => {
  const wiki = `==Translingual==
===Etymology 1===
====Symbol====
# {{SI-unit-abb2|deca|meter|metre|length}}
===Etymology 2===
====Symbol====
# {{ISO 639|3}}
==English==
===Pronunciation===
===Etymology 1===
====Noun====
{{en-noun}}
# A [[structure]] placed across a flowing body of water.
# The water [[reservoir]] resulting from placing such a structure.
====Verb====
# To block the flow of water.
=====Derived terms=====
* beaver dam
===Anagrams===
==Afrikaans==
===Noun===
# other language
`
  const senses = extractSenses(wiki, 'en')
  assert.deepEqual(senses.map((s) => s.pos), ['noun', 'verb'])
  assert.match(senses[0].defs[0], /structure/)
  assert.match(senses[0].defs[1], /reservoir/)
  assert.match(senses[1].defs[0], /block/)
  assert.doesNotMatch(senses.flatMap((s) => s.defs).join(' '), /meter|ISO|other language|deca/i)
})

test('rankTitles prefers English dam over DAM the acronym', () => {
  assert.equal(rankTitles('dam', ['Dam', 'DAM', 'dam'], 'en')[0], 'dam')
})

test('voirTitles reads {{voir|…}} and ignores {{voir/…}}', () => {
  assert.deepEqual(voirTitles('{{voir|adirés}}\n{{voir/aimes}}\n{{voir|foo|bar}}'), ['adirés', 'foo'])
})

test('senseKind tells finite verb flexions from past participles', () => {
  assert.equal(
    senseKind([{ pos: 'verbe', defs: ['Deuxième personne du singulier du présent de l’indicatif de adirer.'] }]),
    'finite',
  )
  assert.equal(
    senseKind([{ pos: 'verbe', defs: ['Participe passé masculin pluriel de adirer.'] }]),
    'participle',
  )
  assert.equal(
    senseKind([{ pos: 'nom', defs: ['Lieu dédié à l’apprentissage.'] }]),
    'lexical',
  )
})

test('ADIRES follows the accented participle and becomes an adjective', () => {
  const finite = extractSenses(`{{voir|adirés}}
== {{langue|fr}} ==
=== {{S|verbe|fr|flexion}} ===
# ''Deuxième personne du singulier du présent de l’indicatif de'' [[adirer]].
# ''Deuxième personne du singulier du présent du subjonctif de'' [[adirer]].
`)
  assert.equal(senseKind(finite), 'finite')
  assert.equal(lemmaFromInflection(finite[0].defs), 'adirer')

  const participle = extractSenses(`{{voir|adires}}
== {{langue|fr}} ==
=== {{S|verbe|fr|flexion}} ===
# ''Participe passé masculin pluriel de'' [[adirer]].
`)
  assert.equal(senseKind(participle), 'participle')
  assert.equal(lemmaFromInflection(participle[0].defs), 'adirer')

  const lemma = extractSenses(`== {{langue|fr}} ==
=== {{S|verbe|fr}} ===
# {{lexique|droit|fr}} {{vieilli|fr}} Perdre, [[égarer]] (spécialement en parlant d’un document juridique).
`)
  const promoted = adjectiveFromParticiple(participle, lemma)
  assert.equal(promoted[0].pos, 'adjectif')
  assert.match(promoted[0].defs[0], /égarer/)
  assert.doesNotMatch(promoted[0].defs.join(' '), /personne du|indicatif/i)
})

test('cleanWikitext strips comments, {{e}} and info-lex leftover junk', () => {
  assert.equal(cleanWikitext('1{{e}} personne <!-- hidden -->du verbe'), '1e personne du verbe')
  assert.match(cleanWikitext('{{info lex|musique}} Instrument à vent.'), /\(musique\)/)
  assert.match(cleanWikitext('{{info lex|musique}} Instrument à vent.'), /Instrument à vent/)
  assert.equal(isJunkDef(''), true)
  assert.equal(isJunkDef('()'), true)
  assert.equal(isJunkDef('.'), true)
  assert.equal(isJunkDef('(rare)'), true)
  assert.equal(isJunkDef('(rare) Établissement scolaire.'), false)
})

test('extractSenses drops punctuation-only leftover definitions', () => {
  const senses = extractSenses(`== {{langue|fr}} ==
=== {{S|nom|fr}} ===
# {{siècle|xxie}}
# Lieu dédié à l’apprentissage.
`)
  assert.equal(senses[0].defs.length, 1)
  assert.match(senses[0].defs[0], /Lieu/)
})

test('variante and English form-of glosses are inflections with a lemma', () => {
  assert.equal(
    senseKind([{ pos: 'nom', defs: ['(instruments à vent) Variante orthographique de ney'] }]),
    'inflection',
  )
  assert.equal(lemmaFromInflection(['(instruments à vent) Variante orthographique de ney']), 'ney')
  assert.equal(
    senseKind([{ pos: 'noun', defs: ['Inflection of eat'] }]),
    'inflection',
  )
  assert.equal(lemmaFromInflection(['Inflection of eat']), 'eat')
  assert.equal(lemmaFromInflection(['Plural of cat']), 'cat')
})
