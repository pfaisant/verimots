// Competitive mode for Verimots: weekly trail + Google Sign-In + leaderboard
// Only loaded when user switches to competitive mode

const WEB_CLIENT_ID = '617674779621-vu2iv3rjfcs08nrf5m6apn2ivnh9rim7.apps.googleusercontent.com'

let gsRequest = null
let currentUser = null
let trailData = null
let sessionRevision = 0
let guestRequest = null

function setCurrentUser(user) {
  currentUser = user || null
  sessionRevision++
  if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent('verimots-session', { detail: currentUser }))
  }
  return currentUser
}

// Auth and leaderboards are network extras: an unresponsive
// connection must not leave a game waiting indefinitely.
async function requestJson(url, options = {}) {
  const { timeoutMs = 8000, signal, ...init } = options
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signal?.aborted) abort()
  else signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(abort, timeoutMs)
  try {
    const res = await fetch(url, { ...init, credentials: 'include', cache: 'no-store', signal: controller.signal })
    return { status: res.status, data: await res.json() }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

// No imports here (this module is loaded standalone), so the language list is
// repeated from i18n.js LANGS.
const LANGS = ['fr', 'en', 'es', 'ca']

function language(value) {
  return LANGS.includes(value) ? value : 'fr'
}

function boardLanguage(value) {
  return value === 'any' ? 'any' : language(value)
}

export function getGameMode() {
  if (modeStorageFailed) return gameMode
  try {
    const stored = sessionStorage.getItem('verimots-mode')
    if (stored !== null) gameMode = normalizeMode(stored)
  } catch { /* blocked storage: keep this tab playable */ }
  return gameMode
}

let gameMode = 'defi'
let modeStorageFailed = false
function normalizeMode(mode) {
  return ['competitive', 'kids', 'training'].includes(mode) ? mode : 'defi'
}

export function setGameMode(mode) {
  gameMode = normalizeMode(mode)
  try {
    sessionStorage.setItem('verimots-mode', gameMode)
    modeStorageFailed = false
  } catch { modeStorageFailed = true }
}

export function isCompetitive() {
  return getGameMode() === 'competitive'
}

export function isKids() {
  return getGameMode() === 'kids'
}

export function isTraining() {
  return getGameMode() === 'training'
}

export function setCompetitive(on) {
  setGameMode(on ? 'competitive' : 'defi')
}

export async function initGoogleSignIn() {
  if (window.google?.accounts?.id) return
  if (gsRequest) return gsRequest
  gsRequest = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    const fail = () => {
      clearTimeout(timer)
      script.onload = script.onerror = null
      script.remove()
      reject(new Error('Google Sign-In load failed'))
    }
    const timer = setTimeout(fail, 8000)
    script.onload = () => {
      if (!window.google?.accounts?.id) return fail()
      clearTimeout(timer)
      script.onload = script.onerror = null
      resolve()
    }
    script.onerror = fail
    document.head.appendChild(script)
  }).finally(() => { gsRequest = null })
  return gsRequest
}

export async function checkSession(opts = {}) {
  const revision = sessionRevision
  try {
    const { status, data } = await requestJson('/api/auth/me', opts)
    if (revision !== sessionRevision) return currentUser
    if (data?.ok && data.user) {
      return setCurrentUser(data.user)
    }
    if (status === 401) return setCurrentUser(null)
  } catch {
    // Offline is not signed out: keep the last confirmed account visible.
  }
  return currentUser
}

export function getCurrentUser() {
  return currentUser
}

// No session: ask the server to mint an anonymous guest account (userNNNNNN)
// bound to this browser's cookie. Idempotent — an existing session (guest or
// Google) is returned as-is — and a later Google sign-in adopts the guest,
// standing included.
export async function ensureGuestSession(opts = {}) {
  if (guestRequest) return guestRequest
  const revision = sessionRevision
  guestRequest = (async () => {
    try {
      const { data } = await requestJson('/api/auth/guest', { ...opts, method: 'POST' })
      if (revision !== sessionRevision) return currentUser
      if (data?.ok && data.user) return setCurrentUser(data.user)
    } catch {
      /* offline: solo play remains available */
    }
    return currentUser
  })().finally(() => { guestRequest = null })
  return guestRequest
}

export function competeAccepted(result) {
  return !!(result?.ok || result?.error === 'already_submitted')
}

export async function handleGoogleCallback(response) {
  try {
    const { data } = await requestJson('/api/auth/google', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: response.credential }),
    })
    if (data?.ok && data.user) {
      setCurrentUser(data.user)
      return { ok: true, user: data.user }
    }
    return { ok: false, error: data.error || 'auth_failed' }
  } catch {
    return { ok: false, error: 'network_error' }
  }
}

export async function logout() {
  // Invalidate older session reads, but keep the confirmed account until
  // the server has actually removed its cookie.
  const revision = ++sessionRevision
  try {
    const { status, data } = await requestJson('/api/auth/logout', { method: 'POST' })
    if (status >= 400 || !data?.ok) return { ok: false, error: data?.error || 'logout_failed' }
    if (revision === sessionRevision) setCurrentUser(null)
    return { ok: true }
  } catch {
    return { ok: false, error: 'network_error' }
  }
}

export async function fetchDailyTrail(lang, opts = {}) {
  try {
    const p = new URLSearchParams()
    p.set('lang', language(lang))
    if (opts.kids) p.set('kids', '1')
    const { data } = await requestJson('/api/game/trail?' + p, opts)
    if (data?.ok && data.trailId && data.rack) {
      trailData = data
      return data
    }
    return null
  } catch {
    return null
  }
}

export function getTrailData() {
  return trailData
}

export async function fetchLeaderboard(trailId, lang, opts = {}) {
  const requestedLang = boardLanguage(lang)
  try {
    const p = new URLSearchParams()
    if (trailId) p.set('trailId', trailId)
    p.set('lang', requestedLang)
    if (opts.kids) p.set('kids', '1')
    if (['all', 'day', '7d', '30d'].includes(opts.scope)) p.set('scope', opts.scope)
    const { data } = await requestJson(`/api/game/board?${p}`, opts)
    if (data?.ok) {
      return { ok: true, top: data.top || [], me: data.me || null, mine: data.mine || (data.me ? [data.me] : []), kids: !!data.kids, lang: boardLanguage(data.lang || requestedLang), trailId: data.trailId, scope: data.scope || opts.scope || 'week', weeks: data.weeks || 0, date: data.date || null }
    }
    return { ok: false, top: [], me: null, mine: [], kids: !!opts.kids, lang: requestedLang, scope: opts.scope || 'week' }
  } catch {
    return { ok: false, top: [], me: null, mine: [], kids: !!opts.kids, lang: requestedLang, scope: opts.scope || 'week' }
  }
}

export async function fetchHistory(opts = {}) {
  try {
    const { data } = await requestJson('/api/game/history', opts)
    if (data?.ok) return { ok: true, history: Array.isArray(data.history) ? data.history : [], stats: data.stats || null }
  } catch {
    /* offline */
  }
  return { ok: false, history: [], stats: null }
}

export async function saveHistoryWord(entry, opts = {}) {
  const owner = Object.hasOwn(opts, 'owner') ? opts.owner : currentUser?.sub
  if (Object.hasOwn(opts, 'owner') && owner !== currentUser?.sub) return { ok: false, error: 'session_changed', status: 409 }
  try {
    const { data } = await requestJson('/api/game/history', {
      ...opts,
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: entry.word, pts: entry.pts, src: entry.src, at: entry.at, owner }),
    })
    return data
  } catch {
    return { ok: false, error: 'network_error' }
  }
}

export async function clearCloudHistory(opts = {}) {
  const owner = Object.hasOwn(opts, 'owner') ? opts.owner : currentUser?.sub
  if (Object.hasOwn(opts, 'owner') && owner !== currentUser?.sub) return { ok: false, error: 'session_changed', status: 409 }
  try {
    const { data } = await requestJson('/api/game/history', {
      ...opts,
      method: 'DELETE',
      credentials: 'include',
      headers: owner ? { 'X-Verimots-Owner': owner } : {},
    })
    return data
  } catch {
    return { ok: false, error: 'network_error' }
  }
}

export async function submitCompete(percent, word, lang, opts = {}) {
  try {
    const owner = Object.hasOwn(opts, 'owner') ? opts.owner : currentUser?.sub
    const user = currentUser || await ensureGuestSession(opts)
    if (!user?.sub) return { ok: false, error: 'session_unavailable' }
    if (owner && owner !== user.sub) return { ok: false, error: 'session_changed' }
    const { status, data } = await requestJson('/api/game/compete', {
      signal: opts.signal,
      timeoutMs: opts.timeoutMs,
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        percent,
        word,
        lang: language(lang),
        owner: user.sub,
        kids: !!opts.kids,
        rack: opts.rack ? String(opts.rack).toUpperCase() : undefined,
        // Passing counts as a 0 % play — it lowers the weekly average.
        pass: !!opts.pass,
      }),
    })
    // A rejected cookie is different from a network failure. Reflect the
    // rejected session in account settings, without replaying a score under
    // a new identity (or counting an ambiguous request twice).
    if (status === 401 && currentUser?.sub === user.sub) setCurrentUser(null)
    if (status === 409 && data?.error === 'session_changed') void checkSession()
    return data
  } catch {
    return { ok: false, error: 'network_error' }
  }
}
