import { t, getLang } from './i18n.js?v=56'

const CAT_KEYS = new Set(['bingo', 'long', 'hard'])

const FR_VALUES = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1,
  J: 8, K: 10, L: 1, M: 2, N: 1, O: 1, P: 3, Q: 8, R: 1,
  S: 1, T: 1, U: 1, V: 4, W: 10, X: 10, Y: 10, Z: 10,
}
const EN_VALUES = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1,
  J: 8, K: 5, L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1,
  S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10,
}

function catLabel(cat) {
  const key = CAT_KEYS.has(cat) ? `cat_${cat}` : 'cat_defi'
  return t(key)
}

export function tileValues(lang = getLang()) {
  return lang === 'en' ? EN_VALUES : FR_VALUES
}

export function letterScore(word, lang = getLang(), jokers = []) {
  const values = tileValues(lang)
  const jk = jokers instanceof Set ? jokers : new Set(jokers)
  let n = 0
  const letters = String(word || '')
  for (let i = 0; i < letters.length; i++) {
    if (jk.has(i)) continue
    n += values[letters[i]] || 0
  }
  return n
}

export function playPoints(word, baseScore) {
  return (baseScore || 0) + (String(word || '').length === 7 ? 50 : 0)
}

export function playScore(word, lang = getLang(), jokers = []) {
  return playPoints(word, letterScore(word, lang, jokers))
}

export function playPercent(pts, bestPts) {
  return Math.min(100, Math.round((100 * Number(pts || 0)) / Math.max(1, Number(bestPts || 0))))
}

export function formatAverage(n) {
  if (n == null || !Number.isFinite(Number(n))) return t('avg_empty')
  const loc = getLang() === 'en' ? 'en-GB' : 'fr-FR'
  const s = Number(n).toLocaleString(loc, { maximumFractionDigits: 1, minimumFractionDigits: 1 })
  return t('avg_score', s)
}

export function formatBoardPercent(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  const loc = getLang() === 'en' ? 'en-GB' : 'fr-FR'
  return `${Number(n).toLocaleString(loc, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`
}

function boardPercentHtml(entry) {
  const avg = formatBoardPercent(entry?.percent)
  const n = Math.max(1, Number(entry?.plays) || 1)
  if (n <= 1) return avg
  return `${avg}<small>${t('board_plays', n)}</small>`
}

const SCORE_KEY = 'ods9-defi-scores-v1'
const KIDS_SCORE_KEY = 'verimots-kids-scores-v1'
const MAX_SCORES = 24

function scoreStore(storage) {
  return storage || (typeof localStorage === 'undefined' ? null : localStorage)
}

function scoreKey(kids) {
  return kids ? KIDS_SCORE_KEY : SCORE_KEY
}

export function clampPercent(n) {
  const p = Math.round(Number(n))
  if (!Number.isFinite(p)) return null
  return Math.max(0, Math.min(100, p))
}

export function loadScores(storage, kids = false) {
  try {
    const raw = scoreStore(storage)?.getItem(scoreKey(kids))
    const rows = raw ? JSON.parse(raw) : []
    if (!Array.isArray(rows)) return []
    return rows
      .map((row) => {
        const p = clampPercent(row?.p ?? row)
        return p == null ? null : { p, at: Number(row?.at) || 0 }
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

export function rememberScore(percent, storage, kids = false) {
  const p = clampPercent(percent)
  const store = scoreStore(storage)
  const prev = loadScores(store, kids)
  if (p == null) return prev
  const next = [...prev, { p, at: Date.now() }].slice(-MAX_SCORES)
  try {
    store?.setItem(scoreKey(kids), JSON.stringify(next))
  } catch {
    /* private mode */
  }
  return next
}

export function scoreValues(scores) {
  return (scores || [])
    .map((row) => clampPercent(typeof row === 'number' ? row : row?.p))
    .filter((n) => n != null)
}

export function scoreChartSvg(scores, opts = {}) {
  const w = opts.w || 168
  const h = opts.h || 36
  const padL = 14
  const padR = 4
  const padT = 5
  const padB = 5
  const pts = scoreValues(scores)
  const innerW = Math.max(1, w - padL - padR)
  const innerH = Math.max(1, h - padT - padB)
  const yAt = (p) => padT + (1 - p / 100) * innerH
  const axis = [0, 50, 100]
    .map((p) => {
      const y = yAt(p).toFixed(1)
      return `<line class="axis${p === 50 ? ' mid' : ''}" x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}"/>`
    })
    .join('')
  const ticks = `<text class="tick" x="0" y="${(yAt(100) + 3).toFixed(1)}">100</text>
    <text class="tick" x="0" y="${(yAt(0) + 3).toFixed(1)}">0</text>`
  if (!pts.length) {
    return `<svg class="score-chart" viewBox="0 0 ${w} ${h}" aria-hidden="true">${axis}${ticks}</svg>`
  }
  const n = pts.length
  const xy = pts.map((p, i) => {
    const x = padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW)
    return [x, yAt(p)]
  })
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const base = yAt(0).toFixed(1)
  const area = `M${xy[0][0].toFixed(1)} ${base} ${xy.map(([x, y]) => `L${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')} L${xy.at(-1)[0].toFixed(1)} ${base} Z`
  const dots = xy
    .map(
      ([x, y], i) =>
        `<circle class="dot${i === n - 1 ? ' last' : ''}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${i === n - 1 ? 3.1 : 1.8}"/>`
    )
    .join('')
  return `<svg class="score-chart" viewBox="0 0 ${w} ${h}" aria-hidden="true">${axis}${ticks}<path class="area" d="${area}"/><path class="line" d="${d}"/>${dots}</svg>`
}

export function parseRack(raw) {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 7)
}

export function defiShareText(rack, percent) {
  const tiles = [...rack].join(' ')
  const score = percent != null ? `\n${t('share_game_score', percent)}` : '\n'
  return `${t('share_game_title')}\n\n${t('share_game_body')}\n${tiles}\n${score}`
}

export function isInflectionDef(text) {
  return /personne du|impératif de|participe |pluriel de|féminin de|masculin de|singulier de|forme de /i.test(
    String(text || '')
  )
}

const DEF_STOP = new Set([
  'ainsi', 'alors', 'apres', 'aussi', 'autre', 'autres', 'avant', 'avec', 'avoir',
  'chez', 'comme', 'contre', 'dans', 'depuis', 'des', 'donc', 'dont', 'entre',
  'est', 'etre', 'fait', 'faire', 'les', 'lors', 'mais', 'meme', 'moins', 'ont',
  'parmi', 'pas', 'pendant', 'plus', 'pour', 'quand', 'que', 'qui', 'sans',
  'selon', 'sont', 'sous', 'sur', 'tout', 'toute', 'toutes', 'tous', 'tres',
  'une', 'vers',
])

export function extractFormOf(text) {
  const s = String(text || '')
  const patterns = [
    /du verbe\s+([A-Za-zÀ-ÿŒœ][A-Za-zÀ-ÿŒœ'-]{1,20})/i,
    /impératif de\s+([A-Za-zÀ-ÿŒœ][A-Za-zÀ-ÿŒœ'-]{1,20})/i,
    /pluriel de(?: l['’](?:adjectif|nom|article))?\s+([A-Za-zÀ-ÿŒœ][A-Za-zÀ-ÿŒœ'-]{1,20})/i,
    /féminin de(?: l['’]adjectif)?\s+([A-Za-zÀ-ÿŒœ][A-Za-zÀ-ÿŒœ'-]{1,20})/i,
    /masculin de\s+([A-Za-zÀ-ÿŒœ][A-Za-zÀ-ÿŒœ'-]{1,20})/i,
    /singulier de\s+([A-Za-zÀ-ÿŒœ][A-Za-zÀ-ÿŒœ'-]{1,20})/i,
    /participe (?:passé|présent)\b(?:[^.]{0,40}?)(?:du verbe|de)\s+([A-Za-zÀ-ÿŒœ][A-Za-zÀ-ÿŒœ'-]{1,20})/i,
    /plural of\s+([A-Za-zÀ-ÿŒœ][A-Za-zÀ-ÿŒœ'-]{1,20})/i,
    /(?:simple )?past(?: tense)? of\s+([A-Za-zÀ-ÿŒœ][A-Za-zÀ-ÿŒœ'-]{1,20})/i,
    /present participle of\s+([A-Za-zÀ-ÿŒœ][A-Za-zÀ-ÿŒœ'-]{1,20})/i,
    /(?:third-person singular|3rd-person singular)(?: present)? of\s+([A-Za-zÀ-ÿŒœ][A-Za-zÀ-ÿŒœ'-]{1,20})/i,
    /(?:comparative|superlative)(?: form)? of\s+([A-Za-zÀ-ÿŒœ][A-Za-zÀ-ÿŒœ'-]{1,20})/i,
  ]
  for (const re of patterns) {
    const m = s.match(re)
    if (m?.[1]) return m[1].replace(/[.,;:]+$/, '')
  }
  return ''
}

function foldWord(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
}

export function wikiUrl(word, lemma) {
  const title = lemma || String(word || '').toLowerCase()
  const host = getLang() === 'en' ? 'en.wiktionary.org' : 'fr.wiktionary.org'
  return `https://${host}/wiki/${encodeURIComponent(title)}`
}

export function topWords(catalog, played, n = 5) {
  const list = []
  const seen = new Set()
  for (const entry of catalog || []) {
    if (!entry?.word || seen.has(entry.word)) continue
    seen.add(entry.word)
    list.push(entry)
    if (list.length >= n) break
  }
  if (played?.word && !seen.has(played.word)) list.push(played)
  return list
}

export function linkifyDef(text, escapeHtml) {
  const raw = String(text || '')
  const root = extractFormOf(raw)
  if (root) {
    const safe = escapeHtml(raw)
    const re = new RegExp(`(${root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'i')
    return safe.replace(
      re,
      `<button type="button" class="form-of" data-form-of="${escapeHtml(root)}">$1</button>`
    )
  }
  return raw.replace(/([A-Za-zÀ-ÿŒœ][A-Za-zÀ-ÿŒœ''’-]*)|([^A-Za-zÀ-ÿŒœ]+)/g, (all, word, sep) => {
    if (sep != null) return escapeHtml(sep)
    const folded = foldWord(word)
    if (folded.length < 4 || DEF_STOP.has(folded)) return escapeHtml(word)
    return `<button type="button" class="form-of" data-form-of="${escapeHtml(word)}">${escapeHtml(word)}</button>`
  })
}

function usedTiles(tiles, word) {
  const used = new Set()
  for (const ch of word) {
    const i = [...tiles].findIndex((t, idx) => t === ch && !used.has(idx))
    if (i >= 0) used.add(i)
  }
  return used
}

function guessCategory(list, tiles) {
  const top = list[0]
  if (!top) return 'bingo'
  if (top.word.length === 7) return 'bingo'
  if (tiles.length <= 5) return 'hard'
  if (top.word.length >= 6) return 'long'
  return 'hard'
}

export function backBtn(word, escapeHtml) {
  if (!word) return ''
  return `<button type="button" class="def-back" data-def-back="${escapeHtml(word)}">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15.4 6.4 10.8 11l4.6 4.6L14 17l-6-6 6-6z"/></svg>
    ${escapeHtml(word)}
  </button>`
}

function srcLine(payload, escapeHtml) {
  if (!payload) return ''
  const title = payload.lemma || payload.word
  if (!title) return ''
  const href = payload.url || wikiUrl(payload.word, payload.lemma)
  const label = payload.found ? t('wiki_open') : t('wiki_search')
  return `<p class="defs-src"><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${label}</a></p>`
}

function defBody(payload, escapeHtml, extra = {}) {
  if (!payload) return `<p class="pending">${t('def_pending')}</p>`
  if (!payload.found || !payload.senses?.length) {
    return `<p class="empty">${
      payload.offline ? t('def_need_net') : t('def_missing')
    }</p>${srcLine(payload, escapeHtml)}`
  }
  const blob = payload.senses.flatMap((s) => s.defs).join(' ')
  const formOf = extra.formOf || extractFormOf(blob)
  const inflection = payload.senses.every((s) => s.defs.every(isInflectionDef))
  if (inflection && formOf && extra.root) {
    const note = `<p class="form-of-line">${t('form_of')} <button type="button" class="form-of" data-form-of="${escapeHtml(formOf)}">${escapeHtml(formOf)}</button></p>`
    if (extra.root.found) return note + defBody(extra.root, escapeHtml, { asRoot: true })
    return `${note}<p class="empty">${t('def_missing_of', formOf)}</p>${srcLine(payload, escapeHtml)}`
  }
  if (inflection && formOf && !extra.asRoot) {
    return `<p class="form-of-line">${t('form_of')} <button type="button" class="form-of" data-form-of="${escapeHtml(formOf)}">${escapeHtml(formOf)}</button></p>
      <p class="pending">${t('sense_of', formOf)}</p>`
  }
  const sense = payload.senses[0]
  const defs = (sense.defs || []).slice(0, extra.asRoot ? 2 : 1)
  return `${sense.pos ? `<div class="pos">${escapeHtml(sense.pos)}</div>` : ''}
    <ol>${defs.map((d) => `<li>${linkifyDef(d, escapeHtml)}</li>`).join('')}</ol>
    ${srcLine(payload, escapeHtml)}`
}

const KIDS_FOUND_KEY = 'verimots-kids-found-v1'

export function loadKidsFound(storage) {
  try {
    const n = Number((storage || localStorage)?.getItem(KIDS_FOUND_KEY))
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  } catch {
    return 0
  }
}

export function rememberKidsFound(storage) {
  const n = loadKidsFound(storage) + 1
  try {
    ;(storage || localStorage)?.setItem(KIDS_FOUND_KEY, String(n))
  } catch {
    /* private mode */
  }
  return n
}

export function initGame({ ask, tilesHtml, escapeHtml, normalize, ready, define, isCompetitive, isKids, onDeal, onPlayed }) {
  const rackEl = document.getElementById('game-rack')
  const catEl = document.getElementById('game-cat')
  const form = document.getElementById('game-form')
  const input = document.getElementById('game-q')
  const liveEl = document.getElementById('game-live')
  const resultEl = document.getElementById('game-result')
  const globalEl = document.getElementById('game-global')
  const waEl = document.getElementById('game-wa')
  const chartEl = document.getElementById('game-chart')
  const modeSwitch = document.getElementById('game-mode-switch')
  const authEl = document.getElementById('game-auth')
  const userEl = document.getElementById('game-user')
  const boardEl = document.getElementById('game-board')
  const modeDefi = document.getElementById('mode-defi')
  const modeKids = document.getElementById('mode-kids')
  const modeComp = document.getElementById('mode-comp')
  const hintBtn = document.getElementById('game-hint')

  let rack = ''
  let catalog = []
  let best = null
  let category = 'bingo'
  let closed = false
  let officialPlay = false
  let kidsSeed = ''
  let hintLevel = 0

  function kidsOn() {
    return typeof isKids === 'function' ? isKids() : !!isKids
  }

  function setClosed(on) {
    closed = on
    document.body.classList.toggle('game-closed', on)
  }

  function challengeUrl() {
    const u = new URL(location.origin + location.pathname)
    u.searchParams.set('vue', 'jeu')
    if (rack) u.searchParams.set('d', rack)
    if (category) u.searchParams.set('c', category)
    return u.toString()
  }

  function waHref(percent) {
    const text = `${defiShareText(rack, percent)}${challengeUrl()}`
    return `https://wa.me/?text=${encodeURIComponent(text)}`
  }

  function paintShare(percent) {
    if (!waEl) return
    if (!rack) {
      waEl.classList.add('is-off')
      waEl.removeAttribute('href')
      return
    }
    waEl.classList.remove('is-off')
    waEl.href = waHref(percent)
  }

  function paintChart(rows, kids) {
    if (!chartEl) return
    chartEl.hidden = false
    const dock = document.getElementById('game-dock')
    if (dock) dock.hidden = false
    const scores = rows || loadScores(null, kids == null ? kidsOn() : !!kids)
    const last = scores.at(-1)
    chartEl.innerHTML = `${scoreChartSvg(scores)}${
      last ? `<span class="game-chart-last">${last.p}<small>/100</small></span>` : ''
    }`
    chartEl.setAttribute(
      'aria-label',
      last ? t('chart_last', last.p) : t('chart_empty')
    )
  }

  function paintKidsMeta() {
    if (globalEl) globalEl.textContent = t('kids_found', loadKidsFound())
    if (waEl) waEl.classList.add('is-off')
    paintChart(loadScores(null, true))
  }

  async function paintGlobal() {
    if (kidsOn()) {
      paintKidsMeta()
      return
    }
    if (waEl) waEl.classList.remove('is-off')
    paintChart()
    try {
      const res = await fetch('/api/game/stats')
      const data = await res.json()
      if (data?.ok && data.plays) globalEl.textContent = formatAverage(data.average)
      else globalEl.textContent = t('avg_empty')
    } catch {
      globalEl.textContent = t('avg_empty')
    }
  }

  function catalogFrom(groups) {
    const lang = getLang()
    const list = []
    for (const g of groups || []) {
      for (const entry of g.words) {
        const jokers = entry.jokers || []
        list.push({ word: entry.word, pts: playScore(entry.word, lang, jokers), jokers })
      }
    }
    list.sort((a, b) => b.pts - a.pts || b.word.length - a.word.length)
    return list
  }

  function paintRack() {
    const used = usedTiles(rack, normalize(input.value))
    rackEl.dataset.n = String(rack.length)
    rackEl.innerHTML = tilesHtml(rack, [], { tap: !closed })
    rackEl.querySelectorAll('.tile').forEach((el, i) => {
      if (used.has(i)) el.classList.add('used')
    })
  }

  function setLive(text, kind) {
    liveEl.textContent = text || ''
    liveEl.className = kind ? `game-live ${kind}` : 'game-live'
  }

  function applyDeal(tiles, cat, groups, seed = '') {
    rack = tiles
    catalog = catalogFrom(groups)
    best = catalog[0] || null
    kidsSeed = String(seed || '').toUpperCase()
    hintLevel = 0
    category = cat === 'kids' || kidsOn() ? 'kids' : CAT_KEYS.has(cat) ? cat : guessCategory(catalog, tiles)
    catEl.textContent = category === 'kids' ? t('kids_cat') : catLabel(category)
    input.maxLength = rack.length || 7
    form.hidden = false
    if (hintBtn) {
      hintBtn.hidden = category !== 'kids' || closed
      hintBtn.disabled = false
      hintBtn.textContent = t('kids_hint')
    }
    paintRack()
    if (category === 'kids') {
      if (waEl) waEl.classList.add('is-off')
    } else {
      paintShare()
    }
    onDeal?.(rack, category)
  }

  async function deal(forced, forcedCat, opts = {}) {
    setClosed(false)
    officialPlay = !!opts.official
    if (opts.seed) kidsSeed = String(opts.seed).toUpperCase()
    form.hidden = false
    resultEl.hidden = true
    resultEl.innerHTML = ''
    resultEl.className = 'game-result'
    input.disabled = false
    input.value = ''
    setLive('')
    if (!ready()) {
      setLive(t('loading_lex'))
      return
    }
    setLive(t('loading_deal'))
    const wanted = parseRack(forced)
    let tiles = ''
    let cat = ''
    let groups = []
    let seed = ''
    try {
      if (kidsOn()) {
        const res = wanted.length >= 2
          ? await ask('anagram', { rack: wanted, min: 2, max: wanted.length })
          : await ask('kids')
        if (res.lang && res.lang !== getLang()) throw new Error('stale')
        if (wanted.length >= 2) {
          tiles = wanted
          cat = 'kids'
          seed = opts.seed || kidsSeed || ''
        } else {
          if (!res?.rack) throw new Error('empty')
          tiles = res.rack
          cat = 'kids'
          seed = res.seed || ''
        }
        groups = res.groups || []
      } else if (wanted.length >= 2) {
        const res = await ask('anagram', { rack: wanted, min: 2, max: wanted.length })
        if (res.lang && res.lang !== getLang()) throw new Error('stale')
        tiles = wanted
        cat = forcedCat || ''
        groups = res.groups || []
      } else {
        const res = await ask('challenge')
        if (res.lang && res.lang !== getLang()) throw new Error('stale')
        if (!res?.rack) throw new Error('empty')
        tiles = res.rack
        cat = res.category || ''
        groups = res.groups || []
      }
    } catch {
      setLive(t('deal_fail'))
      return
    }
    applyDeal(tiles, cat, groups, seed)
    setLive('')
    input.focus()
  }

  function preview() {
    if (closed) return
    paintRack()
    const word = normalize(input.value)
    if (!word) {
      setLive('')
      return
    }
    const hit = catalog.find((w) => w.word === word)
    if (hit) setLive(`${hit.pts} pts`, 'ok')
    else if (word.length >= 2) setLive(t('not_on_rack'), 'bad')
    else setLive('')
  }

  function giveHint() {
    if (closed || !kidsOn() || !hintBtn) return
    const target = catalog.find((w) => w.word === kidsSeed) || best || catalog[0]
    if (!target) return
    hintLevel = Math.min(2, hintLevel + 1)
    if (hintLevel === 1) setLive(t('kids_hint_letter', target.word[0]), 'ok')
    else {
      setLive(t('kids_hint_word', target.word), 'ok')
      hintBtn.disabled = true
    }
  }

  async function resolvedDef(word) {
    if (!define) return { payload: { found: false }, formOf: '', root: null }
    const payload = await define(word, { stable: true })
    const blob = (payload?.senses || []).flatMap((s) => s.defs).join(' ')
    const formOf = extractFormOf(blob)
    const inflection = payload?.found && (payload.senses || []).every((s) => s.defs.every(isInflectionDef))
    let root = null
    if (inflection && formOf) root = await define(formOf, { stable: true })
    return { payload, formOf, root }
  }

  function paintDef(id, resolved) {
    const box = resultEl.querySelector(id)
    if (!box) return
    box._home = resolved
    box.innerHTML = defBody(resolved.payload, escapeHtml, { formOf: resolved.formOf, root: resolved.root })
  }

  async function validate(raw) {
    if (closed) return
    const word = normalize(raw)
    const hit = catalog.find((w) => w.word === word)
    if (!hit) {
      setLive(word.length < 2 ? (kidsOn() ? t('kids_need') : t('need_best')) : t('not_playable'), 'bad')
      rackEl.classList.remove('shake')
      void rackEl.offsetWidth
      rackEl.classList.add('shake')
      return
    }
    setClosed(true)
    input.disabled = true
    form.hidden = true
    if (hintBtn) hintBtn.hidden = true
    paintRack()
    const max = best?.pts || hit.pts
    const percent = playPercent(hit.pts, max)
    const same = best && best.word === hit.word
    resultEl.hidden = false
    resultEl.className = `game-result ${percent >= 100 ? 'hot' : percent >= 60 ? 'warm' : ''}`
    const vs = same
      ? t('best_word')
      : percent >= 100
        ? t('tied', escapeHtml(best.word), best.pts)
        : t('top_word', escapeHtml(best.word), best.pts)
    const tops = topWords(catalog, hit, 5)
    const start = Math.max(0, tops.findIndex((w) => w.word === hit.word))
    const shown = new Map()
    resultEl.innerHTML = `
      <div class="game-score">
        <div class="game-pct">${percent}<small>%</small></div>
        <div class="game-score-words">
          <p class="game-break"><strong>${escapeHtml(hit.word)}</strong> ${hit.pts}</p>
          <p class="game-vs">${vs}</p>
        </div>
      </div>
      <div class="game-top" role="tablist" aria-label="${escapeHtml(t('best_words'))}">
        ${tops
          .map(
            (w, i) => `<button type="button" role="tab" data-def-tab="${i}" data-def-word="${escapeHtml(w.word)}" aria-selected="${i === start ? 'true' : 'false'}" class="${w.word === hit.word ? 'is-mine' : ''}">
          <span class="game-top-word">${escapeHtml(w.word)}</span>
          <span class="game-top-pts">${w.pts}</span>
        </button>`
          )
          .join('')}
      </div>
      <button type="button" class="game-again" id="game-again">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8.6 5.4 14.2 12 8.6 18.6 10.1 20l7.1-8-7.1-8z"/></svg>
        ${t('again')}
      </button>
      <div class="game-def-panel">
        <div class="game-def-body" id="def-body">${defBody(null, escapeHtml)}</div>
      </div>`
    setLive('')
    if (kidsOn()) {
      rememberKidsFound()
      if (waEl) waEl.classList.add('is-off')
      paintChart(rememberScore(percent, null, true))
      if (globalEl) globalEl.textContent = t('kids_found', loadKidsFound())
    } else {
      paintShare(percent)
      paintChart(rememberScore(percent))
    }
    onPlayed?.({ word: hit.word, pts: hit.pts, best: best?.word || kidsSeed, bestPts: best?.pts })
    resultEl.querySelector('#game-again')?.addEventListener('click', () => deal())

    async function showTop(word) {
      if (!define || !word) return
      if (shown.has(word)) {
        paintDef('#def-body', shown.get(word))
        return
      }
      const box = resultEl.querySelector('#def-body')
      if (box) box.innerHTML = defBody(null, escapeHtml)
      const resolved = await resolvedDef(word)
      shown.set(word, resolved)
      if (closed) paintDef('#def-body', resolved)
    }

    resultEl.querySelectorAll('[data-def-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        resultEl.querySelectorAll('[data-def-tab]').forEach((b) =>
          b.setAttribute('aria-selected', b === btn ? 'true' : 'false')
        )
        showTop(btn.dataset.defWord)
      })
    })
    if (define) await showTop(tops[start]?.word)
    try {
      if (kidsOn()) {
        const { submitCompete, fetchLeaderboard, getCurrentUser } = await import('./competitive.js?v=56')
        if (getCurrentUser()) {
          await submitCompete(percent, hit.word, getLang(), { kids: true, rack })
        }
        officialPlay = false
        lastKidsBoard = await fetchLeaderboard(null, getLang(), { kids: true })
        paintLeaderboard()
      } else if (isCompetitive && isCompetitive()) {
        const { submitCompete, fetchLeaderboard, getTrailData } = await import('./competitive.js?v=56')
        if (officialPlay) {
          await submitCompete(percent, hit.word, getLang())
          officialPlay = false
        }
        const trail = getTrailData()
        paintLeaderboard(await fetchLeaderboard(trail?.trailId, getLang()))
      } else {
        const res = await fetch('/api/game/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ percent }),
        })
        const data = await res.json()
        if (data?.ok) globalEl.textContent = formatAverage(data.average)
      }
    } catch {
      /* offline */
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    validate(input.value)
  })
  hintBtn?.addEventListener('click', () => giveHint())
  input.addEventListener('input', preview)
  rackEl.addEventListener('click', (e) => {
    if (closed) return
    const tile = e.target.closest('[data-rack-i]')
    if (!tile) return
    const i = Number(tile.dataset.rackI)
    const ch = rack[i]
    if (!ch) return
    const word = normalize(input.value)
    const used = usedTiles(rack, word)
    if (used.has(i)) {
      const cut = word.lastIndexOf(ch)
      if (cut >= 0) input.value = word.slice(0, cut) + word.slice(cut + 1)
    } else {
      input.value = word + ch
    }
    preview()
    input.focus()
  })
  resultEl.addEventListener('click', async (e) => {
    const back = e.target.closest('[data-def-back]')
    if (back) {
      const box = back.closest('.game-def-body')
      if (box?._home) paintDef(`#${box.id}`, box._home)
      return
    }
    const btn = e.target.closest('[data-form-of]')
    if (!btn || !define) return
    const root = btn.dataset.formOf
    const box = btn.closest('.game-def-body')
    if (!box || !root) return
    const homeWord = box._home?.payload?.word || box.dataset.originWord || ''
    box.innerHTML = `<p class="pending">${t('sense_of', escapeHtml(root))}</p>`
    const resolved = await resolvedDef(root)
    if (closed) {
      box.innerHTML = `${backBtn(homeWord, escapeHtml)}${defBody(resolved.payload, escapeHtml, { asRoot: true })}`
    }
  })

  async function switchMode(mode) {
    if (!modeSwitch) return
    const competitive = mode === true || mode === 'competitive'
    const kids = mode === 'kids'
    const next = competitive ? 'competitive' : kids ? 'kids' : 'defi'
    boardTab = next === 'kids' ? 'kids' : 'adult'
    document.body.classList.toggle('kids', next === 'kids')
    modeDefi?.setAttribute('aria-pressed', next === 'defi' ? 'true' : 'false')
    modeKids?.setAttribute('aria-pressed', next === 'kids' ? 'true' : 'false')
    modeComp?.setAttribute('aria-pressed', next === 'competitive' ? 'true' : 'false')
    if (hintBtn) hintBtn.hidden = next !== 'kids'
    if (next === 'competitive' || next === 'kids') {
      await initRanked(next === 'kids')
      return
    }
    if (authEl) authEl.hidden = true
    if (userEl) userEl.hidden = true
    paintGlobal()
    await deal()
  }

  async function initCompetitive() {
    return initRanked(false)
  }

  async function initRanked(kids) {
    const { initGoogleSignIn, checkSession, getCurrentUser, handleGoogleCallback, fetchDailyTrail, fetchLeaderboard } = await import('./competitive.js?v=56')
    
    const user = await checkSession()
    if (user) {
      if (authEl) authEl.hidden = true
      if (userEl) {
        userEl.hidden = false
        const pic = document.getElementById('user-pic')
        const name = document.getElementById('user-name')
        if (pic) {
          const src = String(user.picture || '')
          pic.hidden = !src
          pic.onerror = () => {
            pic.removeAttribute('src')
            pic.hidden = true
          }
          if (src) pic.src = src
          else pic.removeAttribute('src')
        }
        if (name) name.textContent = user.name || t('user_fallback')
        const statsEl = document.getElementById('user-stats')
        if (statsEl) {
          const s = user.stats || {}
          const bits = []
          if (s.streak) bits.push(t('streak_d', s.streak))
          if (s.best) bits.push('best ' + s.best + ' %')
          if (s.words) bits.push(t('words_n', s.words))
          statsEl.textContent = bits.join(' · ')
        }
        document.dispatchEvent(new CustomEvent('verimots-auth', { detail: user }))
      }
    } else {
      if (userEl) userEl.hidden = true
      if (authEl) authEl.hidden = false
      await initGoogleSignIn()
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: '617674779621-vu2iv3rjfcs08nrf5m6apn2ivnh9rim7.apps.googleusercontent.com',
          callback: async (response) => {
            const result = await handleGoogleCallback(response)
            if (result.ok) {
              await switchMode(kids ? 'kids' : 'competitive')
            }
          }
        })
        const btn = document.getElementById('google-signin-btn')
        if (btn) {
          btn.innerHTML = ''
          window.google.accounts.id.renderButton(btn, {
            theme: 'filled_blue',
            size: 'large',
            text: 'signin_with',
            locale: getLang() === 'en' ? 'en' : 'fr'
          })
        }
      }
    }

    const trail = await fetchDailyTrail(getLang(), { kids })
    lastBoard = await fetchLeaderboard(null, getLang())
    lastKidsBoard = await fetchLeaderboard(null, getLang(), { kids: true })
    paintLeaderboard()
    const mine = kids ? lastKidsBoard : lastBoard
    if (kids) paintKidsMeta()
    if (mine?.me) {
      await deal()
    } else if (trail?.rack) {
      await deal(trail.rack, kids ? 'kids' : trail.category, { official: true, seed: trail.seed })
    }
  }

  let lastBoard = null
  let lastKidsBoard = null
  let boardTab = null

  function kidsBoardTab() {
    if (boardTab === 'kids' || boardTab === 'adult') return boardTab === 'kids'
    return kidsOn()
  }

  function boardBlock(empty, data) {
    if (!data) {
      return `<p class="board-empty">${escapeHtml(empty)}</p>`
    }
    if (!data.ok) {
      return `<p class="board-empty">${escapeHtml(t('board_unavailable'))}</p>`
    }
    const top = Array.isArray(data.top) ? data.top.slice(0, 10) : []
    if (!top.length) {
      return `<p class="board-empty">${escapeHtml(empty)}</p>`
    }
    const me = data.me
    const rows = top.map((entry) => {
      const isMeRow = me && entry.rank === me.rank
      return `<div class="board-row${isMeRow ? ' is-me' : ''}">
        <span class="board-rank">${entry.rank}</span>
        <span class="board-name">${escapeHtml(entry.pseudo)}</span>
        <span class="board-word">${entry.word ? escapeHtml(entry.word) : ''}</span>
        <span class="board-percent">${boardPercentHtml(entry)}</span>
      </div>`
    })
    if (me && me.rank > 10) {
      rows.push(`<div class="board-row is-me">
        <span class="board-rank">${me.rank}</span>
        <span class="board-name">${escapeHtml(me.pseudo)}</span>
        <span class="board-word">${me.word ? escapeHtml(me.word) : ''}</span>
        <span class="board-percent">${boardPercentHtml(me)}</span>
      </div>`)
    }
    return `<div class="board-list">${rows.join('')}</div>`
  }

  function paintLeaderboard(board) {
    if (!boardEl) return
    if (board) {
      if (board.kids) lastKidsBoard = board
      else lastBoard = board
    }
    const kidsTab = kidsBoardTab()
    const data = kidsTab ? lastKidsBoard : lastBoard
    const empty = kidsTab ? t('kids_board_empty') : t('board_empty')
    boardEl.innerHTML = `
      <p class="board-title">${escapeHtml(t('board_title'))}</p>
      <div class="board-switch" role="tablist" aria-label="${escapeHtml(t('board_title'))}">
        <button type="button" role="tab" class="mode-btn" data-board-tab="adult" aria-selected="${kidsTab ? 'false' : 'true'}" aria-pressed="${kidsTab ? 'false' : 'true'}">${escapeHtml(t('board_general'))}</button>
        <button type="button" role="tab" class="mode-btn" data-board-tab="kids" aria-selected="${kidsTab ? 'true' : 'false'}" aria-pressed="${kidsTab ? 'true' : 'false'}">${escapeHtml(t('kids_board'))}</button>
      </div>
      ${boardBlock(empty, data)}`
    boardEl.querySelectorAll('[data-board-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        boardTab = btn.dataset.boardTab
        paintLeaderboard()
      })
    })
    if (waEl) waEl.classList.add('is-off')
    paintChart(loadScores(null, kidsTab), kidsTab)
  }

  function paintChrome() {
    if (catEl) catEl.textContent = category === 'kids' || kidsOn() ? t('kids_cat') : catLabel(category)
    if (modeDefi) modeDefi.textContent = t('mode_defi')
    if (modeKids) modeKids.textContent = t('mode_kids')
    if (modeComp) modeComp.textContent = t('mode_comp')
    if (hintBtn) {
      hintBtn.textContent = t('kids_hint')
      hintBtn.hidden = !kidsOn() || closed
    }
    const authHelp = document.querySelector('#game-auth .auth-help')
    if (authHelp) authHelp.textContent = t('auth_help')
    const logout = document.getElementById('logout-btn')
    if (logout) logout.textContent = t('sign_out')
    if (input) {
      input.placeholder = t('play_hint')
      const lab = document.querySelector('label[for="game-q"]')
      if (lab) lab.textContent = kidsOn() ? t('kids_play') : t('play_label')
    }
    if (lastBoard || lastKidsBoard) paintLeaderboard()
    if (closed) {
      const again = document.getElementById('game-again')
      if (again) {
        const svg = again.querySelector('svg')
        again.textContent = ''
        if (svg) again.appendChild(svg)
        again.append(' ' + t('again'))
      }
    } else {
      preview()
    }
  }

  async function refresh() {
    paintChrome()
    paintGlobal()
    if (kidsOn()) {
      await initRanked(true)
      return
    }
    if (isCompetitive && isCompetitive()) {
      try {
        const { fetchDailyTrail, fetchLeaderboard } = await import('./competitive.js?v=56')
        const trail = await fetchDailyTrail(getLang())
        const board = await fetchLeaderboard(trail?.trailId, getLang())
        paintLeaderboard(board)
        if (trail?.rack && !board?.me) {
          await deal(trail.rack, trail.category, { official: true })
        } else {
          await deal()
        }
      } catch {
        /* keep current */
      }
      return
    }
    if (!rack || !ready()) return
    try {
      const res = await ask('anagram', { rack, min: 2, max: rack.length })
      if (res.lang && res.lang !== getLang()) return
      applyDeal(rack, category, res.groups || [])
      setClosed(false)
      form.hidden = false
      resultEl.hidden = true
      resultEl.innerHTML = ''
      input.disabled = false
    } catch {
      /* keep current catalog */
    }
  }

  document.addEventListener('verimots-lang', () => {
    paintChrome()
  })

  return {
    async open(opts = {}) {
      if (isCompetitive && isCompetitive()) {
        await switchMode('competitive')
      } else if (kidsOn()) {
        await switchMode('kids')
      } else {
        await switchMode('defi')
        const fromUrl = parseRack(opts.rack)
        if (fromUrl.length >= 2 && fromUrl !== rack) await deal(fromUrl, opts.category)
      }
      input.focus()
    },
    async showBoard() {
      const { fetchLeaderboard } = await import('./competitive.js?v=56')
      lastBoard = await fetchLeaderboard(null, getLang())
      lastKidsBoard = await fetchLeaderboard(null, getLang(), { kids: true })
      paintLeaderboard()
    },
    refresh,
    deal,
    switchMode,
  }
}
