/* 燈燈悅心 — 進入點與分頁切換 */

import { tabIcon, closeSheet } from './ui.js';
import * as S from './store.js';
import { takeInviteCode } from './invite.js';
import * as today from './views/today.js';
import * as sea from './views/sea.js';
import * as together from './views/together.js';
import * as meView from './views/me.js';
import * as welcome from './views/welcome.js';

const TABS = [
  { id: 'today', label: '今日', view: today },
  { id: 'sea', label: '燈海', view: sea },
  { id: 'together', label: '同行', view: together },
  { id: 'me', label: '我', view: meView },
];

const app = document.getElementById('app');
const bar = document.getElementById('tabbar');
let current = 'today';

function go(id) {
  current = id;
  closeSheet();
  const tab = TABS.find((t) => t.id === id) || TABS[0];
  app.scrollTop = 0;
  window.scrollTo(0, 0);
  tab.view.render(app, go);
  paintBar();
  try { localStorage.setItem('dd_tab', id); } catch { /* 無痕模式 */ }
}

function paintBar() {
  bar.innerHTML = TABS.map((t) => `
    <button data-tab="${t.id}" class="${t.id === current ? 'on' : ''}" aria-current="${t.id === current ? 'page' : 'false'}">
      ${tabIcon[t.id](t.id === current)}
      <span>${t.label}</span>
    </button>
  `).join('');
  bar.querySelectorAll('[data-tab]').forEach((b) => {
    b.addEventListener('click', () => go(b.dataset.tab));
  });
}

/* 還在取名字的階段，底下那些重畫都要讓開，不然會把首頁蓋掉。 */
let onboarding = false;

/* 一天過了午夜要重畫，不然日期會停在昨天。 */
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !onboarding && current === 'today') go('today');
});

/* 第一次打開先問名字。取過名字的人不會再看到這一頁。 */
function boot() {
  // 一進來就從網址上取走邀請碼（順手抹掉，重新整理不會再觸發一次）
  const invite = takeInviteCode();
  const first = !S.me().name;

  if (first) {
    onboarding = true;
    bar.style.display = 'none';
    app.style.paddingBottom = '0';
    welcome.render(app, () => {
      onboarding = false;
      bar.style.display = '';
      app.style.paddingBottom = '';
      go('today');
    }, invite);
    return;
  }

  let start = 'today';
  try { start = localStorage.getItem('dd_tab') || 'today'; } catch { /* 無痕模式 */ }
  go(TABS.some((t) => t.id === start) ? start : 'today');

  // 老使用者點了別人的邀請連結
  if (invite) together.promptJoin(invite, () => go('together'));
}

boot();

/* PWA
 * 本機開發時不註冊 service worker——它是 cache-first，
 * 會讓你剛改好的程式看不到，每次都要手動清快取。
 * 要在本機測離線行為的話，把下面這個 isLocal 判斷暫時拿掉。 */
const isLocal = ['localhost', '127.0.0.1', '::1'].includes(location.hostname);

if ('serviceWorker' in navigator) {
  if (isLocal) {
    // 之前測試留下的 SW 也一併清掉，不然它會繼續攔請求。
    navigator.serviceWorker.getRegistrations()
      .then((rs) => rs.forEach((r) => r.unregister()))
      .catch(() => {});
  } else {
    // 註冊之前先記著現在有沒有 SW 在管這一頁。
    // 第一次安裝也會觸發 controllerchange，那一次不該重載。
    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloading = false;

    window.addEventListener('load', async () => {
      try {
        // updateViaCache: 'none' —— 別讓瀏覽器快取 sw.js 本身。
        // 沒有這一行，改版之後它可能好幾天都不知道有新版，
        // 使用者會一直回報早就修好的問題。
        const reg = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
        reg.update().catch(() => {});

        // 每次回到前景順手問一次有沒有新版
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) reg.update().catch(() => {});
        });
      } catch { /* file:// 開會失敗，不影響功能 */ }
    });

    // 新版接手之後重載一次，使用者才會真的看到新版。
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloading) return;
      reloading = true;
      location.reload();
    });
  }
}
