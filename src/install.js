/* 燈燈悅心 — 裝到主畫面
 *
 * 為什麼要管這件事：iOS 上，「Safari 裡的這個網站」和「主畫面上的
 * 這個 app」是兩個獨立的儲存空間。先在 Safari 試用、之後才加到
 * 主畫面的人，等於換了一台裝置——名字、紀錄、群組全部不在，
 * 而且會在伺服器上變成第二個身分，群裡出現兩個同一個人。
 * 這在真實使用者身上發生過兩次。
 *
 * 能做到什麼：
 *   Android / 桌機 Chrome  有 beforeinstallprompt，可以真的一鍵安裝
 *   iPhone / iPad          沒有任何 API。只能把「分享 → 加入主畫面」
 *                          這兩步畫出來給人看。這是 Safari 的限制，
 *                          不是還沒做。
 */

/** 現在是從主畫面的圖示打開的嗎。 */
export function isStandalone() {
  // navigator.standalone 是 iOS 專屬；display-mode 是標準做法，
  // Android 和桌機走這條。兩個都要看。
  return window.navigator.standalone === true
    || window.matchMedia('(display-mode: standalone)').matches;
}

export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    // iPadOS 13 之後的 Safari 會謊報成 Mac，用觸控點數補判
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// beforeinstallprompt 在頁面載入後很早就會發，而且只發一次。
// 所以這支模組一被 import 就要開始聽，不能等使用者走到某一頁。
let deferred = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();      // 擋掉瀏覽器自己那條橫幅，改由我們決定何時問
  deferred = e;
});

/** 這台裝置能不能一鍵安裝。iPhone 永遠是 false。 */
export function canPrompt() {
  return Boolean(deferred);
}

/** 叫出系統的安裝對話框。@returns 使用者有沒有裝 */
export async function promptInstall() {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;          // 同一個事件只能用一次
  try {
    e.prompt();
    const { outcome } = await e.userChoice;
    return outcome === 'accepted';
  } catch {
    return false;
  }
}

/** iOS 的分享鍵。畫出來比寫「按分享鍵」清楚得多。 */
export const SHARE_ICON = `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"
  style="width:1em;height:1em;vertical-align:-0.13em;display:inline-block">
  <path d="M10 13V2.5M10 2.5 6.8 5.7M10 2.5l3.2 3.2" stroke="currentColor"
        stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M4.5 9.5v7h11v-7" stroke="currentColor" stroke-width="1.6"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
