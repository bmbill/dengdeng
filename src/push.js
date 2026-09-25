/* 燈燈悅心 — 推播訂閱
 *
 * 跟 supabase.js 一樣的態度：整支都可以失敗。沒設定、瀏覽器不支援、
 * 使用者拒絕，都只是回 false，不會讓 app 出事。
 *
 * iOS 有兩個額外條件，而且都不會給錯誤訊息，只會安靜地不動：
 *   1. 必須是「加入主畫面」之後從那個圖示開的，Safari 分頁裡不算
 *   2. iOS 16.4 以上
 * 所以 supported() 分得出「這台不支援」和「還沒加到主畫面」，
 * 畫面上才講得出一句有用的話。
 */

import { PUSH_URL, VAPID_PUBLIC, isPushMode } from './config.js';

/** 這台裝置現在能不能訂閱，不能的話是為什麼。 */
export function supported() {
  if (!isPushMode()) return { ok: false, why: 'off' };
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    // iOS 上，同一支手機在 Safari 裡沒有 PushManager，
    // 從主畫面圖示打開就有——所以這裡多半是「還沒加到主畫面」。
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const standalone = window.navigator.standalone === true
      || window.matchMedia('(display-mode: standalone)').matches;
    return { ok: false, why: ios && !standalone ? 'ios-needs-install' : 'unsupported' };
  }
  if (Notification.permission === 'denied') return { ok: false, why: 'denied' };
  return { ok: true };
}

function urlB64ToUint8(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function reg() {
  return navigator.serviceWorker.ready;
}

export async function current() {
  if (!supported().ok) return null;
  try {
    return await (await reg()).pushManager.getSubscription();
  } catch {
    return null;
  }
}

async function post(path, body) {
  const res = await fetch(`${PUSH_URL}${path}`, {
    method: path === '/prefs' ? 'PUT' : 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`伺服器回了 ${res.status}`);
  return res.json();
}

function prefsOf(time) {
  return {
    time,
    // 時間比對在 Worker 那邊用這個時區做，所以要把它一起送上去。
    // 寫死 Asia/Taipei 的話，出國的人就會在半夜收到。
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Taipei',
  };
}

/** 要權限、訂閱、送到 Worker。整條路任何一段斷掉都回 false。 */
export async function enable(time = '21:00') {
  if (!supported().ok) return false;

  // 一定要在使用者按下按鈕的那個當下問，不能在背景問——
  // 瀏覽器會直接忽略沒有使用者動作的權限請求。
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return false;

  const sub = await (await reg()).pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlB64ToUint8(VAPID_PUBLIC),
  });
  await post('/subscribe', { subscription: sub, prefs: prefsOf(time) });
  return true;
}

export async function disable() {
  const sub = await current();
  if (!sub) return true;
  // 先跟伺服器說，再退訂。反過來的話 endpoint 就沒了，
  // 伺服器那筆會留著每天推給一個不存在的位址。
  await post('/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
  return true;
}

export async function setTime(time) {
  const sub = await current();
  if (!sub) return false;
  await post('/prefs', { endpoint: sub.endpoint, prefs: prefsOf(time) });
  return true;
}

/** 立刻推一則給自己，確認整條路通了。 */
export async function test() {
  const sub = await current();
  if (!sub) throw new Error('還沒開啟提醒');
  const r = await post('/test', { endpoint: sub.endpoint });
  if (!r.ok) throw new Error('伺服器送不出去');
  return true;
}

export { isPushMode };
