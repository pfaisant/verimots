// Competitive mode for Verimots: daily trail + Google Sign-In + leaderboard
// Only loaded when user switches to competitive mode

const WEB_CLIENT_ID = '617674779621-vu2iv3rjfcs08nrf5m6apn2ivnh9rim7.apps.googleusercontent.com'

let gsReady = false
let currentUser = null
let trailData = null

export function isCompetitive() {
  return sessionStorage.getItem('verimots-mode') === 'competitive'
}

export function setCompetitive(on) {
  sessionStorage.setItem('verimots-mode', on ? 'competitive' : 'defi')
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

export async function handleGoogleCallback(response) {
  try {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: response.credential }),
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

export async function fetchDailyTrail() {
  try {
    const res = await fetch('/api/game/trail')
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

export async function fetchLeaderboard(trailId) {
  try {
    const url = trailId ? `/api/game/board?trailId=${encodeURIComponent(trailId)}` : '/api/game/board'
    const res = await fetch(url, { credentials: 'include' })
    const data = await res.json()
    if (data?.ok) {
      return { ok: true, top: data.top || [], me: data.me || null }
    }
    return { ok: false, top: [], me: null }
  } catch {
    return { ok: false, top: [], me: null }
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

export async function submitCompete(percent, word) {
  try {
    const res = await fetch('/api/game/compete', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ percent, word }),
    })
    const data = await res.json()
    return data
  } catch {
    return { ok: false, error: 'network_error' }
  }
}
