#!/usr/bin/env node
// Standalone Verimots host: web app, /welcome landing, and local APIs.
import { createServer } from 'node:http'
import { readFile, realpath, stat } from 'node:fs/promises'
import { extname, join, relative, resolve, isAbsolute } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createReadStream } from 'node:fs'
import { createGunzip } from 'node:zlib'
import { pipeline } from 'node:stream/promises'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const IS_MAIN = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (IS_MAIN) {
  const stateDirectory = join(ROOT, '.local-state')
  const files = {
    ODS9_GAME_FILE: 'game.json', ODS9_TRAIL_SALT_FILE: 'trail-salt.txt',
    ODS9_LEADERBOARD_FILE: 'leaderboard.json', ODS9_AUTH_DB_FILE: 'auth.json',
    ODS9_FEEDBACK_FILE: 'feedback.jsonl', ODS9_SIGNUP_FILE: 'signup.jsonl',
    ODS9_SESSION_SECRET_FILE: 'session-secret',
  }
  for (const [key, name] of Object.entries(files)) process.env[key] ||= join(stateDirectory, name)
}
const [{ handleOdsDefine }, { handleOdsGame }] = await Promise.all([import('./ods-define.mjs'), import('./ods-game.mjs')])
const PLAIN_LEXICONS = new Set(['ods9.txt', 'yawl.txt', 'wow24.txt', 'rla-es.txt', 'disc-ca.txt'])
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.gz': 'application/gzip',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8',
}

function json(res, status, obj, extra = {}, method = 'GET') {
  const body = JSON.stringify(obj)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', 'Content-Length': String(Buffer.byteLength(body)), ...extra,
  })
  res.end(method === 'HEAD' ? undefined : body)
}

function inside(root, file) {
  const path = relative(root, file)
  return path !== '..' && !path.startsWith('..\\') && !path.startsWith('../') && !isAbsolute(path)
}

export function createVerimotsServer({ root = ROOT } = {}) {
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    try {
      let url
      try { url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`) }
      catch { json(res, 400, { ok: false, error: 'invalid_url' }, {}, req.method); return }
      const path = url.pathname
      if (path === '/api/define' || path === '/api/define/') {
        if (await handleOdsDefine(req, res, url, { json })) return
      }
      if (path.startsWith('/api/game/') || path.startsWith('/api/auth/')) {
        if (await handleOdsGame(req, res, url, { json })) return
      }
      if (path.startsWith('/api/')) { json(res, 404, { ok: false, error: 'not_found' }, {}, req.method); return }
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        json(res, 405, { ok: false, error: 'GET or HEAD only' }, { Allow: 'GET, HEAD' }, req.method)
        return
      }
      if (path === '/welcome') {
        res.writeHead(308, { Location: '/welcome/' + url.search })
        res.end()
        return
      }
      const landing = path.startsWith('/welcome/')
      const directory = resolve(root, landing ? 'landing' : 'web')
      let requested
      try { requested = decodeURIComponent(landing ? path.slice('/welcome'.length) : path) }
      catch { json(res, 400, { ok: false, error: 'invalid_path' }, {}, req.method); return }
      if (requested.includes('\\') || requested.includes('\0') || requested.split('/').some((part) => part.startsWith('.'))) {
        json(res, 403, { ok: false, error: 'forbidden' }, {}, req.method)
        return
      }
      if (!landing && requested === '/leaderboard') requested = '/leaderboard.html'
      if (requested.endsWith('/')) requested += 'index.html'
      const file = resolve(directory, '.' + requested)
      if (!inside(directory, file)) { json(res, 403, { ok: false, error: 'forbidden' }, {}, req.method); return }
      let canonical
      let info
      let decompress = false
      try {
        try { canonical = await realpath(file) }
        catch (err) {
          if (err.code !== 'ENOENT' || landing || !requested.startsWith('/data/') || !PLAIN_LEXICONS.has(requested.slice('/data/'.length))) throw err
          canonical = await realpath(file + '.gz')
          decompress = true
        }
        const canonicalDirectory = await realpath(directory)
        if (!inside(canonicalDirectory, canonical)) { json(res, 403, { ok: false, error: 'forbidden' }, {}, req.method); return }
        info = await stat(canonical)
      } catch (err) {
        if (err.code !== 'ENOENT' && err.code !== 'ENOTDIR') throw err
        json(res, 404, { ok: false, error: 'not_found' }, {}, req.method)
        return
      }
      if (!info.isFile()) { json(res, 404, { ok: false, error: 'not_found' }, {}, req.method); return }
      if (decompress) {
        res.writeHead(200, { 'Content-Type': TYPES['.txt'], 'Cache-Control': 'no-cache' })
        if (req.method === 'HEAD') res.end()
        else await pipeline(createReadStream(canonical), createGunzip(), res)
        return
      }
      const ext = extname(canonical).toLowerCase()
      const headers = {
        'Content-Type': TYPES[ext] || 'application/octet-stream',
        'Content-Length': String(info.size),
        // The app versions assets through query parameters; revalidate HTML and SW.
        'Cache-Control': 'no-cache',
      }
      if (req.method === 'HEAD') { res.writeHead(200, headers); res.end(); return }
      const body = await readFile(canonical)
      headers['Content-Length'] = String(body.length)
      res.writeHead(200, headers)
      res.end(body)
    } catch (err) {
      console.error('Verimots request failed:', err?.code || err?.name || 'Error')
      if (!res.headersSent) json(res, 500, { ok: false, error: 'server_error' }, {}, req.method)
      else res.destroy()
    }
  })
  server.requestTimeout = 30_000
  server.headersTimeout = 15_000
  server.keepAliveTimeout = 5_000
  return server
}

if (IS_MAIN) {
  const port = Number(process.env.PORT) || 4174
  const host = process.env.HOST || '127.0.0.1'
  createVerimotsServer().listen(port, host, () => console.log(`verimots on http://${host}:${port}`))
}
