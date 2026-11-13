// Funciona offline: usa a versão da rede quando há internet e a cópia salva quando não há.
const CACHE = 'bar-caixa-portaria-v9';
const ASSETS = ['./', './index.html', './caixa.html', './portaria.html', './estoque.html', './porta.html', './porta.webmanifest', './vendor/qrcode.js', './claude-local.js', './foto.js', './precos.js', './firebase-config.js',
  './vendor/firebase-app-compat.js', './vendor/firebase-auth-compat.js', './vendor/firebase-firestore-compat.js', './manifest.webmanifest', './icon.svg',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png', './icons/logo-horizontal.png',
  './icons/porta-192.png', './icons/porta-512.png', './icons/porta-maskable-512.png', './icons/porta-apple.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return r;
      })
      .catch(() => caches.match(e.request))
  );
});
