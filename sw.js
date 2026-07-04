/* Periodic Quest service worker — cache-first app shell, offline after first load */
const CACHE = 'pq-v3';
const SHELL = [
  './', './index.html', './css/styles.css', './js/data.js', './js/app.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(res => {
        // runtime-cache fonts & same-origin assets so the app works fully offline
        const url = new URL(e.request.url);
        const cacheable = url.origin === location.origin ||
          url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
        if (cacheable && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
