// The old address's service worker, replacing Papelito's old one at /listolista/ (the browser's
// update check fetches this file because the old app registered it). It retires the old offline
// copy so the old address reaches the forward in index.html, then steps aside for good.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // the old copies: caches named papelito-<version>, every entry under /listolista/
    // (the app at /papelito/ names its caches papelito:/papelito/:<version>, never touched here)
    for (const name of await caches.keys()) {
      if (!name.startsWith('papelito-')) continue;
      const cache = await caches.open(name);
      for (const req of await cache.keys()) if (new URL(req.url).pathname.startsWith('/listolista/')) await cache.delete(req);
      if (!(await cache.keys()).length) await caches.delete(name);
    }
    // no worker at this address any more
    await self.registration.unregister();
    // open tabs reload through the network into the forward (it keeps ?lang= and #k=)
    for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url).catch(() => {});
  })());
});
