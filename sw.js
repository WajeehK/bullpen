/* Blackrock service worker: versioned shell cache, network-first data. */
const V = 'blackrock-b4';
const SHELL = ['./', 'index.html', 'css/style.css?v=b4', 'js/bots.js?v=b4', 'js/tower.js?v=b4', 'js/analysis.js?v=b4', 'js/data.js?v=b4', 'js/chart.js?v=b4', 'js/tabbar.js?v=b4', 'js/app.js?v=b4', 'manifest.webmanifest', 'icons/br-icon-192.png', 'icons/br-icon-512.png'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(V).then(c => c.addAll(SHELL))); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.includes('/data/')) { e.respondWith(fetch(e.request).catch(() => caches.match(e.request, { ignoreSearch: true }))); return; }
  if (e.request.mode === 'navigate') { e.respondWith(fetch(e.request).then(res => { const cl = res.clone(); caches.open(V).then(c => c.put(e.request, cl)); return res; }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))); return; }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { if (res.ok && u.pathname.startsWith(new URL('./', location).pathname)) { const cl = res.clone(); caches.open(V).then(c => c.put(e.request, cl)); } return res; })));
});
