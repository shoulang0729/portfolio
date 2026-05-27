// Portfolio Manager — Service Worker
// オフライン時に最後にキャッシュしたスナップショットを表示する。

const CACHE = 'portfolio-v20260526F';
const OFFLINE_ASSETS = [
  './',
  './index.html',
  './assets/01-base.css',
  './assets/02-tables.css',
  './assets/03-misc.css',
  './assets/04-auth.css',
  './src/auth-pin.js',
  './src/auth-crypto.js',
  './src/auth-passkey.js',
  './src/auth-ui.js',
  './src/positions.js',
  './src/state.js',
  './src/funds.js',
  './src/csv.js',
  './src/utils.js',
  './src/data.js',
  './src/heatmap.js',
  './src/chart.js',
  './src/stock-list.js',
  './src/watchlist.js',
  './src/positions-store.js',
  './src/import-parse.js',
  './src/import-ui.js',
  './src/ptr.js',
  './src/app.js',
  'https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(OFFLINE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first: 通常はネット優先、失敗時にキャッシュで応答
self.addEventListener('fetch', e => {
  // POST / Worker API は SW を通さない
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.hostname !== self.location.hostname && !OFFLINE_ASSETS.includes(e.request.url)) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
