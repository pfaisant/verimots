import { initGame, parseRack, linkifyDef, backBtn, tileValues, dailyStudySlice, dailyStudyText, studyListText, studyDateLabel, lexiconFileName, STUDY_TWOS, STUDY_THREES } from './game.js?v=77'
import { loadHistory, rememberWord, mergeHistory, historyLabel, historyWhen, clearHistory } from './history.js?v=77'
import { isCompetitive, isKids, isTraining, setGameMode, initGoogleSignIn, checkSession, handleGoogleCallback, logout, getCurrentUser, fetchDailyTrail, fetchLeaderboard, getTrailData } from './competitive.js?v=77'
import { initLang, setLang, setDict, getLang, getDict, dictSpec, dictLabel, t } from './i18n.js?v=77'

const FR_COUNTS = {
  A: 9, B: 2, C: 2, D: 3, E: 15, F: 2, G: 2, H: 2, I: 8,
  J: 1, K: 1, L: 5, M: 3, N: 6, O: 6, P: 2, Q: 1, R: 6,
  S: 6, T: 6, U: 6, V: 2, W: 1, X: 1, Y: 1, Z: 1, '?': 2,
}
const EN_COUNTS = {
  A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9,
  J: 1, K: 1, L: 4, M: 2, N: 6, O: 8, P: 2, Q: 1, R: 6,
  S: 4, T: 6, U: 4, V: 2, W: 2, X: 1, Y: 2, Z: 1, '?': 2,
}
const ES_COUNTS = {
  A: 13, B: 2, C: 4, D: 5, E: 12, F: 1, G: 2, H: 2, I: 6,
  J: 1, K: 1, L: 4, M: 2, N: 5, Ñ: 1, O: 9, P: 2, Q: 1,
  R: 5, S: 6, T: 4, U: 5, V: 1, W: 1, X: 1, Y: 1, Z: 1, '?': 2,
}
function letterValues() {
  return tileValues(getLang())
}
function letterCounts() {
  return getLang() === 'en' ? EN_COUNTS : getLang() === 'es' ? ES_COUNTS : FR_COUNTS
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
const multiTools = document.getElementById('find-multi-tools')
const multiStart = document.getElementById('find-start')
const multiHas = document.getElementById('find-contains')
const multiEnd = document.getElementById('find-end')
const multiLength = document.getElementById('find-length')
const multiInfinitives = document.getElementById('find-infinitives')
const multiHideInflections = document.getElementById('find-hide-inflections')

const inApp = new URLSearchParams(location.search).get('app') === '1'
const worker = new Worker('worker.js?v=77', { type: 'module' })
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

function staleResult(result) {
  return (result.lang && result.lang !== getLang()) || (result.dict && result.dict !== getDict())
}

function ask(type, payload = {}) {
  const id = ++seq
  const lang = getLang()
  const dict = getDict()
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, lang, dict })
    worker.postMessage({ type, id, lang, dict, ...payload })
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
  const sentinel = '\ue000'
  return String(value || '')
    .normalize('NFC')
    .replace(/ñ/gi, sentinel)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replaceAll(sentinel.toUpperCase(), 'Ñ')
    .replace(/[^A-ZÑ?.*]/g, '')
}

function tilesHtml(word, jokers = [], opts = {}) {
  const jk = new Set(jokers)
  const tap = opts.tap
  return `<div class="tiles">${[...word].map((ch, i) => {
    const blank = jk.has(i) || ch === '?' || ch === '.' || ch === '*'
    const pts = blank ? 0 : (letterValues()[ch] || 0)
    const glyph = blank ? '?' : ch
    const tag = tap ? 'button' : 'span'
    const extra = tap ? ` type="button" data-rack-i="${i}"` : ''
    return `<${tag} class="tile${blank ? ' blank' : ''}"${extra}>${glyph}<small>${pts}</small></${tag}>`
  }).join('')}</div>`
}

function wikiUrl(word, lemma) {
  const title = lemma || String(word || '').toLowerCase()
  const host = getLang() === 'en'
    ? 'en.wiktionary.org'
    : getLang() === 'es'
      ? 'es.wiktionary.org'
      : 'fr.wiktionary.org'
  return `https://${host}/wiki/${encodeURIComponent(title)}`
}

function isCompoundLemma(value) {
  return /[-'’]/.test(String(value || ''))
}

const DEF_CACHE_KEY = 'verimots-definitions-v2'
const DEF_CACHE_TTL = 7 * 24 * 60 * 60 * 1000
const DEF_CACHE_MAX = 80
const defCache = new Map()
let defSeq = 0

function readStoredDefinition(key) {
  try {
    const all = JSON.parse(localStorage.getItem(DEF_CACHE_KEY) || '{}')
    const hit = all?.[key]
    if (!hit || Date.now() - Number(hit.at || 0) > DEF_CACHE_TTL) return null
    const value = hit.value
    if (!value?.found || !value.senses?.some((sense) =>
      sense?.defs?.some((definition) => /\p{L}/u.test(String(definition || '')))
    )) return null
    return value
  } catch {
    return null
  }
}

function storeDefinition(key, value) {
  if (!value?.ok || !value.found || value.offline) return
  try {
    const all = JSON.parse(localStorage.getItem(DEF_CACHE_KEY) || '{}')
    all[key] = { at: Date.now(), value }
    const ordered = Object.entries(all)
      .sort((a, b) => Number(b[1]?.at || 0) - Number(a[1]?.at || 0))
      .slice(0, DEF_CACHE_MAX)
    localStorage.setItem(DEF_CACHE_KEY, JSON.stringify(Object.fromEntries(ordered)))
  } catch {
    /* private mode or storage quota */
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function foldKeyClient(value) {
  const sentinel = '\ue000'
  return String(value || '')
    .normalize('NFC')
    .replace(/ñ/gi, sentinel)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replaceAll(sentinel, 'ñ')
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
    return `Verimots · ${dictLabel()}\n\n*${t('share_valid', share.word, dictLabel())}*\n${t('letters_pts', share.word.length, share.score)}\n${def}\n${link}`
  }
  return `Verimots · ${dictLabel()}\n\n*${t('share_invalid', share.word, dictLabel())}*\n\n${link}`
}

function waHref(share) {
  return `https://wa.me/?text=${encodeURIComponent(shareMessage(share))}`
}

function shareHtml(share) {
  if (!share?.word) return ''
  const label = share.ok ? t('share_wa') : t('share_refuse')
  return `<div class="share-row">
    <a class="wa-share" href="${escapeHtml(waHref(share))}" target="_blank" rel="noopener noreferrer">${WA_ICON}${label}</a>
  </div>`
}

function firstDef(payload) {
  return payload?.senses?.[0]?.defs?.[0] || ''
}

function defsHtml(payload) {
  if (!payload) return `<div class="defs" id="defs"><p class="pending">${t('def_pending')}</p></div>`
  if (!payload.found || !payload.senses?.length) {
    return `<div class="defs" id="defs">
      <h3>${t('def_heading')}</h3>
      <p class="empty">${payload.offline ? t('def_need_net') : t('def_missing')}</p>
    </div>`
  }
  const lemma = payload.lemma && foldKeyClient(payload.lemma) !== foldKeyClient(payload.word)
    ? `<p class="lemma">${t('lemma_entry')} <button type="button" class="form-of" data-form-of="${escapeHtml(payload.lemma)}">${escapeHtml(payload.lemma)}</button></p>`
    : ''
  const blocks = payload.senses.slice(0, 2).map((sense) => `
    <div class="sense">
      <div class="pos">${escapeHtml(sense.pos)}</div>
      <ol>${sense.defs.slice(0, 4).map((d) => `<li>${linkifyDef(d, escapeHtml)}</li>`).join('')}</ol>
    </div>`).join('')
  return `<div class="defs" id="defs">
    <h3>${t('def_heading')}</h3>
    ${lemma}
    ${blocks}
    <p class="defs-src">${t('def_src')} <a href="${escapeHtml(payload.url || wikiUrl(payload.word, payload.lemma))}" target="_blank" rel="noopener noreferrer">${t('wiki')}</a> ${t('wiki_need_net')}</p>
  </div>`
}

async function loadDefinition(word, opts = {}) {
  const key = String(word || '').trim()
  if (!key) return { ok: true, found: false, word: '' }
  const cacheKey = `${getLang()}:${foldKeyClient(key)}`
  if (defCache.has(cacheKey)) return defCache.get(cacheKey)
  const stored = readStoredDefinition(cacheKey)
  if (stored) {
    defCache.set(cacheKey, stored)
    return stored
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: true, found: false, offline: true, word: key }
  }
  const mine = opts.stable ? defSeq : ++defSeq
  try {
    const langQ = `&lang=${encodeURIComponent(getLang())}`
    const res = await fetch(`/api/define?w=${encodeURIComponent(key)}${langQ}`)
    const data = await res.json()
    if (!opts.stable && mine !== defSeq) return null
    if (data?.ok && data.found) {
      defCache.set(cacheKey, data)
      storeDefinition(cacheKey, data)
    }
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

function dictsPage() {
  return getLang() === 'en' ? '/dictionaries.html' : getLang() === 'es' ? '/diccionarios.html' : '/dictionnaires.html'
}

function liveCount(n) {
  const locale = getLang() === 'en' ? 'en-GB' : getLang() === 'es' ? 'es-ES' : 'fr-FR'
  return t('word_count', Number(n).toLocaleString(locale), dictLabel())
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
  const clearBtn = document.getElementById('hist-clear')
  if (title) title.textContent = getCurrentUser() ? t('hist_account') : t('hist_local')
  if (clearBtn) {
    clearBtn.hidden = !rows.length
    clearBtn.textContent = t('hist_clear')
  }
  if (!rows.length) {
    histOut.innerHTML = `<p class="empty">${
      getCurrentUser() ? t('hist_empty_user') : t('hist_empty_guest')
    }</p>`
    return
  }
  histOut.innerHTML = `<table class="hist-table">
    <thead><tr><th>${t('hist_word')}</th><th>${t('hist_pts')}</th><th>${t('hist_kind')}</th><th>${t('hist_when')}</th></tr></thead>
    <tbody>${rows
      .map(
        (row) => `<tr data-word="${escapeHtml(row.word)}">
      <td class="hist-word">${escapeHtml(row.word)}</td>
      <td class="hist-pts">${row.pts}</td>
      <td class="hist-src">${historyLabel(row.src)}</td>
      <td class="hist-when">${escapeHtml(historyWhen(row.at))}</td>
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
    import('./competitive.js?v=77').then(({ saveHistoryWord }) => {
      for (const entry of entries) if (entry?.word) saveHistoryWord(entry)
    }).catch(() => {})
  }
}

async function syncCloudHistory() {
  if (!getCurrentUser()) return
  try {
    const { fetchHistory } = await import('./competitive.js?v=77')
    const remote = await fetchHistory()
    if (!remote.ok) return
    mergeHistory(remote.history)
    paintHistBtn()
    if (histSheet && !histSheet.hidden) renderHistory()
    const local = loadHistory()
    const remoteWords = new Set((remote.history || []).map((row) => row.word))
    const { saveHistoryWord } = await import('./competitive.js?v=77')
    for (const row of local) {
      if (!remoteWords.has(row.word)) await saveHistoryWord(row)
    }
  } catch {
    /* offline */
  }
}

function isDesk() {
  return window.matchMedia('(min-width: 900px)').matches
}

function boardSplit() {
  return isDesk() && (isCompetitive() || isKids()) && (nav === 'game' || nav === 'board')
}

function showPanel(name) {
  const split = boardSplit()
  document.querySelectorAll('[data-panel]').forEach((el) => {
    const key = el.dataset.panel
    if (split && (key === 'game' || key === 'board')) {
      el.hidden = false
      return
    }
    el.hidden = key !== name
  })
  document.body.classList.toggle('game-split', split)
  const fabBoard = document.getElementById('fab-board')
  if (fabBoard) fabBoard.hidden = isDesk() || !(isCompetitive() || isKids())
}

function writeUrl() {
  const p = new URLSearchParams()
  p.set('lang', getLang())
  p.set('dict', getDict())
  const word = normalize(q.value)
  if (nav !== 'game' && word) p.set('w', word)
  if (inApp) p.set('app', '1')
  if (nav === 'game') {
    p.set('vue', 'jeu')
    if (gameRack) p.set('d', gameRack)
    if (gameCat) p.set('c', gameCat)
  }
  if (nav === 'board') p.set('vue', 'classement')
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
    nav === 'game' ? t('doc_game') : nav === 'board' ? t('doc_board') : nav === 'rack' ? t('doc_rack') : word ? `${word} · Verimots` : t('title')
}

function readUrl() {
  const p = new URLSearchParams(location.search)
  const word = normalize(p.get('w') || p.get('mot') || '')
  advanced = p.get('adv') === '1' || p.get('mode') === 'avance'
  const vue = p.get('vue') || 'check'
  nav =
    vue === 'jeu'
      ? 'game'
      : vue === 'classement'
        ? 'board'
        : vue === 'tiroir'
          ? 'rack'
          : ['check', 'lists', 'info', 'rack', 'game', 'board'].includes(vue)
            ? vue
            : 'check'
  if (!advanced && nav !== 'game' && nav !== 'info' && nav !== 'board') nav = 'check'
  findMode = ['prefix', 'suffix', 'has', 'multi', 'exact'].includes(p.get('t')) ? p.get('t') : 'exact'
  if (p.get('len') && /^\d+$/.test(p.get('len'))) rackLen = p.get('len')
  if (word) q.value = word
  return word
}

function syncChrome() {
  const placeholders = {
    check: findMode === 'exact' ? t('placeholder') : t('placeholder_find'),
    rack: t('placeholder_rack'),
  }
  const hints = {
    exact: t('hint_exact'),
    prefix: t('hint_prefix'),
    suffix: t('hint_suffix'),
    has: t('hint_has'),
    multi: t('hint_multi'),
  }
  const keepClosed = nav === 'game' && document.body.classList.contains('game-closed')
  document.body.className = `${advanced ? 'advanced' : 'simple'} view-${nav}${inApp ? ' in-app' : ''}${keepClosed ? ' game-closed' : ''}${boardSplit() ? ' game-split' : ''}${isKids() ? ' kids' : ''}${isTraining() ? ' training' : ''}`
  if (brandSub) {
    brandSub.textContent = dictLabel()
    brandSub.setAttribute('aria-label', `${t('dict_open')} · ${dictLabel()}`)
  }
  document.title =
    nav === 'game' ? t('doc_game') : nav === 'board' ? t('doc_board') : nav === 'rack' ? t('doc_rack') : t('title')
  const apk = document.querySelector('.apk-link')
  if (apk) apk.hidden = inApp
  document.querySelectorAll('.legal-link').forEach((el) => {
    el.hidden = nav === 'game' || nav === 'board'
    const href = el.getAttribute('href') || ''
    if (el.tagName === 'A' && (href.includes('confidentialite') || href.includes('privacy') || href.includes('privacidad'))) {
      el.setAttribute('href', getLang() === 'en' ? '/privacy.html' : getLang() === 'es' ? '/privacidad.html' : '/confidentialite.html')
    }
    if (el.tagName === 'A' && (href.includes('dictionnair') || href.includes('diccionari'))) {
      el.setAttribute('href', dictsPage())
    }
  })
  advToggle.textContent = advanced ? t('simple') : t('advanced')
  advNav.hidden = !advanced || nav === 'game' || nav === 'board'
  search.hidden = nav === 'game' || nav === 'board' || nav === 'lists' || nav === 'info'
  const fabBoard = document.getElementById('fab-board')
  if (fabBoard) fabBoard.hidden = isDesk() || !(isCompetitive() || isKids())
  document.querySelectorAll('.fab[data-fab]').forEach((btn) => {
    const on =
      (nav === 'board' && btn.dataset.fab === 'board') ||
      (nav === 'game' && btn.dataset.fab === 'game') ||
      (nav !== 'game' && nav !== 'board' && btn.dataset.fab === 'check')
    btn.setAttribute('aria-current', on ? 'page' : 'false')
  })
  paintDicts()
  qLabel.textContent = nav === 'rack' ? t('q_label_rack') : t('q_label')
  q.placeholder = placeholders[nav] || placeholders.check
  q.maxLength = nav === 'rack' ? 16 : 15
  if (qJoker) qJoker.hidden = nav !== 'rack'
  if (hint) hint.textContent = hints[findMode] || hints.exact
  if (multiTools) multiTools.hidden = findMode !== 'multi'
  if (multiInfinitives) {
    const supported = getLang() !== 'en'
    multiInfinitives.disabled = !supported
    if (!supported) multiInfinitives.checked = false
    const label = multiInfinitives.closest('label')
    if (label) label.hidden = !supported
  }
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
  if (name === 'info') renderStudy()
  if (name === 'game') game?.open(challengeFromUrl())
  if (name === 'board') game?.showBoard?.()
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
  if (nav === 'info') renderStudy()
  if (nav === 'check' || nav === 'rack') run()
  writeUrl()
}

function blankCount(raw) {
  return [...raw].filter((c) => c === '?' || c === '.' || c === '*').length
}

function multiFilters() {
  return {
    start: normalize(multiStart?.value || '').replace(/[?.*]/g, ''),
    has: normalize(multiHas?.value || '').replace(/[?.*]/g, ''),
    end: normalize(multiEnd?.value || '').replace(/[?.*]/g, ''),
    length: Math.max(0, Math.min(15, Number(multiLength?.value) || 0)),
    infinitives: getLang() !== 'en' && !!multiInfinitives?.checked,
    hideInflections: !!multiHideInflections?.checked,
  }
}

function hasMultiFilter(filters = multiFilters()) {
  return !!(filters.start || filters.has || filters.end || filters.length || filters.infinitives || filters.hideInflections)
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
    verdict.innerHTML = `<p class="pending">${t('loading_lex')}</p>`
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
      <div class="status">${t('playable', dictLabel())}</div>
      <p class="word">${result.word}</p>
      ${tilesHtml(result.word)}
      <div class="meta-line">
        <span>${t('letters_pts', result.word.length, result.score)}</span>
        <a href="${escapeHtml(result.definition?.url || wikiUrl(result.word, result.definition?.lemma))}" target="_blank" rel="noopener noreferrer">${t('wiki')}</a>
      </div>
      ${shareHtml(lastShare)}
      ${defsHtml(result.definition)}`
  } else {
    verdict.className = 'verdict no'
    verdict.innerHTML = `
      ${back}
      <div class="status">${t('not_in_list', dictLabel())}</div>
      <p class="word">${word}</p>
      <p class="empty">${t('not_a_form')}</p>
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
    findOut.innerHTML = `<p class="empty">${escapeHtml(t('find_none', query))}</p>`
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
  renderGroups(findOut, groups, '', t('find_summary', words.length, query))
}

function paintDicts() {
  const current = getDict()
  document.querySelectorAll('[data-dict]').forEach((btn) => {
    const on = btn.dataset.dict === current
    btn.setAttribute('aria-pressed', on ? 'true' : 'false')
    btn.setAttribute('aria-checked', on ? 'true' : 'false')
  })
}

function setDictOpen(on) {
  const sheet = document.getElementById('dict-sheet')
  if (!sheet) return
  sheet.hidden = !on
  if (on) {
    paintDicts()
    document.getElementById('dict-sheet-close')?.focus()
  }
}

function waStudyHref(text) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

function studyChips(words) {
  return (words || []).map((w) => `<button type="button" class="chip" data-word="${escapeHtml(w)}">${escapeHtml(w)}</button>`).join('')
}

function renderStudy() {
  const when = document.getElementById('study-when')
  const twosEl = document.getElementById('study-twos')
  const threesEl = document.getElementById('study-threes')
  const studyWa = document.getElementById('study-wa')
  const studyWaTwos = document.getElementById('study-wa-twos')
  const twosAll = meta?.letters2 || []
  const threesAll = meta?.letters3 || []
  const twos = dailyStudySlice(twosAll, new Date(), STUDY_TWOS)
  const threes = dailyStudySlice(threesAll, new Date(), STUDY_THREES)
  if (when) when.textContent = t('study_today', studyDateLabel())
  if (twosEl) twosEl.innerHTML = studyChips(twos)
  if (threesEl) threesEl.innerHTML = studyChips(threes)
  if (studyWa) {
    const readyStudy = twos.length || threes.length
    studyWa.hidden = !readyStudy
    studyWa.innerHTML = `${WA_ICON}${t('study_share')}`
    if (readyStudy) studyWa.href = waStudyHref(`${dailyStudyText(twos, threes)}\n${location.origin}${location.pathname}`)
    else studyWa.removeAttribute('href')
  }
  if (studyWaTwos) {
    studyWaTwos.hidden = !twosAll.length
    studyWaTwos.innerHTML = `${WA_ICON}${t('study_share_twos')}`
    if (twosAll.length) studyWaTwos.href = waStudyHref(`${studyListText(twosAll, 2)}\n${location.origin}${location.pathname}`)
    else studyWaTwos.removeAttribute('href')
  }
}

async function downloadLexicon() {
  const btn = document.getElementById('dict-download')
  if (!ready) {
    setLive(t('loading_lex'))
    return
  }
  const label = btn?.textContent
  if (btn) {
    btn.disabled = true
    btn.textContent = t('dict_downloading')
  }
  try {
    const result = await ask('export')
    const blob = new Blob([result.text || ''], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = lexiconFileName(getLang())
    a.click()
    URL.revokeObjectURL(url)
    setLive(liveCount(result.count || 0))
  } catch {
    setLive(t('dict_download_err'))
  } finally {
    if (btn) {
      btn.disabled = false
      btn.textContent = label || t('dict_download')
    }
  }
}

function renderLists() {
  if (listKind === 'values') {
    const vals = letterValues()
    const counts = letterCounts()
    const letters = Object.keys(vals)
    listsOut.innerHTML = `<div class="values">${letters.map((ch) => `
      <div class="val">
        <span class="tile">${ch}<small>${vals[ch]}</small></span>
        ×${counts[ch]}
      </div>`).join('')}
      <div class="val">
        <span class="tile blank">?<small>0</small></span>
        ×2
      </div>
    </div>
    <p class="empty">${t('values_note')}</p>`
    return
  }
  const list = listKind === '2' ? meta?.letters2 || [] : meta?.letters3 || []
  const cls = listKind === '2' ? 'grid2' : 'grid3'
  const share = list.length
    ? `<div class="list-share"><a class="wa-share" href="${escapeHtml(waStudyHref(studyListText(list, Number(listKind))))}" target="_blank" rel="noopener noreferrer">${WA_ICON}${t('study_share_list')}</a></div>`
    : ''
  listsOut.innerHTML = `<p class="result-sum">${t('list_count', list.length, listKind)}</p>
    ${share}
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

  if (nav === 'lists' || nav === 'info' || nav === 'game' || nav === 'board') return

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
    if (staleResult(result)) return
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
    const filters = findMode === 'multi' ? multiFilters() : null
    if (findMode === 'multi' ? !hasMultiFilter(filters) : raw.length < 2) {
      findOut.hidden = false
      findOut.innerHTML = `<p class="empty">${t('find_min')}</p>`
      return
    }
    if (!ready) {
      findOut.hidden = false
      findOut.innerHTML = `<p class="pending">Dictionnaire en cours de chargement…</p>`
      return
    }
    const result = await ask('find', { mode: findMode, q: raw, filters })
    if (staleResult(result)) return
    if (normalize(q.value) === raw && nav === 'check') {
      const summary = findMode === 'multi'
        ? [filters.start, filters.has, filters.end, filters.length || ''].filter(Boolean).join(' · ')
        : raw
      renderFind(result.words, summary)
    }
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
    if (staleResult(result)) return
    if (normalize(q.value) !== raw || nav !== 'rack') return
    const n = (result.groups || []).reduce((c, g) => c + g.words.length, 0)
    renderGroups(
      rackOut,
      result.groups,
      t('rack_none'),
      t('rack_summary', n)
    )
  }
}

function schedule() {
  clearTimeout(debounce)
  debounce = setTimeout(run, nav === 'check' && findMode === 'exact' ? 40 : 140)
}

async function showCompoundDef(lemma) {
  const current = normalize(q.value)
  setHistOpen(false)
  setNav('check')
  findMode = 'exact'
  const definition = await loadDefinition(lemma, { stable: true })
  if (current && ready) {
    const result = await ask('check', { word: current })
    if (staleResult(result)) return
    if (normalize(q.value) !== current || nav !== 'check') return
    if (result.ok) {
      renderCheck(current, { ...result, definition })
      return
    }
  }
  verdict.hidden = false
  verdict.className = 'verdict ok'
  const back = current ? backBtn(current, escapeHtml) : wordStack.length ? backBtn(wordStack.at(-1), escapeHtml) : ''
  verdict.innerHTML = `
    ${back}
    <div class="status">${t('def_heading')}</div>
    <p class="word">${escapeHtml(lemma)}</p>
    ${defsHtml(definition)}`
}

function openWord(word, opts = {}) {
  const original = String(word || '').trim()
  if (opts.fromDef && isCompoundLemma(original)) {
    showCompoundDef(original)
    return
  }
  const next = normalize(original)
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
  if (nav === 'info') renderStudy()
  if (nav === 'game') game?.open(challengeFromUrl())
  if (nav === 'board') game?.showBoard?.()
  if (nav === 'check' || nav === 'rack') run()
}

const feedbackSheet = document.getElementById('feedback-sheet')
const feedbackForm = document.getElementById('feedback-form')
const feedbackMsg = document.getElementById('feedback-msg')
const feedbackEmail = document.getElementById('feedback-email')
const feedbackHp = document.getElementById('feedback-hp')
const feedbackStatus = document.getElementById('feedback-status')
const feedbackSend = document.getElementById('feedback-send')
const feedbackFab = document.getElementById('fab-feedback')

function setFeedbackOpen(on) {
  if (!feedbackSheet) return
  feedbackSheet.hidden = !on
  feedbackFab?.setAttribute('aria-expanded', on ? 'true' : 'false')
  if (on) {
    if (feedbackStatus) {
      feedbackStatus.hidden = true
      feedbackStatus.textContent = ''
    }
    feedbackMsg?.focus()
  }
}

feedbackFab?.addEventListener('click', () => setFeedbackOpen(feedbackSheet?.hidden))
document.getElementById('feedback-close')?.addEventListener('click', () => setFeedbackOpen(false))
feedbackSheet?.addEventListener('click', (e) => {
  if (e.target === feedbackSheet) setFeedbackOpen(false)
})
feedbackForm?.addEventListener('submit', async (e) => {
  e.preventDefault()
  const message = String(feedbackMsg?.value || '').trim()
  if (message.length < 4) {
    if (feedbackStatus) {
      feedbackStatus.hidden = false
      feedbackStatus.className = 'feedback-status bad'
      feedbackStatus.textContent = t('feedback_need')
    }
    feedbackMsg?.focus()
    return
  }
  if (feedbackSend) {
    feedbackSend.disabled = true
    feedbackSend.textContent = t('feedback_sending')
  }
  if (feedbackStatus) feedbackStatus.hidden = true
  try {
    const user = getCurrentUser()
    const res = await fetch('/api/game/feedback', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        email: String(feedbackEmail?.value || '').trim(),
        name: user?.name || '',
        lang: getLang(),
        source: inApp ? 'android-web' : 'web',
        website: String(feedbackHp?.value || ''),
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.ok) throw new Error(data?.error || 'fail')
    if (feedbackStatus) {
      feedbackStatus.hidden = false
      feedbackStatus.className = 'feedback-status ok'
      feedbackStatus.textContent = t('feedback_ok')
    }
    if (feedbackMsg) feedbackMsg.value = ''
    setTimeout(() => setFeedbackOpen(false), 900)
  } catch {
    if (feedbackStatus) {
      feedbackStatus.hidden = false
      feedbackStatus.className = 'feedback-status bad'
      feedbackStatus.textContent = t('feedback_err')
    }
  } finally {
    if (feedbackSend) {
      feedbackSend.disabled = false
      feedbackSend.textContent = t('feedback_send')
    }
  }
})

histBtn?.addEventListener('click', () => setHistOpen(histSheet.hidden))
histClose?.addEventListener('click', () => setHistOpen(false))
document.getElementById('about-hist')?.addEventListener('click', () => setHistOpen(true))
document.getElementById('dict-download')?.addEventListener('click', () => downloadLexicon())
document.getElementById('hist-clear')?.addEventListener('click', async () => {
  if (!loadHistory().length) return
  if (!window.confirm(t('hist_clear_confirm'))) return
  clearHistory()
  paintHistBtn()
  renderHistory()
  if (getCurrentUser()) {
    try {
      const { clearCloudHistory } = await import('./competitive.js?v=77')
      await clearCloudHistory()
    } catch {
      /* offline */
    }
  }
})
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
  if (e.key === 'Escape') setDictOpen(false)
})

document.getElementById('about-link')?.addEventListener('click', () => setNav('info'))
document.querySelectorAll('[data-dict-list], #settings-dicts').forEach((list) => {
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-dict]')
    if (!btn) return
    const next = btn.dataset.dict
    if (dictSpec(next).id === next) {
      switchDict(next)
      setDictOpen(false)
    }
  })
})
document.getElementById('dict-sheet-close')?.addEventListener('click', () => setDictOpen(false))
document.getElementById('dict-sheet')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('dict-sheet')) setDictOpen(false)
})

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

multiTools?.querySelectorAll('input, select').forEach((field) => {
  field.addEventListener('input', schedule)
  field.addEventListener('change', run)
})
document.getElementById('find-apply')?.addEventListener('click', run)

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
    openWord(formOf.dataset.formOf, { fromDef: true })
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
  isKids,
  isTraining,
  onDeal(tiles, cat) {
    gameRack = tiles
    gameCat = cat
    writeUrl()
  },
  onPlayed({ word, pts }) {
    recordWords([{ word, pts, src: 'defi' }])
  },
})

function metaFile(id = getDict()) {
  if (id === 'csw' || id === 'yawl') return 'data/meta-en.json'
  if (id === 'wow24') return 'data/meta-en-wow24.json'
  if (id === 'rla') return 'data/meta-es.json'
  return 'data/meta.json'
}

async function loadMeta() {
  meta = await (await fetch(metaFile())).json()
  setLive(liveCount(meta.count))
  renderStudy()
}

async function reloadLexicon() {
  ready = false
  setLive(t('loading'))
  const wantedLang = getLang()
  const wantedDict = getDict()
  const result = await ask('load', { lang: wantedLang, dict: wantedDict })
  if (getLang() !== wantedLang || getDict() !== wantedDict) return
  ready = true
  setLive(liveCount(result.count))
  if (nav === 'check' || nav === 'rack') run()
  else if (nav === 'lists') renderLists()
  else if (nav === 'info') renderStudy()
  else if (nav === 'game' || nav === 'board') game?.refresh?.()
}

async function switchDict(id) {
  if (id === getDict()) return
  setDict(id)
  syncChrome()
  try {
    await loadMeta()
  } catch {
    /* keep previous meta */
  }
  try {
    await reloadLexicon()
  } catch (err) {
    setLive(t('lex_fail'))
    console.error(err)
  }
}

async function switchLang(next) {
  if (next === getLang()) return
  setLang(next)
  syncChrome()
  try {
    await loadMeta()
  } catch {
    /* keep previous meta */
  }
  try {
    await reloadLexicon()
  } catch (err) {
    setLive(t('lex_fail'))
    console.error(err)
  }
}

async function boot() {
  initLang()
  document.getElementById('lang-fr')?.addEventListener('click', () => switchLang('fr'))
  document.getElementById('lang-en')?.addEventListener('click', () => switchLang('en'))
  document.getElementById('lang-es')?.addEventListener('click', () => switchLang('es'))
  brandSub?.addEventListener('click', () => setDictOpen(true))
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
    await loadMeta()
    renderLists()
    renderStudy()
  } catch {
    setLive(t('lex_fail'))
  }
  try {
    const result = await ask('load', { lang: getLang() })
    ready = true
    setLive(liveCount(result.count))
    if (nav === 'check' || nav === 'rack') run()
    else if (nav === 'lists') renderLists()
    else if (nav === 'info') renderStudy()
    else if (nav === 'game') game.open(challengeFromUrl())
    else if (nav === 'board') game.showBoard()
  } catch (err) {
    setLive(t('lex_fail'))
    if (hint) hint.textContent = t('lex_fail')
    console.error(err)
  }
}

if ('serviceWorker' in navigator && !inApp) {
  navigator.serviceWorker.register('sw.js?v=77').catch(() => {})
}

window.addEventListener('resize', () => {
  if (nav === 'game' || nav === 'board') {
    syncChrome()
    showPanel(nav)
  }
})

document.getElementById('mode-defi')?.addEventListener('click', async () => {
  setGameMode('defi')
  if (nav === 'board') setNav('game')
  await game.switchMode('defi')
  syncChrome()
  showPanel(nav)
})

document.getElementById('mode-kids')?.addEventListener('click', async () => {
  setGameMode('kids')
  if (nav === 'board') setNav('game')
  await game.switchMode('kids')
  syncChrome()
  showPanel(nav)
})

document.getElementById('mode-training')?.addEventListener('click', async () => {
  setGameMode('training')
  if (nav === 'board') setNav('game')
  await game.switchMode('training')
  syncChrome()
  showPanel(nav)
})

document.getElementById('mode-comp')?.addEventListener('click', async () => {
  setGameMode('competitive')
  await game.switchMode('competitive')
  syncChrome()
  showPanel(nav)
})

document.getElementById('logout-btn')?.addEventListener('click', async () => {
  await logout()
  await game.switchMode(isKids() ? 'kids' : isCompetitive() ? 'competitive' : 'defi')
  if (histSheet && !histSheet.hidden) renderHistory()
})

document.addEventListener('verimots-auth', () => {
  syncCloudHistory()
})

boot()
