/* 燈燈悅心 — Service Worker
 *
 * 策略很保守：app 的殼走 cache-first（離線也開得起來），
 * Supabase 的請求完全不碰（永遠走網路，不然會拿到舊資料）。
 *
 * 改完程式記得把 VERSION 加一，不然舊快取不會換掉。
 */

const VERSION = 'v37';
const CACHE = `dengdeng-${VERSION}`;

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './styles/tokens.css',
  './styles/app.css',
  './src/app.js',
  './src/ui.js',
  './src/store.js',
  './src/lamp.js',
  './src/quotes.js',
  './src/config.js',
  './src/supabase.js',
  './src/views/today.js',
  './src/views/reveal.js',
  './src/views/sea.js',
  './src/views/together.js',
  './src/views/me.js',
  './src/views/welcome.js',
  './src/invite.js',
  './src/share.js',
  './src/views/lampcard.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // 個別檔案抓不到不該讓整個安裝失敗。
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Supabase、esm.sh：永遠走網路，不進快取。
  if (url.hostname.endsWith('.supabase.co') || url.hostname === 'esm.sh') return;

  // 字體：拿到就長期留著。
  if (url.hostname.endsWith('gstatic.com') || url.hostname === 'fonts.googleapis.com') {
    e.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
        return res;
      }).catch(() => hit))
    );
    return;
  }

  // 自己的檔案：先給快取，同時背景更新。
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(request).then((hit) => {
        const live = fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        }).catch(() => hit);
        return hit || live;
      })
    );
  }
});
