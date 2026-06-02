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
