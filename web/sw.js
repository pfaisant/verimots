const CACHE = 'verimots-v163'
const SHELL = [
  './',
  './index.html',
  './leaderboard.html',
  './leaderboard',
  './leaderboard.js?v=20260921-filters',
  './icons.js?v=161',
  './activity.js?v=161',
  './app.css?v=20260921-filters',
  './analytics.js?v=161',
  './app.js?v=20260921-filters',
  './competitive.js?v=161',
  './game.js?v=161',
  './flags.js?v=161',
  './favorites.js?v=161',
  './history.js?v=161',
  './i18n.js?v=161',
  './worker.js?v=161',
  './tiles.js?v=161',
  './fonts/verimots-tiles.woff2',
  './kids.js?v=161',
  './favicon.svg?v=161',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  './manifest.webmanifest?v=161',
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
