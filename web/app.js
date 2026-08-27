import { initGame, parseRack, linkifyDef, backBtn, tileValues, letterScore, dailyStudySlice, dailyStudyText, studyListText, studyDateLabel, STUDY_TWOS, STUDY_THREES, lexicalDefinition, defBody, extractFormOf, isInflectionDef } from './game.js?v=129'
import { loadHistory, rememberWord, mergeHistory, historyLabel, historyDayLabel, clearHistory } from './history.js?v=128'
import { loadFavorites, toggleFavorite, favButtonHtml, paintFavStar } from './favorites.js?v=128'
import { isCompetitive, isKids, isTraining, setGameMode, initGoogleSignIn, checkSession, handleGoogleCallback, logout, getCurrentUser, fetchDailyTrail, fetchLeaderboard, getTrailData } from './competitive.js?v=129'
import { initLang, setLang, setDict, getLang, getDict, getEsEdition, setEsEdition, dictSpec, dictLabel, t, DICTS } from './i18n.js?v=128'
import { tileSpec, tileGlyph, tileTokens, tileCount, encodeTiles, decodeRack } from './tiles.js?v=128'

function letterValues() {
  return tileValues(getLang())
}

/** Tile length of a display string (Spanish digraphs count once). */
function tlen(value) {
  return tileCount(String(value || ''), getLang(), getEsEdition())
}

/**
 * Ranked Bingo always plays with the international Spanish tiles — the
 * server generates and scores the weekly trail with that set.
 */
function effectiveEdition() {
  if (getLang() !== 'es') return 'fise'
  if (nav === 'game' && typeof isCompetitive === 'function' && isCompetitive() && !isKids() && !isTraining()) {
    return 'fise'
  }
  return getEsEdition()
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
const worker = new Worker('worker.js?v=84', { type: 'module' })
let seq = 0
const pending = new Map()
let ready = false
let advanced = false
let nav = 'game'
let openedPlayThisSession = false
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
  const edition = effectiveEdition()
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, lang, dict })
    worker.postMessage({ type, id, lang, dict, edition, ...payload })
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

function normalize(value, opts = {}) {
  const sentinel = '\ue000'
  let s = String(value || '')
    .normalize('NFC')
    .replace(/ñ/gi, sentinel)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replaceAll(sentinel.toUpperCase(), 'Ñ')
  if (getLang() === 'es') {
    // 1/2/3 type CH/LL/RR directly; in a rack, a separator (space, dash, ·)
    // keeps two single tiles apart: L·L is two L tiles, LL is the digraph.
    if (opts.rack) {
      s = s.replace(/[-\s,/]/g, '·').replace(/[^A-ZÑ123?.*·]/g, '').replace(/·+/g, '·').replace(/^·+/, '')
    } else {
      s = s.replace(/[^A-ZÑ123?.*]/g, '')
    }
    return s
  }
  return s.replace(/[^A-ZÑ?.*]/g, '')
}

function tilesHtml(word, jokers = [], opts = {}) {
  const jk = new Set(jokers)
  const tap = opts.tap
  const codes = [...encodeTiles(String(word || '').toUpperCase(), getLang(), getEsEdition())]
  const tokens = tileTokens(String(word || ''), getLang(), getEsEdition())
  const order = Array.isArray(opts.order) ? opts.order : tokens.map((_, i) => i)
  const values = letterValues()
  return `<div class="tiles">${order.map((i) => {
    const token = tokens[i]
    if (token == null) return ''
    const blank = jk.has(i) || token === '?'
    const pts = blank ? 0 : (values[codes[i]] || 0)
    const glyph = blank ? '?' : token
    const tag = tap ? 'button' : 'span'
    const extra = tap ? ` type="button" data-rack-i="${i}"` : ''
    return `<${tag} class="tile${blank ? ' blank' : ''}${glyph.length > 1 ? ' tile-digraph' : ''}"${extra}>${glyph}<small>${pts}</small></${tag}>`
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

const DEF_CACHE_KEY = 'verimots-definitions-v6'
const DEF_CACHE_TTL = 7 * 24 * 60 * 60 * 1000
const DEF_CACHE_MAX = 80
const defCache = new Map()
let defSeq = 0

function readStoredDefinition(key) {
  try {
    const all = JSON.parse(localStorage.getItem(DEF_CACHE_KEY) || '{}')
    const hit = all?.[key]
    if (!hit || Date.now() - Number(hit.at || 0) > DEF_CACHE_TTL) return null
    const value = lexicalDefinition(hit.value)
    if (!value?.found || !value.senses?.length) return null
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
    return `Verimots · ${dictLabel()}\n\n*${t('share_valid', share.word, dictLabel())}*\n${t('letters_pts', tlen(share.word), share.score)}\n${def}\n${link}`
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
  return lexicalDefinition(payload)?.senses?.[0]?.defs?.[0] || ''
}

function defsHtml(payload) {
  payload = lexicalDefinition(payload)
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
  // The pos header names the defined word so the reader always knows which
  // entry is open, root navigation included.
  const headWord = String(payload.word || '').toUpperCase()
  const blocks = payload.senses.slice(0, 2).map((sense) => `
    <div class="sense">
      <div class="pos">${[headWord && escapeHtml(headWord), sense.pos && escapeHtml(sense.pos)].filter(Boolean).join(' · ')}</div>
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
    const cleaned = lexicalDefinition(data)
    if (cleaned?.ok && cleaned.found) {
      defCache.set(cacheKey, cleaned)
      storeDefinition(cacheKey, cleaned)
    }
    return cleaned
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

function paintAboutCount(n) {
  const aboutLex = document.getElementById('about-lex')
  if (!aboutLex) return
  if (n == null || n === '') {
    aboutLex.textContent = ''
    return
  }
  if (typeof n === 'string') {
    aboutLex.textContent = n
    return
  }
  const locale = getLang() === 'en' ? 'en-GB' : getLang() === 'es' ? 'es-ES' : 'fr-FR'
  aboutLex.innerHTML = `<strong>${Number(n).toLocaleString(locale)}</strong> ${t('about_words')}`
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
  const sub = document.getElementById('hist-sub')
  const clearBtn = document.getElementById('hist-clear')
  if (title) title.textContent = t('hist_local')
  if (sub) {
    sub.hidden = !getCurrentUser()
    sub.textContent = getCurrentUser() ? t('hist_signed') : ''
  }
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
  let lastDay = ''
  const blocks = []
  for (const row of rows) {
    const day = historyDayLabel(row.at)
    if (day && day !== lastDay) {
      lastDay = day
      blocks.push(`<p class="hist-day">${escapeHtml(day)}</p>`)
    }
    blocks.push(`<div class="hist-row">
      <button type="button" class="hist-row-main" data-word="${escapeHtml(row.word)}">
        <span class="hist-row-word">${escapeHtml(row.word)}</span>
        <span class="hist-row-meta">${escapeHtml(historyLabel(row.src))}</span>
        <span class="hist-row-pts">${row.pts}</span>
      </button>
      ${favButtonHtml(row.word, row.pts, escapeHtml)}
    </div>`)
  }
  histOut.innerHTML = blocks.join('')
}

const favSheet = document.getElementById('fav-sheet')
const favOut = document.getElementById('fav-out')

function renderFavorites() {
  if (!favOut) return
  const title = document.getElementById('fav-title')
  if (title) title.textContent = t('fav_title')
  const rows = loadFavorites().slice().sort((a, b) => (b.at || 0) - (a.at || 0))
  if (!rows.length) {
    favOut.innerHTML = `<p class="empty">${t('fav_empty')}</p>`
    return
  }
  favOut.innerHTML = rows
    .map(
      (row) => `<div class="hist-row">
      <button type="button" class="hist-row-main" data-word="${escapeHtml(row.word)}">
        <span class="hist-row-word">${escapeHtml(row.word)}</span>
        <span class="hist-row-meta">${escapeHtml(historyDayLabel(row.at))}</span>
        <span class="hist-row-pts">${row.pts || ''}</span>
      </button>
      ${favButtonHtml(row.word, row.pts, escapeHtml)}
    </div>`
    )
    .join('')
}

function setFavOpen(on) {
  if (!favSheet) return
  favSheet.hidden = !on
  if (on) renderFavorites()
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
    import('./competitive.js?v=129').then(({ saveHistoryWord }) => {
      for (const entry of entries) if (entry?.word) saveHistoryWord(entry)
    }).catch(() => {})
  }
}

async function syncCloudHistory() {
  if (!getCurrentUser()) return
  try {
    const { fetchHistory } = await import('./competitive.js?v=129')
    const remote = await fetchHistory()
    if (!remote.ok) return
    mergeHistory(remote.history)
    paintHistBtn()
    if (histSheet && !histSheet.hidden) renderHistory()
    const local = loadHistory()
    const remoteWords = new Set((remote.history || []).map((row) => row.word))
    const { saveHistoryWord } = await import('./competitive.js?v=129')
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
  return isDesk() && (isCompetitive() || isKids()) && nav === 'game' && gamePlayEl && !gamePlayEl.hidden
}

function showPanel(name) {
  document.querySelectorAll('[data-panel]').forEach((el) => {
    el.hidden = el.dataset.panel !== name
  })
  document.body.classList.toggle('game-split', boardSplit())
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
  if (nav === 'rack') p.set('vue', 'tiroir')
  if (nav === 'info') p.set('vue', 'info')
  if (nav === 'board') p.set('vue', 'classement')
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
  const vue = p.get('vue')
  if (word && !vue) {
    nav = 'check'
  } else if (!vue) {
    nav = 'game'
  } else {
    nav =
      vue === 'jeu'
        ? 'game'
        : vue === 'classement'
          ? 'board'
          : vue === 'tiroir'
            ? 'rack'
            : ['check', 'lists', 'info', 'rack', 'game', 'board'].includes(vue)
              ? vue
              : 'game'
  }
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
  // State classes owned by game.js survive the rebuild.
  const keep = ['auth-gate', 'has-chart'].filter((c) => document.body.classList.contains(c)).map((c) => ` ${c}`).join('')
  document.body.className = `${advanced ? 'advanced' : 'simple'} view-${nav}${inApp ? ' in-app' : ''}${keepClosed ? ' game-closed' : ''}${boardSplit() ? ' game-split' : ''}${isKids() ? ' kids' : ''}${isTraining() ? ' training' : ''}${keep}`
  if (brandSub) {
    brandSub.textContent = dictLabel()
    brandSub.setAttribute('aria-label', `${t('dict_open')} · ${dictLabel()}`)
  }
  paintDictPop()
  const brandHome = document.getElementById('brand-home')
  if (brandHome) {
    brandHome.href = `https://verimots.pfa87.cc/?lang=${getLang()}`
    brandHome.setAttribute('aria-label', t('home'))
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
  if (advToggle) advToggle.setAttribute('aria-pressed', advanced ? 'true' : 'false')
  advNav.hidden = !advanced || nav === 'game' || nav === 'board'
  search.hidden = nav === 'game' || nav === 'lists' || nav === 'info' || nav === 'board'
  document.querySelectorAll('#tabs [data-tab]').forEach((btn) => {
    const key = btn.dataset.tab
    const on =
      key === nav ||
      (nav === 'rack' && key === 'check') ||
      (nav === 'lists' && key === 'info')
    btn.setAttribute('aria-current', on ? 'page' : 'false')
  })
  paintDicts()
  qLabel.textContent = nav === 'rack' ? t('q_label_rack') : t('q_label')
  q.placeholder = placeholders[nav] || placeholders.check
  q.maxLength = getLang() === 'es' ? (nav === 'rack' ? 26 : 17) : nav === 'rack' ? 16 : 15
  if (qJoker) qJoker.hidden = nav !== 'rack'
  if (hint) {
    hint.textContent = hints[findMode] || hints.exact
    // The exact check speaks for itself — the "Dans la liste ?" line was noise.
    hint.hidden = findMode === 'exact'
  }
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
  const changed = nav !== name
  nav = name
  if (name !== 'check') findMode = 'exact'
  syncChrome()
  showPanel(name)
  if (changed) window.scrollTo(0, 0)
  if (name === 'lists') renderLists()
  if (name === 'info') renderStudy()
  if (name === 'game') enterGame()
  mountBoardPage(name === 'board')
  if (name === 'check' || name === 'rack') {
    renderRackPreview()
    run()
    q.focus()
  }
  writeUrl()
}

// The leaderboard has its own tab: the board node moves into the page and
// back to the game rail, so game.js keeps painting one element.
const boardPageEl = document.getElementById('board-page')
function mountBoardPage(on) {
  const boardEl = document.getElementById('game-board')
  const rail = document.getElementById('play-rail')
  if (!boardEl || !boardPageEl || !rail) return
  if (on) {
    if (boardEl.parentElement !== boardPageEl) boardPageEl.appendChild(boardEl)
    game.setBoardPage(true)
  } else {
    if (boardEl.parentElement !== rail) rail.insertBefore(boardEl, document.getElementById('game-dock'))
    game.setBoardPage(false)
  }
}

function setAdvanced(on) {
  advanced = on
  if (!advanced && nav !== 'game' && nav !== 'info' && nav !== 'board') {
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
  const raw = normalize(q.value, { rack: nav === 'rack' })
  if (blankCount(raw) >= 2 || tlen(raw) >= 16) return
  q.value = raw + '?'
  q.focus()
  run()
}

function renderRackPreview() {
  const raw = normalize(q.value, { rack: true })
  if (nav !== 'rack') {
    rackPreview.hidden = true
    rackPreview.innerHTML = ''
    return
  }
  rackPreview.hidden = false
  const blanks = blankCount(raw)
  const n = tlen(raw)
  const canAdd = blanks < 2 && n < 16
  const tiles = raw
    ? tilesHtml(raw, [], { tap: true })
    : `<div class="tiles"></div>`
  rackPreview.innerHTML = `${tiles}
    <button type="button" class="tile add-blank" id="rack-add-blank" ${canAdd ? '' : 'disabled'} aria-label="Ajouter un joker">?<small>+</small></button>
    <p class="preview-cap">${raw ? `${n} lettre${n > 1 ? 's' : ''}` : 'Tapez A–Z ou posez un ?'}${blanks ? ` · ${blanks} joker${blanks > 1 ? 's' : ''}` : ''}</p>`
}

const dailyEl = document.getElementById('daily')
let dailySeq = 0
let dailySeen = false

// A word to discover on the empty check page: the day's word first, then a
// random one each time the field is cleared or the shuffle is tapped.
async function renderDaily(random = dailySeen) {
  if (!dailyEl) return
  if (nav !== 'check' || findMode !== 'exact' || normalize(q.value) || !ready) {
    dailyEl.hidden = true
    return
  }
  const seq = ++dailySeq
  let daily = null
  try {
    daily = await ask('daily', { random })
  } catch {
    daily = null
  }
  dailySeen = true
  if (seq !== dailySeq || !daily?.word || staleResult(daily)) return
  if (nav !== 'check' || normalize(q.value)) return
  const loc = getLang() === 'en' ? 'en-GB' : getLang() === 'es' ? 'es-ES' : 'fr-FR'
  const when = new Date().toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' })
  dailyEl.hidden = false
  dailyEl.innerHTML = `
    <div class="daily-head">
      <p class="daily-kicker">${escapeHtml(t('daily_title'))}</p>
      <span class="daily-side">
        ${daily.random ? '' : `<span class="daily-date">${escapeHtml(when)}</span>`}
        <button type="button" class="daily-next" id="daily-next" aria-label="${escapeHtml(t('daily_next'))}" title="${escapeHtml(t('daily_next'))}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.75 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
        </button>
      </span>
    </div>
    <button type="button" class="daily-word" data-word="${escapeHtml(daily.word)}">
      ${tilesHtml(daily.word)}
      <span class="daily-meta">${t('letters_pts', daily.tiles ?? tlen(daily.word), daily.score)}</span>
      <span class="daily-tap">${escapeHtml(t('daily_tap'))} →</span>
    </button>
    <div class="game-def-body" id="daily-def">${defBody(null, escapeHtml)}</div>`
  const payload = await loadDefinition(daily.word, { stable: true })
  if (seq !== dailySeq || dailyEl.hidden) return
  const blob = (payload?.senses || []).flatMap((s) => s.defs).join(' ')
  const formOf = extractFormOf(blob)
  const inflection = payload?.found && (payload.senses || []).every((s) => s.defs.every(isInflectionDef))
  const root = inflection && formOf ? await loadDefinition(formOf, { stable: true }) : null
  if (seq !== dailySeq || dailyEl.hidden) return
  const box = document.getElementById('daily-def')
  if (box) box.innerHTML = defBody(payload, escapeHtml, { formOf, root, word: daily.word })
}

dailyEl?.addEventListener('click', (e) => {
  if (e.target.closest('#daily-next')) {
    e.stopPropagation()
    renderDaily(true)
  }
})

function renderCheck(word, result) {
  findOut.hidden = true
  if (!word) {
    verdict.hidden = true
    verdict.className = 'verdict idle'
    lastShare = null
    renderDaily()
    return
  }
  if (dailyEl) dailyEl.hidden = true
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
  // Tiles already spell the word — no duplicate headline. Star sits top-right,
  // share is a small round WhatsApp icon like in the games.
  const waMini = `<a class="wa-mini" href="${escapeHtml(waHref(lastShare))}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(lastShare.ok ? t('share_wa') : t('share_refuse'))}" title="${escapeHtml(lastShare.ok ? t('share_wa') : t('share_refuse'))}">${WA_ICON}</a>`
  if (result.ok) {
    verdict.className = 'verdict ok'
    verdict.innerHTML = `
      ${back}
      <div class="verdict-head">
        <div class="status">${t('playable', dictLabel())}</div>
        ${favButtonHtml(result.word, result.score, escapeHtml)}
      </div>
      ${tilesHtml(result.word)}
      <div class="meta-line">
        <span>${result.unplayable ? t('unplayable_kw') : t('letters_pts', result.tiles ?? tlen(result.word), result.score)}</span>
        <span class="meta-actions">
          ${waMini}
          <a href="${escapeHtml(result.definition?.url || wikiUrl(result.word, result.definition?.lemma))}" target="_blank" rel="noopener noreferrer">${t('wiki')}</a>
        </span>
      </div>
      ${defsHtml(result.definition)}`
  } else {
    verdict.className = 'verdict no'
    verdict.innerHTML = `
      ${back}
      <div class="verdict-head">
        <div class="status">${t('not_in_list', dictLabel())}</div>
        ${waMini}
      </div>
      <p class="word">${(result && result.word) || word}</p>
      <p class="empty">${t('not_a_form')}</p>`
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
          const letters = tileTokens(w.word, getLang(), getEsEdition())
            .map((glyph, i) =>
              (w.jokers || []).includes(i) ? `<span class="jk" title="${glyph}">?</span>` : glyph
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

const dictPop = document.getElementById('dict-pop')

function dictPopOpen() {
  return Boolean(dictPop && !dictPop.hidden)
}

function setDictOpen(on) {
  if (!dictPop || !brandSub) return
  dictPop.hidden = !on
  brandSub.classList.toggle('is-open', on)
  brandSub.setAttribute('aria-expanded', on ? 'true' : 'false')
  if (on) paintDictPop()
}

function paintDictPop() {
  if (!dictPop) return
  const current = getDict()
  dictPop.innerHTML = DICTS.map((item) => {
    const on = item.id === current
    const lang = item.lang === 'fr' ? 'FR' : item.lang === 'en' ? 'EN' : 'ES'
    return `<button type="button" role="option" class="dict-pop-item${on ? ' is-on' : ''}" data-dict="${item.id}" aria-selected="${on ? 'true' : 'false'}">
      <span class="dict-pop-lang">${lang}</span>
      <span>${escapeHtml(dictLabel(item.id))}</span>
    </button>`
  }).join('')
}

async function paintDicts() {
  const current = getDict()
  document.querySelectorAll('#settings-dicts [data-dict]').forEach((btn) => {
    const on = btn.dataset.dict === current
    btn.setAttribute('aria-pressed', on ? 'true' : 'false')
    btn.setAttribute('aria-checked', on ? 'true' : 'false')
  })
  const editionBox = document.getElementById('es-edition')
  if (editionBox) {
    editionBox.hidden = current !== 'rla'
    editionBox.querySelectorAll('[data-es-edition]').forEach((btn) => {
      const on = btn.dataset.esEdition === getEsEdition()
      btn.setAttribute('aria-pressed', on ? 'true' : 'false')
      btn.setAttribute('aria-checked', on ? 'true' : 'false')
    })
  }
  paintDictPop()
  const info = await loadDictsInfo()
  const locale = getLang() === 'en' ? 'en-GB' : getLang() === 'es' ? 'es-ES' : 'fr-FR'
  document.querySelectorAll('[data-dict-meta]').forEach((el) => {
    const row = info?.[el.dataset.dictMeta]
    if (!row) return
    el.textContent = t('dict_stats', Number(row.count || 0).toLocaleString(locale), statsDate(row.inForce, locale))
  })
}

function waStudyHref(text) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

function studyChips(words) {
  return (words || []).map((w) => {
    const pts = letterScore(w)
    return `<button type="button" class="study-tile${pts >= 8 ? ' study-tile-hot' : ''}" data-study-word="${escapeHtml(w)}">
      <span class="study-tile-word">${escapeHtml(w)}</span>
      <span class="study-tile-pts">${pts}</span>
    </button>`
  }).join('')
}

function renderStudy() {
  const when = document.getElementById('study-when')
  const twosEl = document.getElementById('study-twos')
  const threesEl = document.getElementById('study-threes')
  const twosLabel = document.getElementById('study-twos-label')
  const threesLabel = document.getElementById('study-threes-label')
  const studyWa = document.getElementById('study-wa')
  const studyWaTwos = document.getElementById('study-wa-twos')
  if (!twosEl && !threesEl) return
  const twosAll = metaList('letters2')
  const threesAll = metaList('letters3')
  const twos = dailyStudySlice(twosAll, new Date(), STUDY_TWOS)
  const threes = dailyStudySlice(threesAll, new Date(), STUDY_THREES)
  if (when) when.textContent = t('study_today', studyDateLabel())
  if (twosLabel) twosLabel.textContent = `${t('study_twos')} · ${twos.length}`
  if (threesLabel) threesLabel.textContent = `${t('study_threes')} · ${threes.length}`
  if (twosEl) twosEl.innerHTML = studyChips(twos)
  if (threesEl) threesEl.innerHTML = studyChips(threes)
  hideStudyDef()
  if (studyWa) {
    const readyStudy = twos.length || threes.length
    studyWa.hidden = !readyStudy
    studyWa.innerHTML = `${WA_ICON}${t('study_share_short')}`
    if (readyStudy) studyWa.href = waStudyHref(`${dailyStudyText(twos, threes)}\n${location.origin}${location.pathname}`)
    else studyWa.removeAttribute('href')
  }
  if (studyWaTwos) {
    studyWaTwos.hidden = !twos.length
    studyWaTwos.innerHTML = `${WA_ICON}${t('share_study_twos')}`
    if (twos.length) studyWaTwos.href = waStudyHref(`${studyListText(twos, 2)}\n${location.origin}${location.pathname}`)
    else studyWaTwos.removeAttribute('href')
  }
}

// ---- Challenge menu (game picker + level) ----
const gameMenuEl = document.getElementById('game-menu')
const gamePlayEl = document.getElementById('game-play')
const gameStudyEl = document.getElementById('game-study')

function getLevel() {
  try {
    return localStorage.getItem('verimots-level') === 'beginner' ? 'beginner' : 'confirmed'
  } catch {
    return 'confirmed'
  }
}

function paintLevel() {
  const beginner = getLevel() === 'beginner'
  document.getElementById('level-beginner')?.setAttribute('aria-pressed', beginner ? 'true' : 'false')
  document.getElementById('level-confirmed')?.setAttribute('aria-pressed', beginner ? 'false' : 'true')
}

function setLevel(next) {
  try {
    localStorage.setItem('verimots-level', next === 'beginner' ? 'beginner' : 'confirmed')
  } catch {
    /* private mode */
  }
  paintLevel()
}

function showGameView(view = 'menu') {
  if (gameMenuEl) gameMenuEl.hidden = view !== 'menu'
  if (gamePlayEl) gamePlayEl.hidden = view !== 'play'
  if (gameStudyEl) gameStudyEl.hidden = view !== 'study'
  const dock = document.getElementById('game-dock')
  if (view !== 'play') {
    if (dock) dock.hidden = true
    document.body.classList.remove('has-chart')
  }
  document.body.classList.toggle('game-split', boardSplit())
}

function hideStudyDef() {
  const box = document.getElementById('study-def')
  if (box) box.hidden = true
  document.querySelectorAll('.study-tile.is-on').forEach((el) => el.classList.remove('is-on'))
}

// Same definition pipeline as the game result: lexical filtering, "forme de"
// resolution and linkified words, instead of the old raw first line.
async function resolvedStudyDef(word) {
  const payload = await loadDefinition(word, { stable: true })
  const blob = (payload?.senses || []).flatMap((s) => s.defs).join(' ')
  const formOf = extractFormOf(blob)
  const inflection = payload?.found && (payload.senses || []).every((s) => s.defs.every(isInflectionDef))
  let root = null
  if (inflection && formOf) root = await loadDefinition(formOf, { stable: true })
  return { payload, formOf, root }
}

let studySeq = 0
let studyHome = null

async function showStudyDef(word, tile) {
  const box = document.getElementById('study-def')
  const wordEl = document.getElementById('study-def-word')
  const textEl = document.getElementById('study-def-text')
  if (!box || !wordEl || !textEl) return
  if (tile?.classList.contains('is-on')) {
    hideStudyDef()
    return
  }
  hideStudyDef()
  tile?.classList.add('is-on')
  const seq = ++studySeq
  studyHome = null
  wordEl.textContent = word
  const favBtn = document.getElementById('study-def-fav')
  if (favBtn) {
    favBtn.hidden = false
    favBtn.dataset.favWord = word
    favBtn.dataset.favPts = String(letterScore(word))
    paintFavStar(favBtn)
  }
  textEl.innerHTML = defBody(null, escapeHtml)
  box.hidden = false
  const resolved = await resolvedStudyDef(word)
  if (seq !== studySeq || !tile?.classList.contains('is-on')) return
  studyHome = { word, ...resolved }
  textEl.innerHTML = defBody(resolved.payload, escapeHtml, { formOf: resolved.formOf, root: resolved.root, word })
}

document.getElementById('study-def')?.addEventListener('click', async (e) => {
  const textEl = document.getElementById('study-def-text')
  if (!textEl) return
  if (e.target.closest('[data-def-back]')) {
    if (studyHome) {
      textEl.innerHTML = defBody(studyHome.payload, escapeHtml, { formOf: studyHome.formOf, root: studyHome.root, word: studyHome.word })
    }
    return
  }
  const btn = e.target.closest('[data-form-of]')
  if (!btn) return
  const root = btn.dataset.formOf
  if (!root) return
  const seq = ++studySeq
  textEl.innerHTML = `<p class="pending">${t('sense_of', escapeHtml(root))}</p>`
  const resolved = await resolvedStudyDef(root)
  if (seq !== studySeq) return
  textEl.innerHTML = `${backBtn(studyHome?.word || '', escapeHtml)}${defBody(resolved.payload, escapeHtml, { asRoot: true })}`
})

async function enterGame() {
  const fromUrl = challengeFromUrl()
  if (parseRack(fromUrl.rack).length >= 2) {
    openedPlayThisSession = true
    showGameView('play')
    if (ready) game.open(fromUrl)
    return
  }
  if (gameStudyEl && !gameStudyEl.hidden) return
  if (!openedPlayThisSession) {
    // First visit lands on the game menu: pick a game before being dealt into Bingo.
    openedPlayThisSession = true
    showGameView('menu')
    return
  }
  if (gamePlayEl?.hidden) return
  if (ready && isCompetitive()) {
    await game.switchMode('competitive')
    syncChrome()
    showPanel(nav)
  }
}

gameMenuEl?.addEventListener('click', async (e) => {
  const picked = e.target.closest('[data-game]')
  if (!picked) return
  const choice = picked.dataset.game
  if (choice === 'study') {
    renderStudy()
    showGameView('study')
    return
  }
  const level = getLevel()
  let mode = choice
  if (choice === 'find') mode = level === 'beginner' ? 'kids' : 'defi'
  setGameMode(mode)
  showGameView('play')
  await game.switchMode(mode)
  syncChrome()
  showPanel(nav)
})

document.getElementById('level-beginner')?.addEventListener('click', () => setLevel('beginner'))
document.getElementById('level-confirmed')?.addEventListener('click', () => setLevel('confirmed'))
document.getElementById('game-hub-back')?.addEventListener('click', () => setNav('check'))
document.getElementById('game-menu-back')?.addEventListener('click', () => showGameView('menu'))
document.getElementById('study-back')?.addEventListener('click', () => showGameView('menu'))
// Petits Mots → "Mode défi": the Combinaisons game restricted to 2–3 letter words.
document.getElementById('study-challenge')?.addEventListener('click', async () => {
  setGameMode('training')
  showGameView('play')
  await game.setTrainingPreset('small', { silent: true })
  await game.switchMode('training', { force: true })
  syncChrome()
  showPanel(nav)
})

let dictsInfo = null

async function loadDictsInfo() {
  if (dictsInfo) return dictsInfo
  try {
    dictsInfo = await (await fetch('data/dicts.json', { cache: 'no-cache' })).json()
  } catch {
    dictsInfo = {}
  }
  return dictsInfo
}

function statsDate(iso, locale) {
  if (!iso) return ''
  const [y, m, d] = String(iso).split('-').map(Number)
  if (!y || !m || !d) return String(iso)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function metaList(kind) {
  const block = getLang() === 'es' ? meta?.editions?.[getEsEdition()] : null
  return (block || meta || {})[kind] || []
}

function renderLists() {
  if (listKind === 'values') {
    const spec = tileSpec(getLang(), getEsEdition())
    listsOut.innerHTML = `<div class="values">${spec.order.map((ch) => {
      const glyph = tileGlyph(ch)
      return `
      <div class="val">
        <span class="tile${glyph.length > 1 ? ' tile-digraph' : ''}">${glyph}<small>${spec.values[ch]}</small></span>
        ×${spec.bag[ch]}
      </div>`
    }).join('')}
      <div class="val">
        <span class="tile blank">?<small>0</small></span>
        ×2
      </div>
    </div>
    <p class="empty">${t('values_note')}</p>`
    return
  }
  const list = listKind === '2' ? metaList('letters2') : metaList('letters3')
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
  const raw = normalize(q.value, { rack: nav === 'rack' })
  q.value = raw
  clearBtn.hidden = raw.length === 0
  renderRackPreview()
  if (addJoker) addJoker.disabled = blankCount(raw) >= 2 || tlen(raw) >= 16
  if (qJoker) qJoker.disabled = blankCount(raw) >= 2 || tlen(raw) >= 16
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
    if (dailyEl) dailyEl.hidden = true
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
    if (tlen(raw) < 2) {
      renderRackEmpty()
      return
    }
    rackHelp.hidden = true
    if (!ready) {
      rackOut.innerHTML = `<p class="pending">Dictionnaire en cours de chargement…</p>`
      return
    }
    const max = rackLen === 'all' ? tlen(raw) : Number(rackLen)
    const min = rackLen === 'all' ? 2 : Number(rackLen)
    const result = await ask('anagram', { rack: raw, min, max })
    if (staleResult(result)) return
    if (normalize(q.value, { rack: true }) !== raw || nav !== 'rack') return
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
  if (nav === 'game') enterGame()
  mountBoardPage(nav === 'board')
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
document.getElementById('info-feedback')?.addEventListener('click', () => setFeedbackOpen(true))
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

const trainingHelp = document.getElementById('training-help')
const TRAINING_RULE_KEYS = ['training_rules_all', 'training_rules_seven', 'training_rules_eight', 'training_rules_plus_one', 'training_rules_joker', 'training_rules_hard', 'training_rules_small']
function openTrainingHelp() {
  const body = document.getElementById('training-help-body')
  const title = document.getElementById('training-help-title')
  if (!trainingHelp || !body) return
  if (title) title.textContent = t('training_rules_title')
  body.innerHTML = `<p>${escapeHtml(t('training_rules_goal'))}</p>
    <ul>${TRAINING_RULE_KEYS.map((k) => `<li>${escapeHtml(t(k))}</li>`).join('')}</ul>
    <p>${escapeHtml(t('training_rules_help'))}</p>
    <p>${escapeHtml(t('training_rules_reveal'))}</p>
    <p class="fine">${escapeHtml(t('training_rules_unranked'))}</p>`
  trainingHelp.hidden = false
}
document.getElementById('training-info')?.addEventListener('click', openTrainingHelp)
document.getElementById('training-help-close')?.addEventListener('click', () => {
  if (trainingHelp) trainingHelp.hidden = true
})
trainingHelp?.addEventListener('click', (e) => {
  if (e.target === trainingHelp) trainingHelp.hidden = true
})
histClose?.addEventListener('click', () => setHistOpen(false))
document.getElementById('about-hist')?.addEventListener('click', () => setHistOpen(true))
document.getElementById('about-favs')?.addEventListener('click', () => setFavOpen(true))
document.getElementById('fav-close')?.addEventListener('click', () => setFavOpen(false))
favSheet?.addEventListener('click', (e) => {
  if (e.target === favSheet) setFavOpen(false)
})
favOut?.addEventListener('click', (e) => {
  if (e.target.closest('[data-fav-word]')) return
  if (e.target.closest('[data-word]')) setFavOpen(false)
})
document.getElementById('hist-clear')?.addEventListener('click', async () => {
  if (!loadHistory().length) return
  if (!window.confirm(t('hist_clear_confirm'))) return
  clearHistory()
  paintHistBtn()
  renderHistory()
  if (getCurrentUser()) {
    try {
      const { clearCloudHistory } = await import('./competitive.js?v=129')
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
  if (e.key === 'Escape' && dictPopOpen()) {
    setDictOpen(false)
    return
  }
  if (e.key === 'Escape' && histSheet && !histSheet.hidden) setHistOpen(false)
  if (e.key === 'Escape' && favSheet && !favSheet.hidden) setFavOpen(false)
})
document.addEventListener('click', (e) => {
  if (!dictPopOpen()) return
  if (e.target.closest('.dict-wrap')) return
  setDictOpen(false)
})

document.getElementById('brand-home')?.addEventListener('click', (e) => {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return
  if (!inApp) return
  e.preventDefault()
  if (histSheet && !histSheet.hidden) setHistOpen(false)
  q.value = ''
  findMode = 'exact'
  setNav('game')
})
document.getElementById('settings-dicts')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-dict]')
  if (!btn) return
  const next = btn.dataset.dict
  if (dictSpec(next).id === next) switchDict(next)
})
document.getElementById('es-edition')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-es-edition]')
  if (!btn) return
  switchEsEdition(btn.dataset.esEdition)
})
dictPop?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-dict]')
  if (!btn) return
  const next = btn.dataset.dict
  setDictOpen(false)
  if (dictSpec(next).id === next) switchDict(next)
})

advToggle?.addEventListener('click', () => setAdvanced(!advanced))

document.querySelectorAll('#adv-nav [data-nav]').forEach((btn) => {
  btn.addEventListener('click', () => setNav(btn.dataset.nav))
})

document.querySelectorAll('#tabs [data-tab]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const name = btn.dataset.tab
    if (name === 'game' && nav === 'game') {
      showGameView('menu')
      return
    }
    setNav(name)
  })
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
  // One handler for every star — game result, check card, study popup, lists.
  const fav = e.target.closest('[data-fav-word]')
  if (fav) {
    toggleFavorite(fav.dataset.favWord, Number(fav.dataset.favPts) || 0)
    paintFavStar(fav)
    return
  }
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
    const raw = normalize(q.value, { rack: true })
    const codes = [...encodeTiles(raw, getLang(), getEsEdition())]
    codes.splice(i, 1)
    q.value = decodeRack(codes.join(''), getLang(), getEsEdition())
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
  const study = e.target.closest('[data-study-word]')
  if (study) {
    showStudyDef(study.dataset.studyWord, study)
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
  paintAboutCount(meta.count)
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
  paintAboutCount(result.count)
  if (nav === 'check' || nav === 'rack') run()
  else if (nav === 'lists') renderLists()
  else if (nav === 'info') renderStudy()
  else if (nav === 'game') game?.refresh?.()
  else if (nav === 'board') await game?.showBoard?.()
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
    paintAboutCount(t('lex_fail'))
    console.error(err)
  }
}

async function switchEsEdition(next) {
  if (getLang() !== 'es' || next === getEsEdition()) return
  setEsEdition(next)
  paintDicts()
  renderStudy()
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
    paintAboutCount(t('lex_fail'))
    console.error(err)
  }
}

function initAlphaBtnOption() {
  const opt = document.getElementById('opt-alpha-btn')
  if (!opt) return
  let on = false
  try {
    on = localStorage.getItem('verimots-alpha-btn') === '1'
  } catch {
    /* private mode */
  }
  opt.checked = on
  opt.addEventListener('change', () => {
    try {
      localStorage.setItem('verimots-alpha-btn', opt.checked ? '1' : '0')
    } catch {
      /* private mode */
    }
    const alphaBtn = document.getElementById('game-alpha')
    if (alphaBtn) alphaBtn.hidden = !opt.checked
  })
}

async function boot() {
  initLang()
  initAlphaBtnOption()
  document.getElementById('lang-fr')?.addEventListener('click', () => switchLang('fr'))
  document.getElementById('lang-en')?.addEventListener('click', () => switchLang('en'))
  document.getElementById('lang-es')?.addEventListener('click', () => switchLang('es'))
  brandSub?.addEventListener('click', (e) => {
    e.stopPropagation()
    setDictOpen(!dictPopOpen())
  })
  readUrl()
  syncChrome()
  paintApkLink()
  try {
    const user = await checkSession()
    game.setUser(user)
    if (user) await syncCloudHistory()
  } catch {
    /* not signed in */
  }
  paintHistBtn()
  showPanel(nav)
  if (nav === 'game') enterGame()
  try {
    await loadMeta()
    renderLists()
    renderStudy()
  } catch {
    setLive(t('lex_fail'))
    paintAboutCount(t('lex_fail'))
  }
  try {
    const result = await ask('load', { lang: getLang() })
    ready = true
    setLive(liveCount(result.count))
    paintAboutCount(result.count)
    if (nav === 'check' || nav === 'rack') run()
    else if (nav === 'lists') renderLists()
    else if (nav === 'info') renderStudy()
    else if (nav === 'game') enterGame()
    else if (nav === 'board') mountBoardPage(true)
  } catch (err) {
    setLive(t('lex_fail'))
    paintAboutCount(t('lex_fail'))
    if (hint) hint.textContent = t('lex_fail')
    console.error(err)
  }
  paintLevel()
}

if ('serviceWorker' in navigator && !inApp) {
  navigator.serviceWorker.register('sw.js?v=129').catch(() => {})
}

window.addEventListener('resize', () => {
  if (nav === 'game') {
    syncChrome()
    showPanel(nav)
  }
})


document.getElementById('logout-btn')?.addEventListener('click', async () => {
  await logout()
  game.setUser(null)
  // Force the ranked view to rebuild: the sign-in gate comes back in Bingo.
  await game.switchMode(isKids() ? 'kids' : isCompetitive() ? 'competitive' : 'defi', { force: true })
  if (histSheet && !histSheet.hidden) renderHistory()
})

document.addEventListener('verimots-auth', () => {
  syncCloudHistory()
})

boot()
