const CACHE = 'verimots-v33'
const SHELL = [
  './',
  './index.html',
  './app.css?v=33',
  './app.js?v=33',
  './game.js?v=33',
  './history.js?v=32',
  './i18n.js?v=33',
  './worker.js?v=33',
  './favicon.svg',
  './manifest.webmanifest',
  './data/meta.json',
  './data/meta-en.json',
  './data/ods9.txt.gz',
  './data/enable.txt.gz',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
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
            const copy = res.clone()
            caches.open(CACHE).then((cache) => {
              cache.put(req, copy)
              cache.put('./index.html', copy.clone())
            })
          }
          return res
        })
        .catch(() => caches.match('./index.html'))
    )
    return
  }
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit
      return fetch(req).then((res) => {
        if (res.ok && url.origin === self.location.origin) {
          const copy = res.clone()
          caches.open(CACHE).then((cache) => cache.put(req, copy))
        }
        return res
      })
    })
  )
})
