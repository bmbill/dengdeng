/* 燈燈悅心 — Service Worker
 *
 * 策略很保守：app 的殼走 cache-first（離線也開得起來），
 * Supabase 的請求完全不碰（永遠走網路，不然會拿到舊資料）。
 *
 * 改完程式記得把 VERSION 加一，不然舊快取不會換掉。
 */

const VERSION = 'v39';
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

/* ── 推播 ──
 *
 * 內容由 push Worker 送來，這裡只負責顯示。
 * payload 壞掉也要顯示一則：iOS 會統計「收到但沒顯示」的次數，
 * 累積多了會直接把這個網站的推播權限收掉。
 */
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { /* 不是 JSON 就用預設 */ }
  e.waitUntil(self.registration.showNotification(d.title || '燈燈悅心', {
    body: d.body || '今天的燈點了嗎？',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: 'dengdeng-daily',   // 同一個 tag：沒讀的舊通知會被新的蓋掉，不會疊一整排
    data: { url: './' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL(e.notification.data?.url || './', self.location.origin).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // 已經開著就把它叫到前面，不要再開一個分頁
    for (const w of wins) {
      if (w.url.startsWith(self.location.origin) && 'focus' in w) return w.focus();
    }
    return self.clients.openWindow(target);
  })());
});
