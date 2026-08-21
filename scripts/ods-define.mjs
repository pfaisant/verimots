// Wiktionnaire lookup for the public ODS page. Not Larousse / ODS wording.
const WIKI_FR = 'https://fr.wiktionary.org/w/api.php'
const WIKI_EN = 'https://en.wiktionary.org/w/api.php'
const WIKI_ES = 'https://es.wiktionary.org/w/api.php'
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
const rate = new Map()

export function foldKey(value, lang = 'fr') {
  const sentinel = '\ue000'
  return String(value || '')
    .normalize('NFC')
    .replace(/ñ/gi, lang === 'es' ? sentinel : 'n')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replaceAll(sentinel, 'ñ')
}

export function cleanWikitext(input) {
  let s = String(input || '')
  s = s.replace(/\{\{exemple[\s\S]*?\}\}/gi, '')
  for (let i = 0; i < 8; i++) {
    const next = s.replace(/\{\{([^{}]*)\}\}/g, (_, inner) => {
      const parts = inner.split('|').map((p) => p.trim())
      const name = (parts[0] || '').split(':')[0].toLowerCase()
      if (LABEL_TEMPLATES.has(name)) return `(${parts[0]}) `
      if (name === 'lien' || name === 'l') return parts[1] || ''
      if (name === 'w' || name === 'wp') return parts[parts.length - 1] || ''
      if (name === 'lexique' || name === 'term') return parts[1] ? `(${parts[1]}) ` : ''
      if (name === 'lb' || name === 'lbl' || name === 'label') {
        return parts.slice(2).filter((p) => p && !p.includes('=')).map((p) => `(${p}) `).join('')
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
      }
      if (ofLabels[name]) {
        const lemma = parts.find((p, index) =>
          index > 0 && p && !p.includes('=') && p !== 'en' && p !== 'fr' && p !== 'es'
        )
        return lemma ? `${ofLabels[name]} ${lemma}` : ''
      }
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
])

export function extractSenses(wikitext, lang = 'fr') {
  if (lang === 'en') return extractEnglishSenses(wikitext)
  if (lang === 'es') return extractSpanishSenses(wikitext)
  const fr = frenchSection(String(wikitext || ''))
  if (!fr) return []
  const senses = []
  let current = null
  for (const line of fr.split('\n')) {
    const posHit = line.match(/^===\s*\{\{S\|([^}|]+)/)
    if (posHit) {
      const pos = posHit[1].trim()
      current = SKIP_POS.has(pos.toLowerCase()) ? null : { pos, defs: [] }
      if (current) senses.push(current)
      continue
    }
    if (!current) continue
    if (!/^#(?![*:])/.test(line)) continue
    const text = cleanWikitext(line.replace(/^#+\s*/, ''))
    if (!text) continue
    current.defs.push(text)
    if (current.defs.length >= 5) current = null
  }
  const kept = senses.filter((s) => s.defs.length)
  const lexical = kept.filter((s) => !s.defs.every((d) => /personne du|impératif de|participe /.test(d.toLowerCase())))
  return lexical.length ? lexical : kept
}

export function extractSpanishSenses(wikitext) {
  const es = spanishSection(wikitext)
  if (!es) return []
  const skipped = /^(?:etimología|pronunciación|locuciones|refranes|véase también|referencias|traducciones|sinónimos|antónimos|anagramas|conjugación)$/i
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
    if (!text || !/\p{L}/u.test(text)) continue
    current.defs.push(text)
    if (current.defs.length >= 5) current = null
  }
  return senses.filter((sense) => sense.defs.length)
}

export function extractEnglishSenses(wikitext) {
  const en = englishSection(String(wikitext || ''))
  if (!en) return []
  const senses = []
  let current = null
  for (const line of en.split('\n')) {
    const posHit = line.match(/^===\s*([^=]+?)\s*===/)
    if (posHit) {
      // Wiktionary numbers its sections ("Etymology 1", "Noun 2"). Strip the
      // number before the skip test or every numbered Etymology leaks in as a
      // fake part of speech that swallows the next POS's definitions.
      const pos = posHit[1].trim().replace(/\s+\d+$/, '')
      const base = pos.toLowerCase()
      current = SKIP_EN_POS.has(base)
        ? null
        : /^(?:etymolog|pronunciation|translations|references)/.test(base)
          ? null
          : { pos: base, defs: [] }
      if (current) senses.push(current)
      continue
    }
    if (!current) continue
    if (!/^#(?![*:])/.test(line)) continue
    const text = cleanWikitext(line.replace(/^#+\s*/, ''))
    if (!text) continue
    current.defs.push(text)
    if (current.defs.length >= 5) current = null
  }
  return senses.filter((s) => s.defs.length)
}

function isWeak(senses) {
  if (!senses.length) return true
  const text = senses.flatMap((s) => s.defs).join(' ').toLowerCase()
  return /mauvaise orthographe|variante typographique|faute d[’']orthographe/.test(text) && senses.length === 1 && senses[0].defs.length <= 1
}

const FRENCH_LETTERS = /[àâäéèêëïîôùûüçœæ]/i

function lettersOnly(value, lang = 'fr') {
  return foldKey(value, lang).replace(lang === 'es' ? /[^a-zñ]/g : /[^a-z]/g, '')
}

export function lookupQuery(word, lang = 'fr') {
  return foldKey(word, lang)
    .replace(lang === 'es' ? /[^a-zñ'-]/g : /[^a-z'-]/g, '')
    .replace(/^[-']+|[-']+$/g, '')
}

export function rankTitles(query, titles, lang = 'fr') {
  const q = foldKey(query, lang)
  const qLetters = lettersOnly(query, lang)
  const preferredLetters = lang === 'es' ? /[áéíóúüñ]/i : FRENCH_LETTERS
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
      if (title === query || title.toUpperCase() === q) score += 16
      if (title === title.toLowerCase()) score += 10
      if (preferredLetters.test(title)) score += 8
      else if (/[^\u0000-\u007f]/.test(title)) score -= 20
      if (title.includes(' ')) score -= 25
      if (title === title.toUpperCase() && title.length > 3) score -= 4
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

function allowRate(ip) {
  const now = Date.now()
  const row = rate.get(ip) || []
  const fresh = row.filter((t) => now - t < 60_000)
  if (fresh.length >= 40) {
    rate.set(ip, fresh)
    return false
  }
  fresh.push(now)
  rate.set(ip, fresh)
  return true
}

async function wikiJson(params, wiki = WIKI_FR) {
  const url = new URL(wiki)
  for (const [k, v] of Object.entries({ format: 'json', formatversion: '2', origin: '*', ...params })) {
    url.searchParams.set(k, v)
  }
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), FETCH_MS)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: ac.signal,
    })
    if (!res.ok) throw new Error(`wiki ${res.status}`)
    return await res.json()
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
  return (data.query?.search || []).map((row) => row.title)
}

async function parsePage(title, wiki = WIKI_FR) {
  const data = await wikiJson({
    action: 'parse',
    page: title,
    prop: 'wikitext',
    redirects: '1',
  }, wiki)
  if (!data.parse?.wikitext) return null
  const wikitext = typeof data.parse.wikitext === 'string' ? data.parse.wikitext : data.parse.wikitext['*'] || ''
  return { title: data.parse.title || title, wikitext }
}

export async function lookupDefinition(word, lang = 'fr') {
  lang = lang === 'en' || lang === 'es' ? lang : 'fr'
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
  }[lang]
  const { wiki, host, source } = config

  let titles = []
  try {
    const lemma = query.toLowerCase()
    titles = rankTitles(query, [lemma, ...await searchTitles(lemma, wiki)], lang)
  } catch {
    return { ok: true, found: false, word: key, source }
  }

  for (const title of titles.slice(0, 8)) {
    try {
      const page = await parsePage(title, wiki)
      if (!page) continue
      const senses = extractSenses(page.wikitext, lang)
      if (!senses.length || isWeak(senses)) continue
      const value = {
        ok: true,
        found: true,
        word: key,
        lemma: page.title,
        senses,
        source,
        url: host + encodeURIComponent(page.title),
      }
      cacheSet(cacheKey, value)
      return value
    } catch {
      // try the next ranked title
    }
  }

  return { ok: true, found: false, word: key, source }
}

function clientIp(req) {
  return String(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown'
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
  const lang = rawLang === 'en' || rawLang === 'es' ? rawLang : 'fr'
  const result = await lookupDefinition(word, lang)
  json(res, result.ok ? 200 : 400, result, { 'Cache-Control': result.found ? 'public, max-age=86400' : 'no-store' }, req.method)
  return true
}

export function resetDefineCacheForTests() {
  cache.clear()
  rate.clear()
}
