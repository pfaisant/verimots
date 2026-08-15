import { initGame, parseRack, linkifyDef, backBtn } from './game.js?v=32'
import { loadHistory, rememberWord, mergeHistory, historyLabel } from './history.js?v=32'
import { isCompetitive, setCompetitive, initGoogleSignIn, checkSession, handleGoogleCallback, logout, getCurrentUser, fetchDailyTrail, fetchLeaderboard, getTrailData } from './competitive.js?v=32'

const VALUES = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1,
  J: 8, K: 10, L: 1, M: 2, N: 1, O: 1, P: 3, Q: 8, R: 1,
  S: 1, T: 1, U: 1, V: 4, W: 10, X: 10, Y: 10, Z: 10,
}
const COUNTS = {
  A: 9, B: 2, C: 2, D: 3, E: 15, F: 2, G: 2, H: 2, I: 8,
  J: 1, K: 1, L: 5, M: 3, N: 6, O: 6, P: 2, Q: 1, R: 6,
  S: 6, T: 6, U: 6, V: 2, W: 1, X: 1, Y: 1, Z: 1, '?': 2,
}

const q = document.getElementById('q')
const clearBtn = document.getElementById('clear')
const live = document.getElementById('live')
const hint = document.getElementById('hint')
const qLabel = document.getElementById('q-label')
const brandSub = document.getElementById('brand-sub')
const verdict = document.getElementById('verdict')
const rackOut = document.getElementById('rack-out')
const rackHelp = document.getElementById('rack-help')
const rackPreview = document.getElementById('rack-preview')
const findOut = document.getElementById('find-out')
const listsOut = document.getElementById('lists-out')
const addJoker = document.getElementById('add-joker') || document.getElementById('q-joker')
const qJoker = document.getElementById('q-joker')
const search = document.getElementById('search')
const advToggle = document.getElementById('adv-toggle')
const advNav = document.getElementById('adv-nav')
const histBtn = document.getElementById('hist-btn')
const histCount = document.getElementById('hist-count')
const histSheet = document.getElementById('hist-sheet')
const histOut = document.getElementById('hist-out')
const histClose = document.getElementById('hist-close')

const inApp = new URLSearchParams(location.search).get('app') === '1'
const worker = new Worker('worker.js?v=32')
let seq = 0
const pending = new Map()
let ready = false
let advanced = false
let nav = 'check'
let findMode = 'exact'
let listKind = '2'
let rackLen = 'all'
let meta = null
let debounce = 0
let lastShare = null
let wordStack = []
let writingUrl = false
let gameRack = ''
let gameCat = ''

const WA_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.04 2C6.58 2 2.15 6.4 2.15 11.83c0 1.73.46 3.41 1.33 4.9L2 22l5.43-1.42a10.1 10.1 0 0 0 4.61 1.11h.01c5.46 0 9.89-4.4 9.89-9.83C21.94 6.4 17.5 2 12.04 2zm5.75 13.99c-.24.68-1.4 1.3-1.94 1.38-.5.08-1.12.11-1.81-.11-.41-.14-.94-.3-1.62-.59-2.85-1.23-4.7-4.1-4.84-4.29-.14-.19-1.15-1.53-1.15-2.92 0-1.39.73-2.07.99-2.36.26-.28.57-.35.76-.35h.55c.17 0 .41-.07.64.49.24.58.82 2 .89 2.15.07.14.12.31.02.5-.09.19-.14.31-.28.48-.14.16-.3.37-.42.49-.14.14-.28.29-.12.56.16.28.72 1.19 1.55 1.93 1.07.95 1.97 1.24 2.25 1.38.28.14.44.12.61-.07.16-.19.7-.81.89-1.09.19-.28.37-.23.64-.14.26.09 1.66.78 1.95.93.28.14.47.21.54.33.07.12.07.68-.17 1.36z"/></svg>`

function ask(type, payload = {}) {
  const id = ++seq
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    worker.postMessage({ type, id, ...payload })
  })
}

worker.onmessage = (ev) => {
  const msg = ev.data || {}
  const slot = pending.get(msg.id)
  if (!slot) return
  pending.delete(msg.id)
  if (msg.type === 'error') slot.reject(new Error(msg.error))
  else slot.resolve(msg)
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z?.*]/g, '')
}

function tilesHtml(word, jokers = [], opts = {}) {
  const jk = new Set(jokers)
  const tap = opts.tap
  return `<div class="tiles">${[...word].map((ch, i) => {
    const blank = jk.has(i) || ch === '?' || ch === '.' || ch === '*'
    const pts = blank ? 0 : (VALUES[ch] || 0)
    const glyph = blank ? '?' : ch
    const tag = tap ? 'button' : 'span'
    const extra = tap ? ` type="button" data-rack-i="${i}"` : ''
    return `<${tag} class="tile${blank ? ' blank' : ''}"${extra}>${glyph}<small>${pts}</small></${tag}>`
  }).join('')}</div>`
}

function wikiUrl(word, lemma) {
  return `https://fr.wiktionary.org/wiki/${encodeURIComponent(lemma || word.toLowerCase())}`
}

const defCache = new Map()
let defSeq = 0

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function foldKeyClient(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function wordLink(word) {
  const u = new URL(location.origin + location.pathname)
  u.searchParams.set('w', word)
  return u.toString()
}

function shareMessage(share) {
  const link = wordLink(share.word)
  if (share.ok) {
    const def = share.def ? `\n${share.def}\n` : '\n'
    return `Verimots\n\n*${share.word}* est dans la liste\n${share.word.length} lettres · ${share.score} pt${share.score > 1 ? 's' : ''}\n${def}\n${link}`
  }
  return `Verimots\n\n*${share.word}* n'est pas dans la liste\n\n${link}`
}

function waHref(share) {
  return `https://wa.me/?text=${encodeURIComponent(shareMessage(share))}`
}

function shareHtml(share) {
  if (!share?.word) return ''
  const label = share.ok ? 'Partager sur WhatsApp' : 'Partager ce refus'
  return `<div class="share-row">
    <a class="wa-share" href="${escapeHtml(waHref(share))}" target="_blank" rel="noopener noreferrer">${WA_ICON}${label}</a>
  </div>`
}

function firstDef(payload) {
  return payload?.senses?.[0]?.defs?.[0] || ''
}

function defsHtml(payload) {
  if (!payload) return `<div class="defs" id="defs"><p class="pending">Définition…</p></div>`
  if (!payload.found || !payload.senses?.length) {
    return `<div class="defs" id="defs">
      <h3>Définition</h3>
      <p class="empty">${payload.offline ? 'Définition disponible avec une connexion.' : 'Pas de définition Wiktionnaire pour cette forme.'}</p>
    </div>`
  }
  const lemma = payload.lemma && foldKeyClient(payload.lemma) !== foldKeyClient(payload.word)
    ? `<p class="lemma">Entrée : <button type="button" class="form-of" data-form-of="${escapeHtml(payload.lemma)}">${escapeHtml(payload.lemma)}</button></p>`
    : ''
  const blocks = payload.senses.slice(0, 2).map((sense) => `
    <div class="sense">
      <div class="pos">${escapeHtml(sense.pos)}</div>
      <ol>${sense.defs.slice(0, 4).map((d) => `<li>${linkifyDef(d, escapeHtml)}</li>`).join('')}</ol>
    </div>`).join('')
  return `<div class="defs" id="defs">
    <h3>Définition</h3>
    ${lemma}
    ${blocks}
    <p class="defs-src">Définition : <a href="${escapeHtml(payload.url || wikiUrl(payload.word, payload.lemma))}" target="_blank" rel="noopener noreferrer">Wiktionnaire</a> (connexion requise).</p>
  </div>`
}

async function loadDefinition(word, opts = {}) {
  const key = word.toUpperCase()
  if (defCache.has(key)) return defCache.get(key)
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: true, found: false, offline: true, word: key }
  }
  const mine = opts.stable ? defSeq : ++defSeq
  try {
    const res = await fetch(`/api/define?w=${encodeURIComponent(key)}`)
    const data = await res.json()
    if (!opts.stable && mine !== defSeq) return null
    if (data?.ok) defCache.set(key, data)
    return data
  } catch {
    if (!opts.stable && mine !== defSeq) return null
    return { ok: true, found: false, offline: true, word: key }
  }
}

function challengeFromUrl() {
  const p = new URLSearchParams(location.search)
  return {
    rack: parseRack(p.get('d') || p.get('tirage') || ''),
    category: p.get('c') || '',
  }
}

function setLive(text) {
  live.textContent = text
}

function paintHistBtn() {
  const n = loadHistory().length
  if (!histCount) return
  histCount.textContent = String(n)
  histCount.hidden = n === 0
  if (histBtn) histBtn.setAttribute('aria-expanded', histSheet && !histSheet.hidden ? 'true' : 'false')
}

function renderHistory() {
  const rows = loadHistory()
  if (!histOut) return
  const title = document.getElementById('hist-title')
  if (title) title.textContent = getCurrentUser() ? 'Historique · compte' : 'Historique'
  if (!rows.length) {
    histOut.innerHTML = `<p class="empty">${
      getCurrentUser()
        ? 'Les mots vérifiés et joués restent sur ton compte.'
        : 'Connecte-toi pour garder l’historique. Les mots de cette session restent ici.'
    }</p>`
    return
  }
  histOut.innerHTML = `<table class="hist-table">
    <thead><tr><th>Mot</th><th>Pts</th><th></th></tr></thead>
    <tbody>${rows
      .map(
        (row) => `<tr data-word="${escapeHtml(row.word)}">
      <td class="hist-word">${escapeHtml(row.word)}</td>
      <td class="hist-pts">${row.pts}</td>
      <td class="hist-src">${historyLabel(row.src)}</td>
    </tr>`
      )
      .join('')}</tbody>
  </table>`
}

function setHistOpen(on) {
  if (!histSheet) return
  histSheet.hidden = !on
  if (on) renderHistory()
  paintHistBtn()
}

function recordWords(entries) {
  for (const entry of entries) {
    if (entry?.word) rememberWord(entry)
  }
  paintHistBtn()
  if (histSheet && !histSheet.hidden) renderHistory()
  if (getCurrentUser()) {
    import('./competitive.js?v=32').then(({ saveHistoryWord }) => {
      for (const entry of entries) if (entry?.word) saveHistoryWord(entry)
    }).catch(() => {})
  }
}

async function syncCloudHistory() {
  if (!getCurrentUser()) return
  try {
    const { fetchHistory } = await import('./competitive.js?v=32')
    const remote = await fetchHistory()
    if (!remote.ok) return
    mergeHistory(remote.history)
    paintHistBtn()
    if (histSheet && !histSheet.hidden) renderHistory()
    const local = loadHistory()
    const remoteWords = new Set((remote.history || []).map((row) => row.word))
    const { saveHistoryWord } = await import('./competitive.js?v=32')
    for (const row of local) {
      if (!remoteWords.has(row.word)) await saveHistoryWord(row)
    }
  } catch {
    /* offline */
  }
}

function showPanel(name) {
  document.querySelectorAll('[data-panel]').forEach((el) => {
    el.hidden = el.dataset.panel !== name
  })
}

function writeUrl() {
  const p = new URLSearchParams()
  const word = normalize(q.value)
  if (nav !== 'game' && word) p.set('w', word)
  if (inApp) p.set('app', '1')
  if (nav === 'game') {
    p.set('vue', 'jeu')
    if (gameRack) p.set('d', gameRack)
    if (gameCat) p.set('c', gameCat)
  }
  if (nav === 'rack') p.set('vue', 'tiroir')
  if (nav === 'info') p.set('vue', 'info')
  if (advanced) {
    p.set('adv', '1')
    if (nav !== 'check' && nav !== 'game' && nav !== 'rack') p.set('vue', nav)
    if (nav === 'check' && findMode !== 'exact') p.set('t', findMode)
    if (nav === 'rack' && rackLen !== 'all') p.set('len', rackLen)
  }
  const next = p.toString() ? `?${p}` : location.pathname
  const now = location.pathname + location.search
  if (next === now || next === location.pathname && !location.search) {
    if (next === location.pathname && !location.search) return
    if (next === now) return
  }
  writingUrl = true
  history.replaceState(null, '', next)
  writingUrl = false
  document.title =
    nav === 'game' ? 'Défi · Verimots' : nav === 'rack' ? 'Tiroir · Verimots' : word ? `${word} · Verimots` : 'Verimots — Vérificateur hors ligne'
}

function readUrl() {
  const p = new URLSearchParams(location.search)
  const word = normalize(p.get('w') || p.get('mot') || '')
  advanced = p.get('adv') === '1' || p.get('mode') === 'avance'
  const vue = p.get('vue') || 'check'
  nav =
    vue === 'jeu'
      ? 'game'
      : vue === 'tiroir'
        ? 'rack'
        : ['check', 'lists', 'info', 'rack', 'game'].includes(vue)
          ? vue
          : 'check'
  if (!advanced && nav !== 'game' && nav !== 'info') nav = 'check'
  findMode = ['prefix', 'suffix', 'has', 'exact'].includes(p.get('t')) ? p.get('t') : 'exact'
  if (p.get('len') && /^\d+$/.test(p.get('len'))) rackLen = p.get('len')
  if (word) q.value = word
  return word
}

function syncChrome() {
  const titles = {
    check: advanced ? 'Vérifier un mot' : 'Communautaire',
    rack: 'Lettres du chevalet',
    lists: 'Listes utiles',
    info: 'À propos',
    game: 'Défi',
  }
  const placeholders = {
    check: findMode === 'exact' ? 'Tapez un mot' : 'Ex. CHER',
    rack: 'Ex. AERTIN?',
  }
  const hints = {
    exact: 'Dans la liste ? Sans accents. Liste hors ligne.',
    prefix: 'Mots de la liste qui commencent ainsi.',
    suffix: 'Mots de la liste qui finissent ainsi.',
    has: 'Mots de la liste qui contiennent ces lettres dans l’ordre.',
  }
  const keepClosed = nav === 'game' && document.body.classList.contains('game-closed')
  document.body.className = `${advanced ? 'advanced' : 'simple'} view-${nav}${inApp ? ' in-app' : ''}${keepClosed ? ' game-closed' : ''}`
  brandSub.textContent = titles[nav] || titles.check
  document.title =
    nav === 'game' ? 'Défi · Verimots' : nav === 'rack' ? 'Tiroir · Verimots' : document.title
  const apk = document.querySelector('.apk-link')
  if (apk) apk.hidden = inApp
  document.querySelectorAll('.legal-link').forEach((el) => {
    el.hidden = nav === 'game'
  })
  advToggle.textContent = advanced ? 'Mode simple' : 'Mode avancé'
  advNav.hidden = !advanced || nav === 'game'
  search.hidden = nav === 'game' || nav === 'lists' || nav === 'info'
  document.querySelectorAll('.fab[data-fab]').forEach((btn) => {
    const on =
      (nav === 'game' && btn.dataset.fab === 'game') ||
      (nav !== 'game' && btn.dataset.fab === 'check')
    btn.setAttribute('aria-current', on ? 'page' : 'false')
  })
  qLabel.textContent = nav === 'rack' ? 'Lettres de votre tiroir' : 'Mot à vérifier'
  q.placeholder = placeholders[nav] || placeholders.check
  q.maxLength = nav === 'rack' ? 16 : 15
  if (qJoker) qJoker.hidden = nav !== 'rack'
  if (hint) hint.textContent = hints[findMode] || hints.exact
  rackPreview.hidden = nav !== 'rack'
  document.querySelectorAll('#adv-nav [data-nav]').forEach((btn) => {
    btn.setAttribute('aria-current', btn.dataset.nav === nav ? 'page' : 'false')
  })
  document.querySelectorAll('.find-tools [data-find]').forEach((b) => {
    b.setAttribute('aria-pressed', b.dataset.find === findMode ? 'true' : 'false')
  })
  document.querySelectorAll('.len-chips [data-len]').forEach((b) => {
    b.setAttribute('aria-pressed', b.dataset.len === rackLen ? 'true' : 'false')
  })
}

async function paintApkLink() {
  const apk = document.querySelector('.apk-link')
  if (!apk) return
  apk.href = 'verimots.apk'
  try {
    const res = await fetch('apk.json', { cache: 'no-store' })
    const data = await res.json()
    if (data?.version) {
      const file = `verimots-${data.version}.apk`
      apk.textContent = file
      apk.download = file
      apk.title = `Télécharger ${file}`
      if (data.versioned) apk.href = data.versioned
    }
  } catch {
    /* keep the static latest link */
  }
}

function setNav(name) {
  if (name === 'rack' && !advanced) name = 'check'
  nav = name
  if (name !== 'check') findMode = 'exact'
  syncChrome()
  showPanel(name)
  if (name === 'lists') renderLists()
  if (name === 'game') game?.open(challengeFromUrl())
  if (name === 'check' || name === 'rack') {
    renderRackPreview()
    run()
    q.focus()
  }
  writeUrl()
}

function setAdvanced(on) {
  advanced = on
  if (!advanced && nav !== 'game') {
    nav = 'check'
    findMode = 'exact'
  }
  syncChrome()
  showPanel(nav)
  if (nav === 'lists') renderLists()
  if (nav === 'check' || nav === 'rack') run()
  writeUrl()
}

function blankCount(raw) {
  return [...raw].filter((c) => c === '?' || c === '.' || c === '*').length
}

function addBlankToRack() {
  const raw = normalize(q.value)
  if (blankCount(raw) >= 2 || raw.length >= 16) return
  q.value = raw + '?'
  q.focus()
  run()
}

function renderRackPreview() {
  const raw = normalize(q.value)
  if (nav !== 'rack') {
    rackPreview.hidden = true
    rackPreview.innerHTML = ''
    return
  }
  rackPreview.hidden = false
  const blanks = blankCount(raw)
  const canAdd = blanks < 2 && raw.length < 16
  const tiles = raw
    ? tilesHtml(raw, [], { tap: true })
    : `<div class="tiles"></div>`
  rackPreview.innerHTML = `${tiles}
    <button type="button" class="tile add-blank" id="rack-add-blank" ${canAdd ? '' : 'disabled'} aria-label="Ajouter un joker">?<small>+</small></button>
    <p class="preview-cap">${raw ? `${raw.length} lettre${raw.length > 1 ? 's' : ''}` : 'Tapez A–Z ou posez un ?'}${blanks ? ` · ${blanks} joker${blanks > 1 ? 's' : ''}` : ''}</p>`
}

function renderCheck(word, result) {
  findOut.hidden = true
  if (!word) {
    verdict.hidden = true
    verdict.className = 'verdict idle'
    lastShare = null
    return
  }
  verdict.hidden = false
  if (!ready) {
    verdict.className = 'verdict idle'
    verdict.innerHTML = `<p class="pending">Dictionnaire en cours de chargement…</p>`
    return
  }
  lastShare = {
    word: result.word || word,
    ok: Boolean(result.ok),
    score: result.score || 0,
    def: firstDef(result.definition),
  }
  const back = wordStack.length ? backBtn(wordStack[wordStack.length - 1], escapeHtml) : ''
  if (result.ok) {
    verdict.className = 'verdict ok'
    verdict.innerHTML = `
      ${back}
      <div class="status">Jouable · liste hors ligne</div>
      <p class="word">${result.word}</p>
      ${tilesHtml(result.word)}
      <div class="meta-line">
        <span>${result.word.length} lettres · ${result.score} pt${result.score > 1 ? 's' : ''}</span>
        <a href="${wikiUrl(result.word)}" target="_blank" rel="noopener noreferrer">Wiktionnaire</a>
      </div>
      ${shareHtml(lastShare)}
      ${defsHtml(result.definition)}`
  } else {
    verdict.className = 'verdict no'
    verdict.innerHTML = `
      ${back}
      <div class="status">Pas dans la liste</div>
      <p class="word">${word}</p>
      <p class="empty">Ce mot n'est pas une forme admise (2 à 15 lettres, sans accents).</p>
      ${shareHtml(lastShare)}`
  }
}

function renderGroups(target, groups, emptyText, summary) {
  if (!groups || !groups.length) {
    target.innerHTML = `<p class="empty">${emptyText}</p>`
    return
  }
  const total = groups.reduce((n, g) => n + g.words.length, 0)
  target.innerHTML = `<p class="result-sum">${summary || `${total.toLocaleString('fr-FR')} mot${total > 1 ? 's' : ''}`}</p>` +
    groups.map((g) => `
      <div class="group">
        <h3>${g.len} lettres · ${g.words.length}</h3>
        <div class="words">${g.words.map((entry) => {
          const w = typeof entry === 'string' ? { word: entry, score: '', jokers: [] } : entry
          const letters = [...w.word]
            .map((ch, i) =>
              (w.jokers || []).includes(i) ? `<span class="jk" title="${ch}">?</span>` : ch
            )
            .join('')
          return `<button type="button" class="chip" data-word="${w.word}" title="${w.word}">${letters}${w.score !== '' ? `<span class="pts">${w.score}</span>` : ''}</button>`
        }).join('')}</div>
      </div>`).join('')
}

function renderFind(words, query) {
  verdict.hidden = true
  findOut.hidden = false
  if (!words.length) {
    findOut.innerHTML = `<p class="empty">Aucun mot de la liste pour « ${escapeHtml(query)} ».</p>`
    return
  }
  const groups = []
  const by = new Map()
  for (const w of words) {
    if (!by.has(w.length)) by.set(w.length, [])
    by.get(w.length).push(w)
  }
  for (const len of [...by.keys()].sort((a, b) => a - b)) {
    groups.push({ len, words: by.get(len) })
  }
  const labels = { prefix: 'qui commencent par', suffix: 'qui finissent par', has: 'qui contiennent' }
  renderGroups(findOut, groups, '', `${words.length.toLocaleString('fr-FR')} mot${words.length > 1 ? 's' : ''} ${labels[findMode] || ''} ${query}`)
}

function renderLists() {
  if (listKind === 'values') {
    const letters = Object.keys(VALUES)
    listsOut.innerHTML = `<div class="values">${letters.map((ch) => `
      <div class="val">
        <span class="tile">${ch}<small>${VALUES[ch]}</small></span>
        ×${COUNTS[ch]}
      </div>`).join('')}
      <div class="val">
        <span class="tile blank">?<small>0</small></span>
        ×2
      </div>
    </div>
    <p class="empty">Distribution française officielle. Un joker vaut 0.</p>`
    return
  }
  const list = listKind === '2' ? meta?.letters2 || [] : meta?.letters3 || []
  const cls = listKind === '2' ? 'grid2' : 'grid3'
  listsOut.innerHTML = `<p class="result-sum">${list.length} mots de ${listKind} lettres · touchez pour vérifier</p>
    <div class="${cls}">${list.map((w) => `<button type="button" class="chip" data-word="${w}">${w}</button>`).join('')}</div>`
}

function renderRackEmpty() {
  rackHelp.hidden = false
  rackOut.innerHTML = ''
}

async function run() {
  const raw = normalize(q.value)
  q.value = raw
  clearBtn.hidden = raw.length === 0
  renderRackPreview()
  if (addJoker) addJoker.disabled = blankCount(raw) >= 2 || raw.length >= 16
  if (qJoker) qJoker.disabled = blankCount(raw) >= 2 || raw.length >= 16
  writeUrl()

  if (nav === 'lists' || nav === 'info' || nav === 'game') return

  if (nav === 'check' && findMode === 'exact') {
    findOut.hidden = true
    if (!raw || /[?.*]/.test(raw)) {
      renderCheck('', null)
      return
    }
    if (!ready) {
      renderCheck(raw, { ok: false })
      return
    }
    const result = await ask('check', { word: raw })
    if (normalize(q.value) !== raw || nav !== 'check' || findMode !== 'exact') return
    renderCheck(raw, result)
    if (result.ok) {
      const definition = await loadDefinition(raw)
      if (definition && normalize(q.value) === raw && nav === 'check' && findMode === 'exact') {
        renderCheck(raw, { ...result, definition })
      }
    }
    return
  }

  if (nav === 'check') {
    verdict.hidden = true
    if (raw.length < 2) {
      findOut.hidden = false
      findOut.innerHTML = `<p class="empty">Au moins 2 lettres.</p>`
      return
    }
    if (!ready) {
      findOut.hidden = false
      findOut.innerHTML = `<p class="pending">Dictionnaire en cours de chargement…</p>`
      return
    }
    const result = await ask('find', { mode: findMode, q: raw })
    if (normalize(q.value) === raw && nav === 'check') renderFind(result.words, raw)
    return
  }

  if (nav === 'rack') {
    if (raw.length < 2) {
      renderRackEmpty()
      return
    }
    rackHelp.hidden = true
    if (!ready) {
      rackOut.innerHTML = `<p class="pending">Dictionnaire en cours de chargement…</p>`
      return
    }
    const max = rackLen === 'all' ? raw.length : Number(rackLen)
    const min = rackLen === 'all' ? 2 : Number(rackLen)
    const result = await ask('anagram', { rack: raw, min, max })
    if (normalize(q.value) !== raw || nav !== 'rack') return
    const n = (result.groups || []).reduce((c, g) => c + g.words.length, 0)
    renderGroups(
      rackOut,
      result.groups,
      'Aucun mot de la liste avec ces lettres.',
      `${n.toLocaleString('fr-FR')} mot${n > 1 ? 's' : ''} jouable${n > 1 ? 's' : ''} · ? = joker · score à droite`
    )
  }
}

function schedule() {
  clearTimeout(debounce)
  debounce = setTimeout(run, nav === 'check' && findMode === 'exact' ? 40 : 140)
}

function openWord(word, opts = {}) {
  const next = normalize(word)
  const current = normalize(q.value)
  if (opts.fromDef && current && current !== next) wordStack.push(current)
  else if (!opts.fromDef) wordStack = []
  q.value = next
  findMode = 'exact'
  if (next.length >= 2) recordWords([{ word: next, pts: 0, src: 'dico' }])
  setHistOpen(false)
  setNav('check')
}

function popWord() {
  const prev = wordStack.pop()
  if (!prev) return
  q.value = prev
  findMode = 'exact'
  setNav('check')
}

function applyUrl() {
  readUrl()
  syncChrome()
  showPanel(nav)
  if (nav === 'lists') renderLists()
  if (nav === 'game') game?.open(challengeFromUrl())
  if (nav === 'check' || nav === 'rack') run()
}

histBtn?.addEventListener('click', () => setHistOpen(histSheet.hidden))
histClose?.addEventListener('click', () => setHistOpen(false))
histSheet?.addEventListener('click', (e) => {
  if (e.target === histSheet) setHistOpen(false)
})
histOut?.addEventListener('click', (e) => {
  const row = e.target.closest('[data-word]')
  if (!row) return
  openWord(row.dataset.word)
})
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && histSheet && !histSheet.hidden) setHistOpen(false)
})

document.getElementById('about-link')?.addEventListener('click', () => setNav('info'))

advToggle.addEventListener('click', () => setAdvanced(!advanced))

document.querySelectorAll('#adv-nav [data-nav]').forEach((btn) => {
  btn.addEventListener('click', () => setNav(btn.dataset.nav))
})

document.querySelectorAll('.fab[data-fab]').forEach((btn) => {
  btn.addEventListener('click', () => setNav(btn.dataset.fab))
})

document.querySelectorAll('.find-tools [data-find]').forEach((btn) => {
  btn.addEventListener('click', () => {
    findMode = btn.dataset.find
    syncChrome()
    run()
    q.focus()
  })
})

document.querySelectorAll('.list-switch [data-list]').forEach((btn) => {
  btn.addEventListener('click', () => {
    listKind = btn.dataset.list
    document.querySelectorAll('.list-switch [data-list]').forEach((b) => {
      b.setAttribute('aria-selected', b === btn ? 'true' : 'false')
    })
    renderLists()
  })
})

document.querySelectorAll('.len-chips [data-len]').forEach((btn) => {
  btn.addEventListener('click', () => {
    rackLen = btn.dataset.len
    document.querySelectorAll('.len-chips [data-len]').forEach((b) => {
      b.setAttribute('aria-pressed', b === btn ? 'true' : 'false')
    })
    run()
  })
})

function onAddJoker(e) {
  e.preventDefault()
  addBlankToRack()
}
qJoker?.addEventListener('click', onAddJoker)

document.body.addEventListener('click', (e) => {
  const back = e.target.closest('[data-def-back]')
  if (back && nav === 'check') {
    popWord()
    return
  }
  const formOf = e.target.closest('[data-form-of]')
  if (formOf && nav === 'check') {
    openWord(normalize(formOf.dataset.formOf), { fromDef: true })
    return
  }
  if (e.target.closest('#rack-add-blank')) {
    addBlankToRack()
    return
  }
  const tile = e.target.closest('[data-rack-i]')
  if (tile && nav === 'rack') {
    const i = Number(tile.dataset.rackI)
    const raw = normalize(q.value)
    q.value = raw.slice(0, i) + raw.slice(i + 1)
    run()
    q.focus()
    return
  }
  const ex = e.target.closest('[data-example]')
  if (ex) {
    q.value = ex.dataset.example
    setNav('rack')
    return
  }
  const chip = e.target.closest('[data-word]')
  if (!chip || chip.closest('#panel-game') || chip.hasAttribute('data-def-tab')) return
  openWord(chip.dataset.word)
})

clearBtn.addEventListener('click', () => {
  q.value = ''
  q.focus()
  run()
})
q.addEventListener('input', () => {
  wordStack = []
  schedule()
})
q.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    run()
  }
})
window.addEventListener('popstate', () => {
  if (writingUrl) return
  applyUrl()
})

const game = initGame({
  ask,
  tilesHtml,
  escapeHtml,
  normalize,
  ready: () => ready,
  define: loadDefinition,
  isCompetitive,
  onDeal(tiles, cat) {
    gameRack = tiles
    gameCat = cat
    writeUrl()
  },
  onPlayed({ word, pts, best, bestPts }) {
    const rows = [{ word, pts, src: 'defi' }]
    if (best && best !== word) rows.push({ word: best, pts: bestPts, src: 'defi' })
    recordWords(rows)
  },
})

async function boot() {
  readUrl()
  syncChrome()
  paintApkLink()
  try {
    const user = await checkSession()
    if (user) await syncCloudHistory()
  } catch {
    /* not signed in */
  }
  paintHistBtn()
  showPanel(nav)
  try {
    meta = await (await fetch('data/meta.json')).json()
    setLive(`${meta.count.toLocaleString('fr-FR')} formes`)
    renderLists()
  } catch {
    setLive('Méta indisponible')
  }
  try {
    const result = await ask('load')
    ready = true
    setLive(`${result.count.toLocaleString('fr-FR')} mots`)
    if (nav === 'check' || nav === 'rack') run()
    else if (nav === 'lists') renderLists()
    else if (nav === 'game') game.open(challengeFromUrl())
  } catch (err) {
    setLive('Échec du chargement')
    if (hint) hint.textContent = 'Impossible de charger le lexique. Rechargez la page.'
    console.error(err)
  }
}

if ('serviceWorker' in navigator && !inApp) {
  navigator.serviceWorker.register('sw.js?v=32').catch(() => {})
}

document.getElementById('mode-defi')?.addEventListener('click', async () => {
  setCompetitive(false)
  await game.switchMode(false)
})

document.getElementById('mode-comp')?.addEventListener('click', async () => {
  setCompetitive(true)
  await game.switchMode(true)
})

document.getElementById('logout-btn')?.addEventListener('click', async () => {
  await logout()
  await game.switchMode(true)
  if (histSheet && !histSheet.hidden) renderHistory()
})

document.addEventListener('verimots-auth', () => {
  syncCloudHistory()
})

boot()
