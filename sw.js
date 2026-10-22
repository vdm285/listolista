// The old address's service worker, replacing Papelito's old one at /listolista/ (the browser's
// update check fetches this file because the old app registered it). It retires the old offline
// copy so the old address reaches the forward in index.html, then steps aside for good.
const OLD = '/listolista/';
const NEW = `${self.location.origin}/papelito/`;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // the old copies: caches named papelito-<version>, every entry under /listolista/
    // (the app at /papelito/ names its caches papelito:/papelito/:<version>, never touched here)
    for (const name of await caches.keys()) {
      if (!name.startsWith('papelito-')) continue;
      const cache = await caches.open(name);
      for (const req of await cache.keys()) if (new URL(req.url).pathname.startsWith(OLD)) await cache.delete(req);
      if (!(await cache.keys()).length) await caches.delete(name);
    }
    // take every open tab of the old address, then leave: no worker answers there any more
    await self.clients.claim();
    await self.registration.unregister();
    // send each tab to the new address with its ?lang= and #k= (its own URL with a #k= would only
    // scroll, not reload, and the tab would keep running the old copy)
    for (const c of await self.clients.matchAll({ type: 'window' })) {
      const u = new URL(c.url);
      if (u.pathname.startsWith(OLD)) await c.navigate(NEW + u.search + u.hash).catch(() => {});
    }
  })());
});
