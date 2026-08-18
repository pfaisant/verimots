const LABELS = {
  bingo: 'Bingo',
  long: 'Mot long',
  hard: 'Lettres dures',
}

export function playPoints(word, baseScore) {
  return (baseScore || 0) + (String(word || '').length === 7 ? 50 : 0)
}

export function formatAverage(n) {
  if (n == null || !Number.isFinite(Number(n))) return 'Score moyen —'
  return `Score moyen ${String(n).replace('.', ',')} %`
}

const SCORE_KEY = 'ods9-defi-scores-v1'
const MAX_SCORES = 24

function scoreStore(storage) {
  return storage || (typeof localStorage === 'undefined' ? null : localStorage)
}

export function clampPercent(n) {
  const p = Math.round(Number(n))
  if (!Number.isFinite(p)) return null
  return Math.max(0, Math.min(100, p))
}

export function loadScores(storage) {
  try {
    const raw = scoreStore(storage)?.getItem(SCORE_KEY)
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

export function rememberScore(percent, storage) {
  const p = clampPercent(percent)
  const store = scoreStore(storage)
  const prev = loadScores(store)
  if (p == null) return prev
  const next = [...prev, { p, at: Date.now() }].slice(-MAX_SCORES)
  try {
    store?.setItem(SCORE_KEY, JSON.stringify(next))
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
  const score = percent != null ? `\nJ'ai fait ${percent} %.\n` : '\n'
  return `Verimots — Défi\n\nTrouve le mot le plus cher avec :\n${tiles}\n${score}`
}

export function isInflectionDef(text) {
  return /personne du|impératif de|participe |pluriel de|féminin de|masculin de|singulier de/i.test(
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
  return `https://fr.wiktionary.org/wiki/${encodeURIComponent(title)}`
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
  const label = payload.found ? 'Ouvrir dans le Wiktionnaire' : 'Chercher sur le Wiktionnaire'
  return `<p class="defs-src"><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${label}</a></p>`
}

function defBody(payload, escapeHtml, extra = {}) {
  if (!payload) return `<p class="pending">Définition…</p>`
  if (!payload.found || !payload.senses?.length) {
    return `<p class="empty">${
      payload.offline ? 'Définition disponible avec une connexion.' : 'Pas de définition Wiktionnaire.'
    }</p>${srcLine(payload, escapeHtml)}`
  }
  const blob = payload.senses.flatMap((s) => s.defs).join(' ')
  const formOf = extra.formOf || extractFormOf(blob)
  const inflection = payload.senses.every((s) => s.defs.every(isInflectionDef))
  if (inflection && formOf && extra.root) {
    const note = `<p class="form-of-line">Forme de <button type="button" class="form-of" data-form-of="${escapeHtml(formOf)}">${escapeHtml(formOf)}</button></p>`
    if (extra.root.found) return note + defBody(extra.root, escapeHtml, { asRoot: true })
    return `${note}<p class="empty">Pas de définition pour ${escapeHtml(formOf)}.</p>${srcLine(payload, escapeHtml)}`
  }
  if (inflection && formOf && !extra.asRoot) {
    return `<p class="form-of-line">Forme de <button type="button" class="form-of" data-form-of="${escapeHtml(formOf)}">${escapeHtml(formOf)}</button></p>
      <p class="pending">Sens de ${escapeHtml(formOf)}…</p>`
  }
  const sense = payload.senses[0]
  const defs = (sense.defs || []).slice(0, extra.asRoot ? 2 : 1)
  return `${sense.pos ? `<div class="pos">${escapeHtml(sense.pos)}</div>` : ''}
    <ol>${defs.map((d) => `<li>${linkifyDef(d, escapeHtml)}</li>`).join('')}</ol>
    ${srcLine(payload, escapeHtml)}`
}

export function initGame({ ask, tilesHtml, escapeHtml, normalize, ready, define, isCompetitive, onDeal, onPlayed }) {
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
  const modeComp = document.getElementById('mode-comp')

  let rack = ''
  let catalog = []
  let best = null
  let category = 'bingo'
  let closed = false

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

  function paintChart(rows) {
    if (!chartEl) return
    const scores = rows || loadScores()
    const last = scores.at(-1)
    chartEl.innerHTML = `${scoreChartSvg(scores)}${
      last ? `<span class="game-chart-last">${last.p}<small>/100</small></span>` : ''
    }`
    chartEl.setAttribute(
      'aria-label',
      last
        ? `Vos scores, dernier ${last.p} sur 100`
        : 'Vos scores sur 100 — aucune partie encore'
    )
  }

  async function paintGlobal() {
    paintChart()
    try {
      const res = await fetch('/api/game/stats')
      const data = await res.json()
      if (data?.ok && data.plays) globalEl.textContent = formatAverage(data.average)
      else globalEl.textContent = 'Score moyen —'
    } catch {
      globalEl.textContent = 'Score moyen —'
    }
  }

  function catalogFrom(groups) {
    const list = []
    for (const g of groups || []) {
      for (const entry of g.words) {
        list.push({ word: entry.word, pts: playPoints(entry.word, entry.score), jokers: entry.jokers || [] })
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

  function applyDeal(tiles, cat, groups) {
    rack = tiles
    catalog = catalogFrom(groups)
    best = catalog[0] || null
    category = LABELS[cat] ? cat : guessCategory(catalog, tiles)
    catEl.textContent = LABELS[category] || 'Défi'
    input.maxLength = rack.length || 7
    form.hidden = false
    paintRack()
    paintShare()
    onDeal?.(rack, category)
  }

  async function deal(forced, forcedCat) {
    setClosed(false)
    form.hidden = false
    resultEl.hidden = true
    resultEl.innerHTML = ''
    resultEl.className = 'game-result'
    input.disabled = false
    input.value = ''
    setLive('')
    if (!ready()) {
      setLive('Dictionnaire en cours de chargement…')
      return
    }
    setLive('Tirage…')
    const wanted = parseRack(forced)
    let tiles = ''
    let cat = ''
    let groups = []
    try {
      if (wanted.length >= 2) {
        const res = await ask('anagram', { rack: wanted, min: 2, max: wanted.length })
        tiles = wanted
        cat = forcedCat || ''
        groups = res.groups || []
      } else {
        const res = await ask('challenge')
        if (!res?.rack) throw new Error('empty')
        tiles = res.rack
        cat = res.category || ''
        groups = res.groups || []
      }
    } catch {
      setLive('Impossible de tirer. Réessayez.')
      return
    }
    applyDeal(tiles, cat, groups)
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
    else if (word.length >= 2) setLive('Pas avec ces lettres', 'bad')
    else setLive('')
  }

  async function resolvedDef(word) {
    if (!define) return { payload: { found: false }, formOf: '', root: null }
    const payload = await define(word, { stable: true })
    const blob = (payload?.senses || []).flatMap((s) => s.defs).join(' ')
    const formOf = extractFormOf(blob)
    const inflection = payload?.found && (payload.senses || []).every((s) => s.defs.every(isInflectionDef))
    let root = null
    if (inflection && formOf) root = await define(normalize(formOf), { stable: true })
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
      setLive(word.length < 2 ? 'Un mot, le plus cher.' : 'Pas jouable sur ce tirage.', 'bad')
      rackEl.classList.remove('shake')
      void rackEl.offsetWidth
      rackEl.classList.add('shake')
      return
    }
    setClosed(true)
    input.disabled = true
    form.hidden = true
    paintRack()
    const max = best?.pts || hit.pts
    const percent = Math.min(100, Math.round((100 * hit.pts) / Math.max(1, max)))
    const same = best && best.word === hit.word
    resultEl.hidden = false
    resultEl.className = `game-result ${percent >= 100 ? 'hot' : percent >= 60 ? 'warm' : ''}`
    const vs = same
      ? 'Le meilleur mot'
      : percent >= 100
        ? `À égalité · ${escapeHtml(best.word)} ${best.pts}`
        : `Top ${escapeHtml(best.word)} ${best.pts}`
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
      <div class="game-top" role="tablist" aria-label="Meilleurs mots">
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
        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 6V3L8 7l4 4V8a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z"/></svg>
        Encore
      </button>
      <div class="game-def-panel">
        <div class="game-def-body" id="def-body">${defBody(null, escapeHtml)}</div>
      </div>`
    setLive('')
    paintShare(percent)
    paintChart(rememberScore(percent))
    onPlayed?.({ word: hit.word, pts: hit.pts, best: best?.word, bestPts: best?.pts })
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
      if (isCompetitive && isCompetitive()) {
        const { submitCompete, fetchLeaderboard, getTrailData } = await import('./competitive.js?v=32')
        const result = await submitCompete(percent, hit.word)
        if (result?.ok) {
          const trail = getTrailData()
          const board = await fetchLeaderboard(trail?.trailId)
          paintLeaderboard(board)
        }
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
    box.innerHTML = `<p class="pending">Sens de ${escapeHtml(root)}…</p>`
    const resolved = await resolvedDef(normalize(root))
    if (closed) {
      box.innerHTML = `${backBtn(homeWord, escapeHtml)}${defBody(resolved.payload, escapeHtml, { asRoot: true })}`
    }
  })

  async function switchMode(competitive) {
    if (!modeSwitch) return
    modeDefi?.setAttribute('aria-pressed', competitive ? 'false' : 'true')
    modeComp?.setAttribute('aria-pressed', competitive ? 'true' : 'false')
    
    if (competitive) {
      await initCompetitive()
    } else {
      if (authEl) authEl.hidden = true
      if (userEl) userEl.hidden = true
      if (boardEl) boardEl.hidden = true
      paintGlobal()
    }
  }

  async function initCompetitive() {
    const { initGoogleSignIn, checkSession, getCurrentUser, handleGoogleCallback, fetchDailyTrail, fetchLeaderboard, getTrailData, submitCompete } = await import('./competitive.js?v=32')
    
    const user = await checkSession()
    if (user) {
      if (authEl) authEl.hidden = true
      if (userEl) {
        userEl.hidden = false
        const pic = document.getElementById('user-pic')
        const name = document.getElementById('user-name')
        if (pic) pic.src = user.picture || ''
        if (name) name.textContent = user.name || 'Utilisateur'
        const statsEl = document.getElementById('user-stats')
        if (statsEl) {
          const s = user.stats || {}
          const bits = []
          if (s.streak) bits.push(s.streak + ' j')
          if (s.best) bits.push('best ' + s.best + ' %')
          if (s.words) bits.push(s.words + ' mot' + (s.words > 1 ? 's' : ''))
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
              await switchMode(true)
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
            locale: 'fr'
          })
        }
      }
    }

    const trail = await fetchDailyTrail()
    if (trail && trail.rack) {
      await deal(trail.rack, trail.category)
    }

    const board = await fetchLeaderboard(trail?.trailId)
    paintLeaderboard(board)
  }

  function paintLeaderboard(board) {
    if (!boardEl) return
    if (!board?.ok || !board.top?.length) {
      boardEl.hidden = true
      return
    }
    boardEl.hidden = false
    const rows = board.top.slice(0, 10).map((entry) => {
      const isMeRow = board.me && entry.pseudo === board.me.pseudo && entry.percent === board.me.percent
      return `<div class="board-row${isMeRow ? ' is-me' : ''}">
        <span class="board-rank">${entry.rank}</span>
        <span class="board-name">${escapeHtml(entry.pseudo)}</span>
        <span class="board-percent">${entry.percent}%</span>
      </div>`
    }).join('')
    boardEl.innerHTML = `<p class="board-title">Classement du jour</p><div class="board-list">${rows}</div>`
  }

  return {
    async open(opts = {}) {
      if (isCompetitive && isCompetitive()) {
        await switchMode(true)
      } else {
        await switchMode(false)
        paintGlobal()
        const fromUrl = parseRack(opts.rack)
        if (fromUrl.length >= 2 && fromUrl !== rack) await deal(fromUrl, opts.category)
        else if (!rack) await deal()
      }
      input.focus()
    },
    deal,
    switchMode,
  }
}
