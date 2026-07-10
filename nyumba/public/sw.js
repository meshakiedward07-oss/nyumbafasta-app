// v3 — clears all old caches so stale pages are never served again

self.addEventListener('install', function () {
  // Activate this SW immediately — don't wait for old tabs to close
  self.skipWaiting()
})

self.addEventListener('activate', function (event) {
  // Delete every cache the old SW created (old emoji UI, etc.)
  event.waitUntil(
    caches
      .keys()
      .then(function (names) {
        return Promise.all(names.map(function (n) { return caches.delete(n) }))
      })
      .then(function () {
        // Take control of all open pages right now
        return self.clients.claim()
      })
  )
})

self.addEventListener('push', function (event) {
  const data = event.data ? event.data.json() : {}
  const title = data.title || 'NyumbaFasta'
  const options = {
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
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (clientList) {
        for (const client of clientList) {
          if (client.url.includes(url) && 'focus' in client) return client.focus()
        }
        if (clients.openWindow) return clients.openWindow(url)
      })
  )
})
