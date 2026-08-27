// Competitive mode for Verimots: weekly trail + Google Sign-In + leaderboard
// Only loaded when user switches to competitive mode

const WEB_CLIENT_ID = '617674779621-vu2iv3rjfcs08nrf5m6apn2ivnh9rim7.apps.googleusercontent.com'

let gsReady = false
let currentUser = null
let trailData = null

function language(value) {
  return value === 'en' || value === 'es' ? value : 'fr'
}

export function getGameMode() {
  const mode = sessionStorage.getItem('verimots-mode')
  return ['competitive', 'kids', 'training'].includes(mode) ? mode : 'defi'
}

export function setGameMode(mode) {
  sessionStorage.setItem('verimots-mode', ['competitive', 'kids', 'training'].includes(mode) ? mode : 'defi')
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
  if (gsReady) return
  return new Promise((resolve, reject) => {
    if (window.google?.accounts) {
      gsReady = true
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => {
      gsReady = true
      resolve()
    }
    script.onerror = () => reject(new Error('Google Sign-In load failed'))
    document.head.appendChild(script)
  })
}

export async function checkSession() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' })
    const data = await res.json()
    if (data?.ok && data.user) {
      currentUser = data.user
      return data.user
    }
  } catch {
    // not logged in
  }
  currentUser = null
  return null
}

export function getCurrentUser() {
  return currentUser
}

export function competeAccepted(result) {
  return !!(result?.ok || result?.error === 'already_submitted')
}

export async function handleGoogleCallback(response) {
  try {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: response.credential }),
      credentials: 'include',
    })
    const data = await res.json()
    if (data?.ok && data.user) {
      currentUser = data.user
      return { ok: true, user: data.user }
    }
    return { ok: false, error: data.error || 'auth_failed' }
  } catch {
    return { ok: false, error: 'network_error' }
  }
}

export async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
  } catch {
    // ignore
  }
  currentUser = null
}

export async function fetchDailyTrail(lang, opts = {}) {
  try {
    const p = new URLSearchParams()
    p.set('lang', language(lang))
    if (opts.kids) p.set('kids', '1')
    const res = await fetch('/api/game/trail?' + p, { credentials: 'include' })
    const data = await res.json()
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
  const requestedLang = language(lang)
  try {
    const p = new URLSearchParams()
    if (trailId) p.set('trailId', trailId)
    p.set('lang', requestedLang)
    if (opts.kids) p.set('kids', '1')
    if (opts.scope === 'all') p.set('scope', 'all')
    const res = await fetch(`/api/game/board?${p}`, { credentials: 'include' })
    const data = await res.json()
    if (data?.ok) {
      return { ok: true, top: data.top || [], me: data.me || null, kids: !!data.kids, lang: language(data.lang || requestedLang), trailId: data.trailId, scope: data.scope || 'week', weeks: data.weeks || 0 }
    }
    return { ok: false, top: [], me: null, kids: !!opts.kids, lang: requestedLang, scope: opts.scope || 'week' }
  } catch {
    return { ok: false, top: [], me: null, kids: !!opts.kids, lang: requestedLang, scope: opts.scope || 'week' }
  }
}

export async function fetchHistory() {
  try {
    const res = await fetch('/api/game/history', { credentials: 'include' })
    const data = await res.json()
    if (data?.ok) return { ok: true, history: data.history || [], stats: data.stats || null }
  } catch {
    /* offline */
  }
  return { ok: false, history: [], stats: null }
}

export async function saveHistoryWord(entry) {
  try {
    const res = await fetch('/api/game/history', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: entry.word, pts: entry.pts, src: entry.src, at: entry.at }),
    })
    return await res.json()
  } catch {
    return { ok: false, error: 'network_error' }
  }
}

export async function clearCloudHistory() {
  try {
    const res = await fetch('/api/game/history', {
      method: 'DELETE',
      credentials: 'include',
    })
    return await res.json()
  } catch {
    return { ok: false, error: 'network_error' }
  }
}

export async function submitCompete(percent, word, lang, opts = {}) {
  try {
    const res = await fetch('/api/game/compete', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        percent,
        word,
        lang: language(lang),
        kids: !!opts.kids,
        rack: opts.rack ? String(opts.rack).toUpperCase() : undefined,
        // Passing counts as a 0 % play — it lowers the weekly average.
        pass: !!opts.pass,
      }),
    })
    const data = await res.json()
    return data
  } catch {
    return { ok: false, error: 'network_error' }
  }
}
