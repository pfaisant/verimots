import { AsyncLocalStorage } from 'node:async_hooks'
import { clientIp, createRateLimiter } from './http-safety.mjs'

// Wiktionnaire lookup for the public ODS page. Not Larousse / ODS wording.
const WIKI_FR = 'https://fr.wiktionary.org/w/api.php'
const WIKI_EN = 'https://en.wiktionary.org/w/api.php'
const WIKI_ES = 'https://es.wiktionary.org/w/api.php'
const WIKI_CA = 'https://ca.wiktionary.org/w/api.php'
const WIKI = WIKI_FR
const UA = 's.pfa87.cc-ods9/1.0 (https://s.pfa87.cc/; french scrabble word helper)'
const CACHE_MAX = 400
const CACHE_TTL_MS = 12 * 60 * 60 * 1000
const FETCH_MS = 8000

const SKIP_POS = new Set([
  'étymologie',
  'etymologie',
  'prononciation',
  'anagrammes',
  'voir aussi',
  'références',
  'references',
  'traductions',
  'synonymes',
  'apparentés',
  'dérivés',
  'variantes',
  'variante typographique',
  'notes',
  'homophones',
  'paronymes',
  'vocabulaire',
  'hyperonymes',
  'hyponymes',
  'méronymes',
  'holonymes',
  'quasi-synonymes',
  'apparentés étymologiques',
  'composés',
  'phrases',
  'nom propre',
  'nom-propre',
])

const LABEL_TEMPLATES = new Set([
  'en particulier',
  'figuré',
  'familier',
  'populaire',
  'vx',
  'vieilli',
  'par ext',
  'par extension',
  'néologisme',
  'rare',
  'péjoratif',
  'canada',
  'france',
  'helvétisme',
  'belgicisme',
  'soutenu',
  'littéraire',
  'argotique',
])

const cache = new Map()
const allowRate = createRateLimiter(40, 60_000)
const lookupRequests = new AsyncLocalStorage()
const pendingLookups = new Map()
const MAX_PENDING_LOOKUPS = 16
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024
const LOOKUP_DEADLINE_MS = 20_000

export function foldKey(value, lang = 'fr') {
  const nTilde = '\ue000'
  const cCedilla = '\ue001'
  return String(value || '')
    .normalize('NFC')
    .replace(/ñ/gi, lang === 'es' ? nTilde : 'n')
    .replace(/ç/gi, lang === 'ca' ? cCedilla : 'c')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replaceAll(nTilde, 'ñ')
    .replaceAll(cCedilla, 'ç')
}

export function isJunkDef(text) {
  const s = String(text || '').trim()
  if (!s) return true
  if (!/\p{L}/u.test(s)) return true
  const stripped = s.replace(/\([^)]*\)/g, '').replace(/[\s.,;:·«»""''•…\-–—]+/g, '')
  return !stripped
}

export function cleanWikitext(input) {
  let s = String(input || '')
  s = s.replace(/<!--[\s\S]*?-->/g, '')
  s = s.replace(/\{\{exemple[\s\S]*?\}\}/gi, '')
  for (let i = 0; i < 8; i++) {
    const next = s.replace(/\{\{([^{}]*)\}\}/g, (_, inner) => {
      const parts = inner.split('|').map((p) => p.trim())
      const name = (parts[0] || '').split(':')[0].toLowerCase()
      if (name === 'e' || name === 'er' || name === 're' || name === 'ère' || name === 'ere') {
        return name === 'ère' || name === 'ere' ? 'ère' : name
      }
      if (name === 'siècle' || name === 'date' || name === 'circa' || name === 'recons') return ''
      if (LABEL_TEMPLATES.has(name)) return `(${parts[0]}) `
      if (name === 'lien' || name === 'l') return parts[1] || ''
      if (name === 'w' || name === 'wp') return parts[parts.length - 1] || ''
      if (name === 'lexique' || name === 'term' || name === 'info lex' || name === 'infolex') {
        return parts[1] ? `(${parts[1]}) ` : ''
      }
      if (name === 'lb' || name === 'lbl' || name === 'label') {
        const skip = new Set(['_', ',', ';', '/', '&'])
        return parts.slice(2).filter((p) => p && !skip.has(p) && !p.includes('=')).map((p) => `(${p}) `).join('')
      }
      const ofLabels = {
        'plural of': 'Plural of',
        'en-plural of': 'Plural of',
        'pluriel de': 'Pluriel de',
        'forma verbo': 'Forma de',
        'forma verbal': 'Forma de',
        'forma sustantivo plural': 'Plural de',
        'forma adjetivo plural': 'Plural de',
        'forma sustantivo': 'Forma de',
        'forma adjetivo': 'Forma de',
        'inflection of': 'Inflection of',
        'infl of': 'Inflection of',
        'present participle of': 'Present participle of',
        'past participle of': 'Past participle of',
        'past of': 'Simple past of',
        'simple past of': 'Simple past of',
        'third-person singular of': 'Third-person singular of',
        'alternative form of': 'Alternative form of',
        'alt form': 'Alternative form of',
        'altform': 'Alternative form of',
        'misspelling of': 'Misspelling of',
        'abbreviation of': 'Abbreviation of',
        'initialism of': 'Initialism of',
        'init of': 'Initialism of',
        'variante ortho de': 'Variante orthographique de',
        'variante orthographique de': 'Variante orthographique de',
        'variante de': 'Variante de',
        'synonyme de': 'Synonyme de',
        'abréviation de': 'Abréviation de',
        'abreviation de': 'Abréviation de',
        // Catalan marks inflections with structured templates rather than
        // prose: {{forma-p|ca|col·legi}}, {{ca-forma-conj|cantar|2|imperf|ind}}.
        'forma-p': 'Plural de',
        'forma-f': 'Femení de',
        'forma-fp': 'Femení plural de',
        'forma-a': 'Forma alternativa de',
        'forma-dim': 'Diminutiu de',
        'forma-aug': 'Augmentatiu de',
        'forma-superl': 'Superlatiu de',
        'forma-conj': 'Forma conjugada de',
        'ca-forma-conj': 'Forma conjugada de',
      }
      if (ofLabels[name]) {
        const lemma = parts.find((p, index) =>
          index > 0 && p && !p.includes('=') && !/^(?:en|fr|es|ca)$/.test(p)
        )
        return lemma ? `${ofLabels[name]} ${lemma}` : ''
      }
      // {{instruments à vent|fr}} / {{cuisine|fr}} — domain labels with no lemma
      const onlyLang = parts.slice(1).filter((p) => p && !p.includes('=')).every((p) => /^(fr|en|es|ca)$/i.test(p))
      if (onlyLang && parts[0] && parts.length >= 2) return `(${parts[0]}) `
      return ''
    })
    if (next === s) break
    s = next
  }
  s = s.replace(/\[\[([^\]\n|]+)\|([^\]\n]+)\]\]/g, '$2')
  s = s.replace(/\[\[([^\]\n]+)\]\]/g, '$1')
  s = s.replace(/'{2,}/g, '')
  s = s.replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, '')
  s = s.replace(/<[^>]+>/g, '')
  s = s.replace(/&nbsp;/gi, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'")
  s = s.replace(/\(\s*\)/g, '')
  s = s.replace(/\s+([.,;:])/g, '$1')
  return s.replace(/\s+/g, ' ').trim()
}

function frenchSection(wikitext) {
  const start = wikitext.search(/^==\s*\{\{langue\|fr\}\}\s*==\s*$/m)
  if (start < 0) return ''
  const rest = wikitext.slice(start)
  const end = rest.slice(rest.indexOf('\n') + 1).search(/^==\s*\{\{langue\|/m)
  return end < 0 ? rest : rest.slice(0, rest.indexOf('\n') + 1 + end)
}

function englishSection(wikitext) {
  const start = wikitext.search(/^==\s*English\s*==\s*$/m)
  if (start < 0) return ''
  const rest = wikitext.slice(start)
  const end = rest.slice(rest.indexOf('\n') + 1).search(/^==\s*[^={\n][^=\n]*==\s*$/m)
  return end < 0 ? rest : rest.slice(0, rest.indexOf('\n') + 1 + end)
}

function spanishSection(wikitext) {
  const lines = String(wikitext || '').split('\n')
  const start = lines.findIndex((line) =>
    /^==\s*.*\{\{(?:lengua|idioma)\|es(?:\||\}\}).*==\s*$/i.test(line)
    || /^==\s*Español\s*==\s*$/i.test(line)
  )
  if (start < 0) return ''
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (/^==[^=].*==\s*$/.test(lines[i])) {
      end = i
      break
    }
  }
  return lines.slice(start, end).join('\n')
}

/** The {{-ca-}} block of a ca.wiktionary page, up to the next language. */
function catalanSection(wikitext) {
  const lines = String(wikitext || '').split('\n')
  const start = lines.findIndex((line) => /^==\s*\{\{-ca-\}\}\s*==\s*$/.test(line))
  if (start < 0) return ''
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (/^==[^=].*==\s*$/.test(lines[i])) {
      end = i
      break
    }
  }
  return lines.slice(start, end).join('\n')
}

// Folded (accent-free) headings that are not parts of speech.
const SKIP_CA_POS = /^(?:etimologia|pronuncia|pronunciacio|miscel·lania|vegeu tambe|anagrames|traduccions|sinonims|antonims|derivats|relacionats|compostos|locucions|expressions|refranys|homofons|paronims|falsos amics|notes|notes d'us|conjugacio|declinacio|referencies|variants|paremies|hiperonims|hiponims|nom propi)$/

export function extractCatalanSenses(wikitext) {
  const ca = catalanSection(wikitext)
  if (!ca) return []
  const senses = []
  let current = null
  for (const line of ca.split('\n')) {
    const heading = line.match(/^===+\s*(.*?)\s*===+\s*$/)
    if (heading) {
      const pos = cleanWikitext(heading[1]).replace(/^[-–—]\s*|\s*[-–—]$/g, '').trim()
      const folded = foldKey(pos, 'fr').trim()
      current = !pos || SKIP_CA_POS.test(folded) ? null : { pos: pos.toLowerCase(), defs: [] }
      if (current) senses.push(current)
      continue
    }
    if (!current) continue
    const hashed = line.match(/^#(?![*:])\s*(.*)$/)
    if (!hashed) continue
    const text = cleanWikitext(hashed[1]).replace(/^\s*([.·,:;])\s*$/, '')
    if (!text || isJunkDef(text)) continue
    current.defs.push(text)
    if (current.defs.length >= 5) current = null
  }
  return keepLexicalSenses(senses)
}

const SKIP_EN_POS = new Set([
  'etymology',
  'pronunciation',
  'anagrams',
  'translations',
  'see also',
  'references',
  'further reading',
  'derived terms',
  'related terms',
  'synonyms',
  'antonyms',
  'hyponyms',
  'hypernyms',
  'usage notes',
  'alternative forms',
  'proper noun',
  'symbol',
  'homophones',
  'hyphenation',
  'rhymes',
  'coordinate terms',
  'descendants',
  'quotations',
])

const EN_LEXICAL_POS = new Set([
  'noun',
  'verb',
  'adjective',
  'adverb',
  'interjection',
  'pronoun',
  'preposition',
  'conjunction',
  'determiner',
  'article',
  'numeral',
  'participle',
  'prefix',
  'suffix',
  'contraction',
  'phrase',
  'idiom',
  'proverb',
  'prepositional phrase',
])

function isProperNounPos(pos) {
  return /nom propre|proper noun|nombre propio|nom propi/.test(String(pos || '').toLowerCase())
}

function keepLexicalSenses(senses) {
  return (senses || []).filter((s) => s?.defs?.length && !isProperNounPos(s.pos))
}

export function extractSenses(wikitext, lang = 'fr') {
  if (lang === 'en') return extractEnglishSenses(wikitext)
  if (lang === 'es') return extractSpanishSenses(wikitext)
  if (lang === 'ca') return extractCatalanSenses(wikitext)
  const fr = frenchSection(String(wikitext || ''))
  if (!fr) return []
  const senses = []
  let current = null
  for (const line of fr.split('\n')) {
    const posHit = line.match(/^===\s*\{\{S\|([^}\n]+)/)
    if (posHit) {
      const bits = posHit[1].split('|').map((p) => p.trim()).filter(Boolean)
      const pos = bits[0] || ''
      current = !pos || SKIP_POS.has(pos.toLowerCase()) ? null : { pos, defs: [] }
      if (current) senses.push(current)
      continue
    }
    if (!current) continue
    if (!/^#(?![*:])/.test(line)) continue
    const text = cleanWikitext(line.replace(/^#+\s*/, ''))
    if (!text || isJunkDef(text)) continue
    current.defs.push(text)
    if (current.defs.length >= 5) current = null
  }
  const kept = keepLexicalSenses(senses)
  const lexical = kept.filter((s) => senseKind([s]) === 'lexical')
  if (!lexical.length) return kept
  // ÉCHAUDÉ is both a pastry and "participe passé de échauder": keep the
  // verb-form senses after the lexical ones so the reader sees the verb too
  // (the client renders them as a "Forme de …" line with a root link).
  const verbForms = kept.filter((s) => {
    const kind = senseKind([s])
    return kind === 'participle' || kind === 'finite' || (kind === 'inflection' && /verbe/i.test(String(s.pos || '')))
  })
  return verbForms.length ? [...lexical, ...verbForms] : lexical
}

const FINITE_VERB_RE = /personne du|imp[eé]ratif de/i
const PARTICIPLE_RE = /participe (?:pass[eé]|pr[eé]sent)/i
const FORM_OF_START_RE = /^(?:plural of|inflection of|simple past of|present participle of|past participle of|third-person singular of|alternative form of|abbreviation of|initialism of|misspelling of|pluriel de|féminin(?: singulier)? de|masculin de|singulier de|forme(?:s| conjuguée)? de|variante(?: orthographique)? de|forma de|plural de|synonyme de|abréviation de|forma conjugada de|forma alternativa de|femení(?: plural)? de|diminutiu de|augmentatiu de|superlatiu de)\b/i

function stripLeadingLabels(text) {
  return String(text || '').replace(/^\s*(?:\([^)]*\)\s*)+/, '').trim()
}

function isFormOfGloss(text) {
  const raw = String(text || '')
  const s = stripLeadingLabels(raw)
  return FORM_OF_START_RE.test(s) || FINITE_VERB_RE.test(raw) || PARTICIPLE_RE.test(raw)
}

export function voirTitles(wikitext) {
  const titles = []
  const re = /\{\{\s*voir\|([^}|]+)/gi
  let m
  while ((m = re.exec(String(wikitext || '')))) {
    const title = m[1].trim()
    if (title) titles.push(title)
  }
  return titles
}

export function senseKind(senses) {
  const defs = (senses || []).flatMap((s) => s.defs || [])
  if (!defs.length) return 'empty'
  const finite = defs.every((d) => FINITE_VERB_RE.test(d))
  const participle = defs.every((d) => PARTICIPLE_RE.test(d))
  if (participle && !finite) return 'participle'
  if (finite) return 'finite'
  if (defs.every(isFormOfGloss)) return 'inflection'
  return 'lexical'
}

export function lemmaFromInflection(defs) {
  for (const raw of defs || []) {
    const d = String(raw || '')
    const patterns = [
      /du verbe\s+([A-Za-zÀ-ÿŒœ][A-Za-zÀ-ÿŒœ'-]{1,24})/i,
      /participe (?:pass[eé]|pr[eé]sent)(?:[^.]{0,40}?)(?:du verbe|de)\s+([A-Za-zÀ-ÿŒœ][A-Za-zÀ-ÿŒœ'-]{1,24})/i,
      /(?:indicatif|subjonctif|conditionnel)(?: présent| passé| imparfait)? de\s+([A-Za-zÀ-ÿŒœ][A-Za-zÀ-ÿŒœ'-]{1,24})/i,
      /imp[eé]ratif de\s+([A-Za-zÀ-ÿŒœ][A-Za-zÀ-ÿŒœ'-]{1,24})/i,
      /(?:Inflection|Plural|Singular|Alternative form|Abbreviation|Initialism|Misspelling|Forma|Pluriel|Féminin(?: singulier| pluriel)?|Masculin(?: singulier| pluriel)?|Singulier|Variante(?: orthographique)?|Synonyme|Abréviation) (?:of|de)\s+([A-Za-zÀ-ÿÑñŒœ][A-Za-zÀ-ÿÑñŒœ'·-]{1,24})/i,
      /forme(?:s| conjuguée)? de\s+([A-Za-zÀ-ÿÑñŒœ][A-Za-zÀ-ÿÑñŒœ'-]{1,24})/i,
      // Catalan: "Forma conjugada de cantar", "Plural de col·legi".
      /(?:Forma conjugada|Forma alternativa|Femení(?: plural)?|Diminutiu|Augmentatiu|Superlatiu) de\s+([A-Za-zÀ-ÿÑñŒœ][A-Za-zÀ-ÿÑñŒœ'·-]{1,24})/i,
    ]
    for (const re of patterns) {
      const m = d.match(re)
      if (m?.[1]) return m[1].replace(/[.,;:]+$/, '')
    }
  }
  return ''
}

export function adjectiveFromParticiple(senses, lemmaSenses) {
  const glosses = (lemmaSenses || [])
    .filter((s) => senseKind([s]) === 'lexical')
    .flatMap((s) => s.defs || [])
    .filter(Boolean)
    .slice(0, 2)
  const fallback = (senses || []).flatMap((s) => s.defs || []).filter(Boolean)
  return [{ pos: 'adjectif', defs: glosses.length ? glosses : fallback }]
}

export function extractSpanishSenses(wikitext) {
  const es = spanishSection(wikitext)
  if (!es) return []
  const skipped = /^(?:etimología|pronunciación|locuciones|refranes|véase también|referencias|traducciones|sinónimos|antónimos|anagramas|conjugación|nombre propio)$/i
  const senses = []
  let current = null
  for (const line of es.split('\n')) {
    const heading = line.match(/^===+\s*(.*?)\s*===+\s*$/)
    if (heading) {
      const template = heading[1].match(/\{\{\s*([^{}|]+)(?:\|[^{}]*)?\}\}/)
      const templateName = (template?.[1] || '').trim().toLowerCase()
      const posTemplate = /^(?:sustantivo|adjetivo|verbo|adverbio|pronombre|artículo|interjección|preposición|conjunción|nombre propio|locución)\b/.test(templateName)
        ? templateName
        : ''
      const pos = (posTemplate || cleanWikitext(heading[1]))
        .replace(/^[-–—]\s*|\s*[-–—]$/g, '')
        .trim()
      current = !pos || skipped.test(pos) ? null : { pos: pos.toLowerCase(), defs: [] }
      if (current) senses.push(current)
      continue
    }
    if (!current) continue
    const numbered = line.match(/^;\s*\d+\s*:\s*(.*)$/)
    const hashed = line.match(/^#(?![*:])\s*(.*)$/)
    const raw = numbered?.[1] ?? hashed?.[1]
    if (raw == null) continue
    const text = cleanWikitext(raw).replace(/^\s*([.·,:;])\s*$/, '')
    if (!text || isJunkDef(text)) continue
    current.defs.push(text)
    if (current.defs.length >= 5) current = null
  }
  return keepLexicalSenses(senses)
}

export function extractEnglishSenses(wikitext) {
  const en = englishSection(String(wikitext || ''))
  if (!en) return []
  const senses = []
  let current = null
  for (const line of en.split('\n')) {
    // English entries nest POS under Etymology as ====Noun====. Require the
    // same number of equals on both sides so =====Derived terms===== is ignored.
    const posHit = line.match(/^(={3,4})\s*([^=\n]+?)\s*\1\s*$/)
    if (posHit) {
      const pos = posHit[2].trim().replace(/\s+\d+$/, '')
      const base = pos.toLowerCase()
      current = SKIP_EN_POS.has(base)
        || /^(?:etymolog|pronunciation|translations|references|derived|related|see also|further|anagrams|usage)/.test(base)
        || !EN_LEXICAL_POS.has(base)
          ? null
          : { pos: base, defs: [] }
      if (current) senses.push(current)
      continue
    }
    if (!current) continue
    if (!/^#(?![*:])/.test(line)) continue
    const text = cleanWikitext(line.replace(/^#+\s*/, ''))
    if (!text || isJunkDef(text)) continue
    current.defs.push(text)
    if (current.defs.length >= 5) current = null
  }
  return keepLexicalSenses(senses)
}

function isWeak(senses) {
  if (!senses.length) return true
  const text = senses.flatMap((s) => s.defs).join(' ').toLowerCase()
  return /mauvaise orthographe|variante typographique|faute d[’']orthographe/.test(text) && senses.length === 1 && senses[0].defs.length <= 1
}

const FRENCH_LETTERS = /[àâäéèêëïîôùûüçœæ]/i

function lettersOnly(value, lang = 'fr') {
  const keep = lang === 'es' ? /[^a-zñ]/g : lang === 'ca' ? /[^a-zç·]/g : /[^a-z]/g
  return foldKey(value, lang).replace(keep, '')
}

export function lookupQuery(word, lang = 'fr') {
  const keep = lang === 'es' ? /[^a-zñ'-]/g : lang === 'ca' ? /[^a-zç·'-]/g : /[^a-z'-]/g
  return foldKey(word, lang)
    .replace(keep, '')
    .replace(/^[-']+|[-']+$/g, '')
}

export function rankTitles(query, titles, lang = 'fr') {
  const q = foldKey(query, lang)
  const qLetters = lettersOnly(query, lang)
  const preferredLetters = lang === 'es'
    ? /[áéíóúüñ]/i
    : lang === 'ca' ? /[àèéíïòóúüç·]/i : FRENCH_LETTERS
  return [...new Set(titles)]
    .filter((t) => t && !t.startsWith('-') && !t.includes(':'))
    .map((title, index) => {
      const folded = foldKey(title, lang)
      const last = folded.split(/[-\s/]+/).filter(Boolean).pop() || ''
      let score = 0
      if (folded === q || lettersOnly(title, lang) === qLetters) score += 100
      else if (folded.startsWith(q) && folded.length <= q.length + 2) score += 20
      if (foldKey(last, lang) === q) score += 55
      if (folded.endsWith('-' + q) || folded.endsWith(' ' + q)) score += 35
      if (title === query) score += 40
      else if (title === q && query === q) score += 24
      if (title === title.toLowerCase()) score += 10
      if (preferredLetters.test(title)) score += 8
      else if (/[^\u0000-\u007f]/.test(title)) score -= 20
      if (title.includes(' ')) score -= 25
      if (title === title.toUpperCase() && title !== query) score -= lang === 'en' ? 40 : 8
      score -= index
      return { title, score }
    })
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, lang))
    .map((x) => x.title)
}

function cacheGet(word) {
  const hit = cache.get(word)
  if (!hit) return null
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(word)
    return null
  }
  return hit.value
}

function cacheSet(word, value) {
  cache.set(word, { at: Date.now(), value })
  if (cache.size > CACHE_MAX) {
    const first = cache.keys().next().value
    cache.delete(first)
  }
}


async function wikiJson(params, wiki = WIKI_FR) {
  const url = new URL(wiki)
  for (const [k, v] of Object.entries({ format: 'json', formatversion: '2', origin: '*', ...params })) {
    url.searchParams.set(k, v)
  }
  const context = lookupRequests.getStore()
  if (context && --context.remaining < 0) throw new Error('Lookup request budget exceeded')
  context?.signal.throwIfAborted()
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), FETCH_MS)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: context ? AbortSignal.any([ac.signal, context.signal]) : ac.signal,
    })
    if (!res.ok) throw new Error(`wiki ${res.status}`)
    if (Number(res.headers?.get('content-length')) > MAX_RESPONSE_BYTES) {
      await res.body?.cancel()
      throw new Error('Definition response too large')
    }
    if (!res.body) return await res.json()
    const chunks = []
    let size = 0
    for await (const chunk of res.body) {
      size += chunk.length
      if (size > MAX_RESPONSE_BYTES) { ac.abort(); throw new Error('Definition response too large') }
      chunks.push(Buffer.from(chunk))
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } finally {
    clearTimeout(timer)
  }
}

async function searchTitles(word, wiki = WIKI_FR) {
  const data = await wikiJson({
    action: 'query',
    list: 'search',
    srsearch: word,
    srnamespace: '0',
    srlimit: '8',
  }, wiki)
  if (data.error) throw new Error(`wiki ${data.error.code || 'search failed'}`)
  return (data.query?.search || []).map((row) => row.title)
}

async function parsePage(title, wiki = WIKI_FR) {
  const data = await wikiJson({
    action: 'parse',
    page: title,
    prop: 'wikitext',
    redirects: '1',
  }, wiki)
  if (data.error && data.error.code !== 'missingtitle') {
    throw new Error(`wiki ${data.error.code || 'lookup failed'}`)
  }
  if (!data.parse?.wikitext) return null
  const wikitext = typeof data.parse.wikitext === 'string' ? data.parse.wikitext : data.parse.wikitext['*'] || ''
  return { title: data.parse.title || title, wikitext }
}

const MAX_ENTRIES = 4
const MAX_PAGES = 8
const ABBREVIATION_RE = /initialism|abbreviation|abréviation|acronym|sigle|misspelling|mauvaise orthographe|faute d[’']orthographe|synonyme/i

function isAbbreviationLike(hit) {
  return hit.kind !== 'lexical' && ABBREVIATION_RE.test(hit.senses.flatMap((s) => s.defs || []).join(' '))
}

/** Turn a ranked page into a lexical entry: a lexical page is itself, a
 *  participle borrows its verb's glosses as an adjective, any other
 *  inflection ("deuxième personne du pluriel de râper") swaps to its lemma
 *  page. Returns null when nothing lexical can be shown. */
async function resolveEntry(hit, lang, wiki) {
  if (hit.kind === 'lexical') {
    // A lexical page can still carry flexion senses ("cote": nom + "première
    // personne … de coter"); keep the real glosses when there are any.
    const lexical = hit.senses.filter((s) => senseKind([s]) === 'lexical')
    return { page: hit.page, senses: lexical.length ? lexical : hit.senses }
  }
  const lemma = lemmaFromInflection(hit.senses.flatMap((s) => s.defs))
  if (hit.kind === 'participle' && lang === 'fr') {
    let lemmaSenses = []
    if (lemma) {
      try {
        const lemmaPage = await parsePage(lemma, wiki)
        lemmaSenses = extractSenses(lemmaPage?.wikitext || '', lang)
      } catch {
        lemmaSenses = []
      }
    }
    return { page: hit.page, senses: adjectiveFromParticiple(hit.senses, lemmaSenses) }
  }
  if (lemma && lettersOnly(lemma, lang) !== lettersOnly(hit.page.title, lang)) {
    try {
      const lemmaPage = await parsePage(lemma, wiki)
      const lexical = extractSenses(lemmaPage?.wikitext || '', lang).filter((s) => senseKind([s]) === 'lexical')
      if (lexical.length && lemmaPage) return { page: lemmaPage, senses: lexical }
    } catch {
      // keep the inflection gloss
    }
  }
  return { page: hit.page, senses: hit.senses }
}

async function performLookup(word, lang = 'fr') {
  lang = lang === 'en' || lang === 'es' || lang === 'ca' ? lang : 'fr'
  const query = lookupQuery(word, lang)
  const letters = query.replace(/[-']/g, '')
  if (letters.length < 2 || letters.length > 30) return { ok: false, error: 'invalid word' }
  const key = letters.toUpperCase()
  const cacheKey = `${lang}:` + query
  const cached = cacheGet(cacheKey)
  if (cached) return cached
  const config = {
    fr: { wiki: WIKI_FR, host: 'https://fr.wiktionary.org/wiki/', source: 'wiktionnaire' },
    en: { wiki: WIKI_EN, host: 'https://en.wiktionary.org/wiki/', source: 'wiktionary' },
    es: { wiki: WIKI_ES, host: 'https://es.wiktionary.org/wiki/', source: 'wikcionario' },
    ca: { wiki: WIKI_CA, host: 'https://ca.wiktionary.org/wiki/', source: 'viccionari' },
  }[lang]
  const { wiki, host, source } = config

  // Search is useful for accent variants, but a temporary search failure
  // must not prevent reading the known title itself (for example, PAIN).
  let titles = [query]
  let unavailable = false
  try {
    const lemma = query.toLowerCase()
    titles = rankTitles(query, [lemma, ...await searchTitles(lemma, wiki)], lang)
  } catch {
    unavailable = true
  }

  const qLetters = lettersOnly(query, lang)
  const queue = titles.slice(0, 8)
  const seen = new Set()
  // Every page spelled with the query's letters is a candidate entry: RAPEZ
  // is both "rapez" (→ raper, to rap) and "râpez" (→ râper, to grate), and a
  // Scrabble player cares about all of them. Pages with other letters only
  // matter as a last resort.
  const sameHits = []
  let fallback = null

  let fetched = 0
  while (queue.length && fetched < MAX_PAGES) {
    const title = queue.shift()
    const mark = foldKey(title, lang) + '|' + title
    if (seen.has(mark)) continue
    seen.add(mark)
    const sameTitle = lettersOnly(title, lang) === qLetters
    if (!sameTitle && (sameHits.length || fallback)) continue
    try {
      fetched++
      const page = await parsePage(title, wiki)
      if (!page) continue
      if (lang === 'fr') {
        for (const extra of voirTitles(page.wikitext)) {
          if (lettersOnly(extra, lang) === qLetters && !seen.has(foldKey(extra, lang) + '|' + extra)) {
            queue.push(extra)
          }
        }
      }
      const senses = extractSenses(page.wikitext, lang)
      if (!senses.length || isWeak(senses)) continue
      const kind = senseKind(senses)
      const hit = { page, senses, kind }
      const same = lettersOnly(page.title, lang) === qLetters
      if (same) sameHits.push(hit)
      else fallback = fallback || hit
    } catch {
      // try the next ranked title
      unavailable = true
    }
  }

  const rank = { lexical: 0, participle: 1, finite: 2, inflection: 2, empty: 3 }
  sameHits.sort((a, b) => (rank[a.kind] ?? 3) - (rank[b.kind] ?? 3))
  const candidates = sameHits.length ? sameHits : fallback ? [fallback] : []

  const entries = []
  const seenLemmas = new Set()
  const seenGlosses = new Set()
  for (const hit of candidates) {
    if (entries.length >= MAX_ENTRIES) break
    // DAM the initialism must not drag "digital" in next to the dam; only
    // the first entry may follow an abbreviation-style gloss.
    if (entries.length && isAbbreviationLike(hit)) continue
    const entry = await resolveEntry(hit, lang, wiki)
    if (!entry || !entry.senses.length) continue
    const lemmaKey = foldKey(entry.page.title, lang) + '|' + entry.page.title
    if (seenLemmas.has(lemmaKey)) continue
    // ADIRES: the participle already borrowed adirer's glosses as an
    // adjective, so the verb entry would only repeat them.
    const glosses = entry.senses.flatMap((s) => s.defs || []).map((d) => String(d).trim()).filter(Boolean)
    if (glosses.length && glosses.every((g) => seenGlosses.has(g))) continue
    seenLemmas.add(lemmaKey)
    glosses.forEach((g) => seenGlosses.add(g))
    entries.push(entry)
  }

  if (entries.length) {
    const multi = entries.length > 1
    const value = {
      ok: true,
      found: true,
      word: key,
      lemma: entries[0].page.title,
      senses: entries.flatMap((entry) => entry.senses.map((sense) => (multi ? { ...sense, lemma: entry.page.title } : sense))),
      source,
      url: host + encodeURIComponent(entries[0].page.title),
    }
    if (multi) value.lemmas = entries.map((entry) => entry.page.title)
    cacheSet(cacheKey, value)
    return value
  }

  if (unavailable) {
    return { ok: false, found: false, unavailable: true, error: 'Definition service unavailable', word: key, source }
  }
  return { ok: true, found: false, word: key, source }
}

export async function lookupDefinition(word, lang = 'fr') {
  if (typeof word !== 'string' || word.length > 160) return { ok: false, error: 'invalid word' }
  lang = ['en', 'es', 'ca'].includes(lang) ? lang : 'fr'
  const query = lookupQuery(word, lang)
  if (query.replace(/[-']/g, '').length < 2 || query.length > 40) return { ok: false, error: 'invalid word' }
  const key = `${lang}:${query}`
  const cached = cacheGet(key)
  if (cached) return cached
  if (pendingLookups.has(key)) return pendingLookups.get(key)
  if (pendingLookups.size >= MAX_PENDING_LOOKUPS) return { ok: false, found: false, unavailable: true, error: 'Definition service busy' }
  const pending = lookupRequests.run({ signal: AbortSignal.timeout(LOOKUP_DEADLINE_MS), remaining: 16 }, () => performLookup(word, lang))
    .finally(() => pendingLookups.delete(key))
  pendingLookups.set(key, pending)
  return pending
}

export async function handleOdsDefine(req, res, url, helpers) {
  const { json } = helpers
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    json(res, 405, { ok: false, error: 'GET only' }, {}, req.method)
    return true
  }
  if (!allowRate(clientIp(req))) {
    json(res, 429, { ok: false, error: 'Too many lookups' }, {}, req.method)
    return true
  }
  const word = String(url.searchParams.get('w') || url.searchParams.get('word') || '')
  const rawLang = String(url.searchParams.get('lang') || 'fr').toLowerCase()
  const lang = rawLang === 'en' || rawLang === 'es' || rawLang === 'ca' ? rawLang : 'fr'
  const result = await lookupDefinition(word, lang)
  json(res, result.ok ? 200 : result.unavailable ? 503 : 400, result, { 'Cache-Control': result.found ? 'public, max-age=86400' : 'no-store' }, req.method)
  return true
}

export function resetDefineCacheForTests() {
  cache.clear()
  allowRate.clear()
}
