// Funciona offline: usa a rede quando há internet e a cópia salva quando não há.
const VERSAO = 'clan-studio-v1';
const ARQUIVOS = [
  './', './index.html', './manifest.webmanifest', './icon.svg',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png',
  './fonts/bricolage-grotesque-latin-wght-normal.woff2', './fonts/jetbrains-mono-latin-400-normal.woff2', './fonts/jetbrains-mono-latin-700-normal.woff2',
  './src/ui/tema.css', './src/main.js', './src/ui/telas.js', './src/dados/banco.js', './src/dados/backup.js', './src/ui/util.js',
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS))); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('clan-studio-') && k !== VERSAO).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => { if (r.ok) { const c = r.clone(); caches.open(VERSAO).then((x) => x.put(e.request, c)); } return r; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});
