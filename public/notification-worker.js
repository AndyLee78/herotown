self.addEventListener('notificationclick', (event) => {
  if (event.notification.data?.herotown !== true) return
  event.notification.close()
  event.waitUntil((async () => {
    const scope = self.registration.scope
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if (!client.url.startsWith(scope)) continue
      try {
        const focused = await client.focus()
        if (focused) return
      } catch { /* The tab may have closed while handling the click. */ }
    }
    await self.clients.openWindow(scope)
  })())
})
