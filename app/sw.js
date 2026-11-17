// Funciona offline: usa a versão da rede quando há internet e a cópia salva quando não há.
const CACHE = 'bar-caixa-portaria-v44';
const ASSETS = ['./', './index.html', './caixa.html', './portaria.html', './estoque.html', './cardapio.html', './porta.html', './porta.webmanifest', './tradutor.html', './tradutor.js', './tradutor-estudo.js', './tradutor-extra.js', './tradutor-musica.js', './tradutor-conversa.js', './tradutor-saber.js', './tradutor-ui.js', './tradutor-arte.js', './tradutor-backup.js', './icons/ceu.webp', './icons/claspeak-marca.svg', './vendor/anthropic-sdk.js', './tradutor.webmanifest', './icons/tradutor-gato.png', './icons/gato-corpo.png', './icons/gato-danca.webp', './icons/gato-rosto.png', './icons/gato-rosto-danca.webp', './icons/tradutor-192.png', './icons/tradutor-512.png', './vendor/qrcode.js', './claude-local.js', './foto.js', './precos.js', './ferramentas.js', './firebase-config.js',
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
