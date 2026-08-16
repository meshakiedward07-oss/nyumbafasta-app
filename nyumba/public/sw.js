// v5 — bump to force re-fetch of black-background app icons

const CACHE_STATIC = 'nyumbafasta-static-v5'
const CACHE_PAGES  = 'nyumbafasta-pages-v5'
const OFFLINE_URL  = '/offline.html'

const PRECACHE_URLS = [
  '/offline.html',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-512-maskable.png',
  '/transparent_logo_nyumbafasta.png',
]

// Install — precache offline essentials, activate immediately
self.addEventListener('install', function (event) {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_STATIC).then(function (cache) {
      return cache.addAll(PRECACHE_URLS).catch(function () {})
    })
  )
})

// Activate — delete caches from old SW versions, take control immediately
self.addEventListener('activate', function (event) {
  var VALID = [CACHE_STATIC, CACHE_PAGES]
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names
          .filter(function (n) { return VALID.indexOf(n) === -1 })
          .map(function (n) { return caches.delete(n) })
      )
    }).then(function () {
      return self.clients.claim()
    })
  )
})

// Fetch — three strategies based on request type
self.addEventListener('fetch', function (event) {
  var req = event.request
  var url = new URL(req.url)

  // Only handle same-origin GET requests
  if (req.method !== 'GET') return
  if (url.origin !== self.location.origin) return

  // _next/static/ — content-hashed assets, safe to cache forever (cache-first)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(CACHE_STATIC, req))
    return
  }

  // /api/ — always network-only (never serve stale data)
  if (url.pathname.startsWith('/api/')) return

  // HTML navigation — network-first with offline fallback
  if (req.mode === 'navigate') {
    event.respondWith(networkFirstNav(event, req))
    return
  }

  // Images and other public static files — stale-while-revalidate
  if (/\.(png|jpg|jpeg|webp|gif|svg|ico|woff2?|css|js)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event, req))
  }
})

async function cacheFirst(cacheName, req) {
  var cache = await caches.open(cacheName)
  var cached = await cache.match(req)
  if (cached) return cached
  try {
    var res = await fetch(req)
    if (res.ok) cache.put(req, res.clone())
    return res
  } catch (e) {
    return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }
}

async function networkFirstNav(event, req) {
  try {
    var res = await fetch(req)
    if (res.ok) {
      var pagesCache = await caches.open(CACHE_PAGES)
      pagesCache.put(req, res.clone())
    }
    return res
  } catch (e) {
    var cached = await caches.match(req)
    if (cached) return cached
    var offlinePage = await caches.match(OFFLINE_URL)
    return offlinePage || new Response(
      '<!DOCTYPE html><html><body><h1>Hakuna mtandao</h1></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }
}

async function staleWhileRevalidate(event, req) {
  var cache = await caches.open(CACHE_PAGES)
  var cached = await cache.match(req)
  var revalidate = fetch(req)
    .then(function (res) { if (res.ok) cache.put(req, res.clone()); return res })
    .catch(function () { return null })
  if (cached) {
    event.waitUntil(revalidate)
    return cached
  }
  return (await revalidate) || new Response('Offline', { status: 503 })
}

// Push notifications
self.addEventListener('push', function (event) {
  var data = event.data ? event.data.json() : {}
  var title = data.title || 'NyumbaFasta'
  var options = {
    body: data.body || '',
    icon: '/transparent_logo_nyumbafasta.png',
    badge: '/transparent_logo_nyumbafasta.png',
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: 'Angalia' },
      { action: 'close', title: 'Funga' },
    ],
    vibrate: [100, 50, 100],
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  if (event.action === 'close') return
  var url = event.notification.data?.url || '/'
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (clientList) {
        for (var i = 0; i < clientList.length; i++) {
          var client = clientList[i]
          if (client.url.includes(url) && 'focus' in client) return client.focus()
        }
        if (clients.openWindow) return clients.openWindow(url)
      })
  )
})
