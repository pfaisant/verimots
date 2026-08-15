#!/usr/bin/env node
// Local Verimots host: static web/ plus define + game/auth APIs.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleOdsDefine } from './ods-define.mjs'
import { handleOdsGame } from './ods-game.mjs'

const ROOT = join(fileURLToPath(new URL('..', import.meta.url)))
const DIR = join(ROOT, 'web')
const PORT = Number(process.env.PORT) || 4174
const HOST = process.env.HOST || '127.0.0.1'

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.gz': 'application/gzip',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
}

function json(res, status, obj, extra = {}, method = 'GET') {
  const body = JSON.stringify(obj)
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': String(Buffer.byteLength(body)),
    ...extra,
  }
  res.writeHead(status, headers)
  res.end(method === 'HEAD' ? undefined : body)
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    const path = url.pathname
    if (path === '/api/define' || path === '/api/define/') {
      if (await handleOdsDefine(req, res, url, { json })) return
    }
    if (path.startsWith('/api/game/') || path.startsWith('/api/auth/')) {
      if (await handleOdsGame(req, res, url, { json })) return
    }
    let rel = path === '/' ? '/index.html' : path
    const file = join(DIR, normalize(rel).replace(/^(\.\.[/\\])+/, ''))
    if (!file.startsWith(DIR)) {
      res.writeHead(403)
      res.end('Forbidden')
      return
    }
    await stat(file)
    const ext = extname(file).toLowerCase()
    const body = await readFile(file)
    res.writeHead(200, {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      'Content-Length': String(body.byteLength),
    })
    res.end(req.method === 'HEAD' ? undefined : body)
  } catch {
    res.writeHead(404)
    res.end('Not found')
  }
})

server.listen(PORT, HOST, () => {
  console.log(`verimots on http://${HOST}:${PORT}`)
})
