// ListoLista offline cache (service worker). Built into ./sw.js by tools/build.py.
// App shell: serve from cache at once, refresh it in the background (new versions show on the next open).
// The list itself lives in the phone's storage; sync traffic goes to the relay and is never cached.
var CACHE = 'listolista-5360f1913b';
var SHELL = ['./', './index.html', './manifest.webmanifest', './manifest-android.webmanifest', './icons/icon-192.png',
             './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('listolista-') === 0 && k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;          // relay, other sites: untouched
  if (url.pathname.indexOf(new URL(self.registration.scope).pathname) !== 0) return;
  e.respondWith(caches.open(CACHE).then(function (cache) {
    return cache.match(req, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(req).then(function (res) { if (res.ok) cache.put(req, res.clone()); return res; })
        .catch(function () { return hit; });
      return hit || net;
    });
  }));
});
