const CACHE = 'verimots-v158'
const SHELL = [
  './',
  './index.html',
  './leaderboard.html',
  './leaderboard',
  './leaderboard.js?v=158',
  './icons.js?v=158',
  './activity.js?v=158',
  './app.css?v=158',
  './analytics.js?v=158',
  './app.js?v=158',
  './competitive.js?v=158',
  './game.js?v=158',
  './flags.js?v=158',
  './favorites.js?v=158',
  './history.js?v=158',
  './i18n.js?v=158',
  './worker.js?v=158',
  './tiles.js?v=158',
  './kids.js?v=158',
  './favicon.svg?v=158',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  './manifest.webmanifest?v=158',
  './data/meta.json',
  './data/dicts.json',
  './data/meta-en.json',
  './data/meta-en-wow24.json',
  './data/meta-es.json',
  './data/meta-ca.json',
  './data/ods9.txt.gz',
  './data/yawl.txt.gz',
  './data/wow24.txt.gz',
  './data/rla-es.txt.gz',
  './data/disc-ca.txt.gz',
  './confidentialite.html',
  './privacy.html',
  './privacidad.html',
  './privadesa.html',
  './support.html',
  './dictionnaires.html',
  './dictionaries.html',
  './diccionarios.html',
  './diccionaris.html',
  './roadmap.html',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)))
  // Let existing games finish with their own shell before activating.
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => /^verimots-v\d+$/.test(k) && k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

async function cached(request, options) {
  try { return await (await caches.open(CACHE)).match(request, options) } catch { return undefined }
}

function save(event, request, response) {
  const copy = response.clone()
  // A full/disabled cache must not fail an otherwise successful page load.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {}))
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(req))
    return
  }
  if (url.pathname.endsWith('.apk') || url.pathname.endsWith('/apk.json')) {
    event.respondWith(fetch(req))
    return
  }
  const page =
    req.mode === 'navigate' ||
    url.pathname.endsWith('.html') ||
    url.pathname === '/' ||
    url.pathname.endsWith('/s') ||
    url.pathname.endsWith('/s/')
  if (page) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const key = new URL(req.url)
            key.search = ''
            save(event, key.href, res)
          }
          if (res.status >= 500) return cached(req, { ignoreSearch: true }).then((hit) => hit || res)
          return res
        })
        .catch(async () => (await cached(req, { ignoreSearch: true })) || (await cached('./index.html')) || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }))
    )
    return
  }
  event.respondWith(
    cached(req).then((hit) => {
      if (hit) return hit
      return fetch(req).then((res) => {
        if (res.ok && url.origin === self.location.origin) {
          save(event, req, res)
        }
        return res
      })
    })
  )
})
