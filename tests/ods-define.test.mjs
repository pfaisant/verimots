import test from 'node:test'
import assert from 'node:assert/strict'
import { adjectiveFromParticiple, cleanWikitext, extractSenses, handleOdsDefine, isJunkDef, lemmaFromInflection, lookupDefinition, rankTitles, lookupQuery, resetDefineCacheForTests, senseKind, voirTitles } from '../scripts/ods-define.mjs'

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

test('lookupDefinition merges accent homographs: RAPEZ shows raper and râper', async () => {
  const { lookupDefinition, resetDefineCacheForTests } = await import('../scripts/ods-define.mjs')
  resetDefineCacheForTests()
  const pages = {
    rapez: `{{voir|râpez}}
== {{langue|fr}} ==
=== {{S|verbe|fr|flexion}} ===
# ''Deuxième personne du pluriel de l’indicatif présent du verbe'' [[raper]].
`,
    râpez: `{{voir|rapez}}
== {{langue|fr}} ==
=== {{S|verbe|fr|flexion}} ===
# ''Deuxième personne du pluriel de l’indicatif présent du verbe'' [[râper]].
`,
    raper: `== {{langue|fr}} ==
=== {{S|nom|fr}} ===
# {{argot|fr}} [[policier|Policier]] en tenue.
=== {{S|verbe|fr}} ===
# [[chanter|Chanter]] le rap.
`,
    râper: `== {{langue|fr}} ==
=== {{S|verbe|fr}} ===
# {{lexique|cuisine|fr}} Réduire en petits morceaux avec une râpe.
`,
  }
  const realFetch = globalThis.fetch
  globalThis.fetch = async (url) => {
    const u = new URL(String(url))
    const body = u.searchParams.get('action') === 'query'
      ? { query: { search: [{ title: 'rapez' }, { title: 'râpez' }, { title: 'raper' }, { title: 'rape' }] } }
      : (() => {
          const title = u.searchParams.get('page')
          return pages[title] ? { parse: { title, wikitext: pages[title] } } : { error: 'missing' }
        })()
    return { ok: true, json: async () => body }
  }
  try {
    const r = await lookupDefinition('RAPEZ', 'fr')
    assert.equal(r.found, true)
    assert.equal(r.lemma, 'raper')
    assert.deepEqual(r.lemmas, ['raper', 'râper'])
    assert.deepEqual(r.senses.map((s) => [s.pos, s.lemma]), [['nom', 'raper'], ['verbe', 'raper'], ['verbe', 'râper']])
    assert.match(r.senses[2].defs[0], /râpe/)
    assert.equal(r.url, 'https://fr.wiktionary.org/wiki/raper')
  } finally {
    globalThis.fetch = realFetch
    resetDefineCacheForTests()
  }
})

test('lookupDefinition keeps a single lemma untagged and drops flexion senses from a lexical page', async () => {
  const { lookupDefinition, resetDefineCacheForTests } = await import('../scripts/ods-define.mjs')
  resetDefineCacheForTests()
  const pages = {
    cote: `== {{langue|fr}} ==
=== {{S|nom|fr}} ===
# Code alphabétique ou numérique.
=== {{S|verbe|fr|flexion}} ===
# ''Première personne du singulier de l’indicatif présent de'' [[coter]].
`,
  }
  const realFetch = globalThis.fetch
  globalThis.fetch = async (url) => {
    const u = new URL(String(url))
    const body = u.searchParams.get('action') === 'query'
      ? { query: { search: [{ title: 'cote' }] } }
      : pages[u.searchParams.get('page')] ? { parse: { title: u.searchParams.get('page'), wikitext: pages[u.searchParams.get('page')] } } : {}
    return { ok: true, json: async () => body }
  }
  try {
    const r = await lookupDefinition('cote', 'fr')
    assert.equal(r.lemma, 'cote')
    assert.equal(r.lemmas, undefined)
    assert.deepEqual(r.senses.map((s) => s.pos), ['nom'])
    assert.equal('lemma' in r.senses[0], false)
  } finally {
    globalThis.fetch = realFetch
    resetDefineCacheForTests()
  }
})

test('extractSenses reads Catalan senses and skips the Occitan section', () => {
  const wiki = `{{vegeu|collegi}}

== {{-oc-}} ==

=== Nom ===
{{oc-nom|m}}

# Occitan gloss.

== {{-ca-}} ==
{{ca-pron|è|informal=/kuˈɫɛ.ʒit/}}
{{etim-lang|la|ca|collegium}}, {{etim-s|ca|XIV}}.

=== Nom ===
{{ca-nom|m}}

# [[escola|Escola]].
# Associació professional.
#: ''col·legi d'infermeria''

{{-sin-}}
* [[agrupació]], [[associació]].

=== Miscel·lània ===
* {{ca-sil}}

=== Vegeu també ===
* {{Viquipèdia}}
`
  const senses = extractSenses(wiki, 'ca')
  assert.equal(senses.length, 1)
  assert.equal(senses[0].pos, 'nom')
  assert.deepEqual(senses[0].defs, ['Escola.', 'Associació professional.'])
})

test('Catalan form templates expand to a gloss with a findable lemma', () => {
  assert.equal(cleanWikitext('{{forma-p|ca|col·legi}}'), 'Plural de col·legi')
  assert.equal(cleanWikitext('{{ca-forma-conj|cantar|2|imperf|ind}}'), 'Forma conjugada de cantar')
  assert.equal(lemmaFromInflection(['Plural de col·legi']), 'col·legi')
  assert.equal(lemmaFromInflection(['Forma conjugada de cantar']), 'cantar')
  // Those glosses must read as inflections so the lookup swaps to the lemma.
  assert.equal(senseKind([{ pos: 'nom', defs: ['Plural de col·legi'] }]), 'inflection')
  assert.equal(senseKind([{ pos: 'verb', defs: ['Forma conjugada de cantar'] }]), 'inflection')
})

test('Catalan queries keep Ç and the interpunct, and fold stress marks', () => {
  assert.equal(lookupQuery('CAÇA', 'ca'), 'caça')
  assert.equal(lookupQuery('COL·LEGI', 'ca'), 'col·legi')
  assert.equal(lookupQuery('CAFE', 'ca'), 'cafe')
  // Ç is only a letter in Catalan: elsewhere "français" still folds to c.
  assert.equal(lookupQuery('FRANÇAIS', 'fr'), 'francais')
  // The accented page must stay a candidate for an unaccented Scrabble word:
  // "abac" itself has no Catalan section, so the lookup falls through to it.
  const ranked = rankTitles('abac', ['Abacus', 'àbac', 'abaca'], 'ca')
  assert.equal(ranked[0], 'àbac')
})

test('lookupDefinition still reads the exact word when Wiktionary search fails', async () => {
  const realFetch = globalThis.fetch
  const calls = []
  resetDefineCacheForTests()
  globalThis.fetch = async (input) => {
    const url = new URL(String(input))
    calls.push(url.searchParams.get('action'))
    if (url.searchParams.get('action') === 'query') throw new Error('Search timeout')
    assert.equal(url.searchParams.get('page'), 'pain')
    return { ok: true, json: async () => ({ parse: {
      title: 'pain',
      wikitext: '== {{langue|fr}} ==\n=== {{S|nom|fr}} ===\n# Aliment à base de farine.',
    } }) }
  }
  try {
    const result = await lookupDefinition('PAIN')
    assert.equal(result.ok, true)
    assert.equal(result.found, true)
    assert.equal(result.lemma, 'pain')
    assert.equal(result.unavailable, undefined)
    assert.deepEqual(calls, ['query', 'parse'])
  } finally {
    globalThis.fetch = realFetch
    resetDefineCacheForTests()
  }
})

test('temporary definition failures remain retryable instead of becoming missing entries', async () => {
  const realFetch = globalThis.fetch
  let failing = true
  resetDefineCacheForTests()
  globalThis.fetch = async (input) => {
    const url = new URL(String(input))
    if (url.searchParams.get('action') === 'query') {
      return { ok: true, json: async () => ({ query: { search: [] } }) }
    }
    if (failing) throw new Error('Wiktionary connection reset')
    return { ok: true, json: async () => ({ parse: {
      title: 'pain',
      wikitext: '== {{langue|fr}} ==\n=== {{S|nom|fr}} ===\n# Aliment à base de farine.',
    } }) }
  }
  try {
    const unavailable = await lookupDefinition('PAIN')
    assert.equal(unavailable.ok, false)
    assert.equal(unavailable.unavailable, true)
    assert.equal(unavailable.found, false)
    failing = false
    const retry = await lookupDefinition('PAIN')
    assert.equal(retry.ok, true)
    assert.equal(retry.found, true)
  } finally {
    globalThis.fetch = realFetch
    resetDefineCacheForTests()
  }
})

test('definition API distinguishes Wiktionary errors from an absent page', async () => {
  const realFetch = globalThis.fetch
  let wikiError = 'maxlag'
  resetDefineCacheForTests()
  globalThis.fetch = async (input) => {
    const url = new URL(String(input))
    return { ok: true, json: async () => url.searchParams.get('action') === 'query'
      ? { query: { search: [] } }
      : { error: { code: wikiError } } }
  }
  async function request() {
    let response
    await handleOdsDefine(
      { method: 'GET', headers: {}, socket: { remoteAddress: 'test-definition' } },
      {},
      new URL('https://s.pfa87.cc/api/define?w=PAIN&lang=fr'),
      { json: (_res, status, body, headers) => { response = { status, body, headers } } },
    )
    return response
  }
  try {
    const unavailable = await request()
    assert.equal(unavailable.status, 503)
    assert.equal(unavailable.body.unavailable, true)
    assert.equal(unavailable.headers['Cache-Control'], 'no-store')
    wikiError = 'missingtitle'
    const missing = await request()
    assert.equal(missing.status, 200)
    assert.equal(missing.body.ok, true)
    assert.equal(missing.body.found, false)
    assert.equal(missing.body.unavailable, undefined)
    assert.equal(missing.headers['Cache-Control'], 'no-store')
  } finally {
    globalThis.fetch = realFetch
    resetDefineCacheForTests()
  }
})

test('a search API error does not become a definitive missing definition', async () => {
  const realFetch = globalThis.fetch
  resetDefineCacheForTests()
  globalThis.fetch = async (input) => {
    const url = new URL(String(input))
    return { ok: true, json: async () => ({ error: {
      code: url.searchParams.get('action') === 'query' ? 'ratelimited' : 'missingtitle',
    } }) }
  }
  try {
    const result = await lookupDefinition('ECOLE')
    assert.equal(result.ok, false)
    assert.equal(result.unavailable, true)
  } finally {
    globalThis.fetch = realFetch
    resetDefineCacheForTests()
  }
})

test('definition lookups coalesce concurrent requests and bound oversized upstream responses', async () => {
  const original = globalThis.fetch
  resetDefineCacheForTests()
  let calls = 0
  globalThis.fetch = async (input) => {
    calls++
    const url = new URL(input)
    const body = url.searchParams.get('action') === 'query'
      ? { query: { search: [] } }
      : { parse: { title: 'chat', wikitext: '== {{langue|fr}} ==\n=== {{S|nom|fr}} ===\n# Un animal domestique.' } }
    return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
  }
  try {
    const [a, b] = await Promise.all([lookupDefinition('CHAT'), lookupDefinition('CHAT')])
    assert.equal(a.found, true)
    assert.deepEqual(a, b)
    assert.equal(calls, 2, 'one search and one page request serve both callers')
    resetDefineCacheForTests()
    globalThis.fetch = async () => new Response('oversized', { headers: { 'Content-Length': String(3 * 1024 * 1024) } })
    const oversized = await lookupDefinition('CHAT')
    assert.equal(oversized.ok, false)
    assert.equal(oversized.unavailable, true)
  } finally {
    globalThis.fetch = original
    resetDefineCacheForTests()
  }
})

test('definition service bounds outstanding distinct lookups without blocking duplicate queries', async () => {
  const original = globalThis.fetch
  resetDefineCacheForTests()
  let release
  const gate = new Promise((resolve) => { release = resolve })
  globalThis.fetch = async (input) => {
    await gate
    return new Response(JSON.stringify(new URL(input).searchParams.get('action') === 'query' ? { query: { search: [] } } : { error: { code: 'missingtitle' } }))
  }
  let pending = []
  try {
    pending = Array.from({ length: 16 }, (_, i) => lookupDefinition('mot' + String.fromCharCode(97 + i)))
    const busy = await lookupDefinition('overflow')
    assert.equal(busy.unavailable, true)
    const duplicate = lookupDefinition('mota')
    release()
    const results = await Promise.all([...pending, duplicate])
    assert.ok(results.every((result) => result.ok && !result.found))
  } finally {
    release()
    await Promise.allSettled(pending)
    globalThis.fetch = original
    resetDefineCacheForTests()
  }
})
