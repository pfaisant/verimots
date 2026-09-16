import { isIP } from 'node:net'

// Only a local reverse proxy may supply the public client address by default.
// A directly exposed server must not let clients choose their rate-limit key.
export function clientIp(req) {
  const peer = req.socket?.remoteAddress || ''
  const local = peer === '127.0.0.1' || peer === '::1' || peer === '::ffff:127.0.0.1'
  if (local || process.env.ODS9_TRUST_PROXY === '1') {
    const forwarded = String(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    if (isIP(forwarded)) return forwarded
  }
  return peer || 'unknown'
}

export function createRateLimiter(limit, windowMs, maxKeys = 10_000) {
  const rows = new Map()
  let nextSweep = 0
  function allow(key, now = Date.now()) {
    if (now >= nextSweep) {
      for (const [id, row] of rows) if (now - row.at >= windowMs) rows.delete(id)
      nextSweep = now + windowMs
    }
    const row = rows.get(key)
    if (row && now - row.at < windowMs) {
      if (row.count >= limit) return false
      row.count++
      return true
    }
    if (!row && rows.size >= maxKeys) return false
    rows.set(key, { at: now, count: 1 })
    return true
  }
  allow.clear = () => { rows.clear(); nextSweep = 0 }
  return allow
}

export function isCrossOriginMutation(req, url) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return false
  if (req.headers['sec-fetch-site'] === 'cross-site') return true
  const origin = req.headers.origin
  if (!origin) return false // Native clients do not send Origin.
  try {
    const parsed = new URL(origin)
    // The embedding production server parses paths against http://localhost;
    // Host carries the actual public origin through its local reverse proxy.
    const host = new URL(`http://${req.headers.host || url.host}`).host
    return !['http:', 'https:'].includes(parsed.protocol) || parsed.host !== host
  } catch {
    return true
  }
}
