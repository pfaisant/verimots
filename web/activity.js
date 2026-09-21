import { ensureGuestSession, getCurrentUser } from './competitive.js?v=160'

export const activityId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
const KEY = 'verimots-activity-queue-v1'
const MAX_EVENTS = 200
const MAX_AGE = 7 * 86400_000

// Events belong to the identity that played them. Offline events with no known
// identity cannot safely be assigned to whichever account signs in later.
export function createActivityRecorder({
  getUser = getCurrentUser, ensureUser = ensureGuestSession,
  request = (...args) => fetch(...args), now = () => Date.now(),
  storage = () => globalThis.localStorage,
  online = () => globalThis.navigator?.onLine !== false,
  timeoutMs = 8000,
} = {}) {
  let memory = [], running, sessionRequest, retryTimer
  let retryDelay = 2000
  function read() {
    let saved = []
    try { saved = JSON.parse(storage()?.getItem(KEY) || '[]') } catch {}
    const rows = new Map()
    for (const row of [...(Array.isArray(saved) ? saved : []), ...memory]) {
      if (typeof row?.owner !== 'string' || !row.owner || !row.event?.id || !Number.isFinite(row.at) || row.at < now() - MAX_AGE || row.at > now()) continue
      rows.set(`${row.owner}:${row.event.id}`, row)
    }
    memory = [...rows.values()].slice(-MAX_EVENTS)
    return memory
  }
  function write(rows) {
    memory = rows.slice(-MAX_EVENTS)
    try { storage()?.setItem(KEY, JSON.stringify(memory)) } catch { /* Memory still works in private mode. */ }
  }
  async function bounded(fn) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try { return await fn(controller.signal) } finally { clearTimeout(timer) }
  }
  function call(url, options = {}) {
    return bounded(async signal => {
      const res = await request(url, { ...options, credentials: 'include', signal })
      return { ok: res.ok, status: res.status, data: res.ok ? await res.json() : null }
    })
  }
  function retry() {
    if (retryTimer || !online()) return
    retryTimer = setTimeout(() => { retryTimer = null; void flush() }, retryDelay)
    retryDelay = Math.min(60000, retryDelay * 2)
  }
  async function drain() {
    if (!online() || !read().length) return false
    let owner = getUser()?.sub
    if (!owner) {
      const res = await call('/api/auth/me')
      if (!res.ok) return false
      owner = res.data?.user?.sub
    }
    if (!owner) return false
    let sent = false
    for (let i = 0; i < 20; i++) {
      const row = read().find(item => item.owner === owner)
      if (!row) break
      // A changed cookie is rejected by the server's owner guard as well.
      if (getUser()?.sub && getUser().sub !== owner) break
      const res = await call('/api/game/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...row.event, owner }),
      })
      if (res.status === 401 || res.status === 409) return false
      if (res.status === 429) { retryDelay = 60000; retry(); return false }
      if (res.status >= 500 || (res.ok && !res.data?.ok)) { retry(); return false }
      // A permanently invalid event must not block later valid discoveries.
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        write(read().filter(item => item.owner !== owner || item.event.id !== row.event.id))
        sent ||= res.ok
        retryDelay = 2000
      }
    }
    if (read().some(row => row.owner === owner)) retry()
    return sent
  }
  function flush() {
    if (running) return running
    running = drain().catch(() => { retry(); return false }).finally(() => { running = null })
    return running
  }
  async function record(event) {
    try {
      let user = getUser()
      if (!user?.sub) {
        if (!online()) return false
        sessionRequest ||= bounded(signal => ensureUser({ signal })).finally(() => { sessionRequest = null })
        user = await sessionRequest
      }
      if (!user?.sub) return false
      const row = { owner: user.sub, at: now(), event: { id: activityId(), ...event } }
      write([...read().filter(item => item.owner !== row.owner || item.event.id !== row.event.id), row])
      return await flush()
    } catch { return false }
  }
  function dispose() { clearTimeout(retryTimer); retryTimer = null }
  return { record, flush, dispose }
}

const recorder = createActivityRecorder()
export const recordActivity = event => recorder.record(event)
export const flushActivity = () => recorder.flush()
if (typeof window !== 'undefined') {
  window.addEventListener('online', flushActivity)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void flushActivity() })
  setTimeout(flushActivity, 1500)
}
