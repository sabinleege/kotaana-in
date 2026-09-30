// Kotaana does not use a service worker. Browsers that still have one registered for this
// origin (e.g. from an earlier app served on the same host) fetch this file on update checks;
// it replaces the stale worker, clears its caches, unregisters itself and reloads open tabs.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: "window" });
    clients.forEach((c) => c.navigate(c.url));
  })());
});
