/* Blackrock service worker: versioned shell cache, network-first data. */
const V = 'blackrock-b14'; // b14: bigger universe (ETFs, LSE, large caps)
const SHELL = ['./', 'index.html', 'css/style.css?v=b14', 'js/vendor/three.min.js?v=r149', 'js/bots.js?v=b14', 'js/tower.js?v=b14', 'js/analysis.js?v=b14', 'js/data.js?v=b14', 'js/chart.js?v=b14', 'js/tabbar.js?v=b14', 'js/app.js?v=b14', 'manifest-b11.webmanifest', 'manifest.webmanifest', 'icons/br-icon-b11-192.png', 'icons/br-icon-b11-512.png', 'icons/br-icon-b11-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(V).then(c => c.addAll(SHELL))); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.includes('/data/')) { e.respondWith(fetch(e.request).catch(() => caches.match(e.request, { ignoreSearch: true }))); return; }
  if (e.request.mode === 'navigate') { e.respondWith(fetch(e.request).then(res => { const cl = res.clone(); caches.open(V).then(c => c.put(e.request, cl)); return res; }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))); return; }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { if (res.ok && u.pathname.startsWith(new URL('./', location).pathname)) { const cl = res.clone(); caches.open(V).then(c => c.put(e.request, cl)); } return res; })));
});
