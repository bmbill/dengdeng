/* 我 —— 名字、統計、備份、換手機、提醒 */

import * as S from '../store.js';
import { esc, sheet, closeSheet, toast } from '../ui.js';
import { copyText } from '../invite.js';
import * as SB from '../supabase.js';
import { isOnlineMode } from '../config.js';
import * as PUSH from '../push.js';
import * as INSTALL from '../install.js';

export function render(root, go) {
  const me = S.me();
  const t = S.totals();
  const streak = S.currentStreak();
  const longest = S.longestStreak();

  root.innerHTML = `
    <header class="hd">
      <div class="hd-grow">
        <h1 class="plain">我</h1>
        <div class="sub">${me.name ? esc(me.name) : '還沒取名字'}</div>
      </div>
      <div class="avatar">${esc(me.avatarChar || '燈')}</div>
    </header>

    <div class="view">
      <div class="stats">
        <div class="stat"><b style="color:var(--cinnabar-d)">${streak}</b><span>連續天數</span></div>
        <div class="stat"><b style="color:var(--ochre-d)">${longest}</b><span>最長紀錄</span></div>
        <div class="stat"><b style="color:var(--malachite-d)">${t.joys}</b><span>次隨喜</span></div>
      </div>

      <section class="card">
        <div class="card-title">名字</div>
        <p class="small" style="margin-top:6px">同行看到的就是這個名字。取什麼都可以。</p>
        <input class="field" style="margin-top:12px" value="${esc(me.name)}" placeholder="例：王福智" data-name aria-label="名字">
        <button class="btn btn-full" style="margin-top:12px" data-save-name>存起來</button>
      </section>

      <section class="card">
        <div class="card-title">連線</div>
        <p class="small" style="margin-top:6px">
          ${isOnlineMode()
            ? (me.groups.length
                ? `已加入 ${me.groups.length} 個群：${me.groups.map((g) => esc(g.name)).join('、')}。`
                : '已連上伺服器，但還沒加入任何群。')
            : '目前是單機模式。紀錄只存在這台裝置，換手機要用下面的備份搬過去。'}
        </p>
        ${!isOnlineMode() ? `<p class="small" style="margin-top:8px">要開同行功能，照 README 建一個 Supabase 專案，把兩個值填進 <code style="background:var(--paper-2);padding:1px 5px;border-radius:5px">src/config.js</code>。</p>` : ''}
      </section>

      <section class="card">
        <div class="card-title">備份</div>
        <p class="small" style="margin-top:6px">把所有紀錄存成一個檔案，換裝置時再讀回來。</p>
        <div class="row" style="margin-top:12px;gap:10px">
          <button class="btn ghost grow" data-export>匯出</button>
          <button class="btn ghost grow" data-import>匯入</button>
        </div>
      </section>

      ${!INSTALL.isStandalone() ? `
      <section class="card">
        <div class="card-title">裝到主畫面</div>
        <p class="small" style="margin-top:6px">
          ${INSTALL.isIOS()
            ? `現在是在瀏覽器裡。按分享鍵 ${INSTALL.SHARE_ICON} →「加入主畫面」，之後都從那個圖示打開。iPhone 上這兩邊的紀錄是分開的，而且通知只給裝起來的那一個。`
            : '裝到主畫面之後可以離線用，也收得到提醒。'}
        </p>
        ${INSTALL.canPrompt() ? '<button class="btn btn-full" style="margin-top:12px" data-install>加入主畫面</button>' : ''}
      </section>` : ''}

      ${PUSH.isPushMode() ? `
      <section class="card">
        <div class="card-title">每天提醒</div>
        <div data-push-slot><p class="small" style="margin-top:6px">讀取中…</p></div>
      </section>` : ''}

      ${isOnlineMode() ? `
      <section class="card">
        <div class="card-title">換手機</div>
        <p class="small" style="margin-top:6px">
          新手機第一次打開時輸入這組碼，燈和群就會接過去。
          抄在紙上收好——它等於鑰匙，別人拿到就能接走你的紀錄。
        </p>
        <div data-code-slot></div>
        <button class="btn ghost btn-full" style="margin-top:12px" data-show-code>顯示接回碼</button>
      </section>` : ''}

      <div class="small center" style="padding:6px 10px 20px">
        燈燈悅心 · ${t.lamps} 盞燈 · ${t.entries} 則${t.pages ? ` · ${t.pages} 頁經` : ''}
      </div>
    </div>
  `;

  root.querySelector('[data-save-name]').addEventListener('click', () => {
    const v = root.querySelector('[data-name]').value.trim();
    S.setMe({ name: v });
    toast('存好了');
    go('me');
  });

  root.querySelector('[data-export]').addEventListener('click', doExport);
  root.querySelector('[data-import]').addEventListener('click', () => doImport(go));
  root.querySelector('[data-show-code]')?.addEventListener('click', showCode);

  root.querySelector('[data-install]')?.addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    const ok = await INSTALL.promptInstall();
    if (!ok) {
      e.currentTarget.disabled = false;
      toast('沒有裝成功，可以從瀏覽器選單再試一次');
    }
  });

  const pushSlot = root.querySelector('[data-push-slot]');
  if (pushSlot) mountPush(pushSlot);
}

// 整點，24 個。Worker 那邊的 dueNow() 收任何 HH:MM，
// 所以要加半點也只是改這一行。
const TIMES = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);

/**
 * 每天提醒。狀態要問瀏覽器才知道（訂閱在 service worker 那邊），
 * 所以畫面先出來、這一區慢慢填。
 */
async function mountPush(slot) {
  const why = {
    'ios-needs-install': '在 iPhone 上，要先把這個 app「加入主畫面」，從那個圖示打開才收得到通知。Safari 分頁裡不行，這是 iOS 的限制。',
    denied: '這台裝置封鎖了通知。要用的話得到系統設定裡把這個網站的通知打開。',
    unsupported: '這個瀏覽器不支援通知。',
  };

  const s = PUSH.supported();
  if (!s.ok) {
    slot.innerHTML = `<p class="small" style="margin-top:6px">${esc(why[s.why] || '目前不能開啟提醒。')}</p>`;
    return;
  }

  const on = Boolean(await PUSH.current());
  const time = S.me().pushTime || '21:00';

  slot.innerHTML = `
    <p class="small" style="margin-top:6px">
      ${on ? `每天 ${esc(time)} 提醒你來記一則。` : '每天挑一個時間提醒你來記一則。不會說你漏了什麼，只是問一句。'}
    </p>
    <select class="field" style="margin-top:12px" data-time aria-label="提醒時間">
      ${TIMES.map((t) => `<option value="${t}"${t === time ? ' selected' : ''}>每天 ${t}</option>`).join('')}
    </select>
    <button class="btn${on ? ' ghost' : ''} btn-full" style="margin-top:12px" data-toggle>
      ${on ? '關掉提醒' : '開啟提醒'}
    </button>
    ${on ? '<button class="btn ghost btn-full" style="margin-top:10px" data-test>馬上試一則</button>' : ''}`;

  const sel = slot.querySelector('[data-time]');
  const btn = slot.querySelector('[data-toggle]');

  sel.addEventListener('change', async () => {
    S.setMe({ pushTime: sel.value });
    if (!on) return;   // 還沒開啟的話，時間等按下去才一起送
    try {
      await PUSH.setTime(sel.value);
      toast(`改成每天 ${sel.value}`);
      mountPush(slot);
    } catch (e) {
      toast(e.message || '改不了時間');
    }
  });

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = on ? '正在關…' : '正在開…';
    try {
      if (on) {
        await PUSH.disable();
        toast('提醒關掉了');
      } else {
        // requestPermission 一定要在這個 click 裡面發生，
        // 不然瀏覽器會當成沒有使用者動作直接忽略。
        const ok = await PUSH.enable(sel.value);
        toast(ok ? `開好了，每天 ${sel.value}` : '沒有拿到通知權限');
      }
    } catch (e) {
      toast(e.message || '這一步失敗了');
    }
    mountPush(slot);
  });

  slot.querySelector('[data-test]')?.addEventListener('click', async () => {
    try {
      await PUSH.test();
      toast('送出去了，幾秒內會跳出來');
    } catch (e) {
      toast(e.message || '試不出來');
    }
  });
}

/** 顯示接回碼。要按了才去拿——沒人用到的話，伺服器上就不會有這組碼。 */
async function showCode(e) {
  const btn = e.currentTarget;
  const slot = btn.parentElement.querySelector('[data-code-slot]');
  btn.disabled = true;
  btn.textContent = '正在拿…';
  try {
    const code = await SB.myRecoveryCode();
    // 四碼一組，用看的和用抄的都比較不會錯行
    const pretty = String(code).replace(/(.{4})(?=.)/g, '$1-');
    slot.innerHTML = `
      <div class="field center serif" style="margin-top:12px;letter-spacing:.18em;font-size:1.25rem">
        ${esc(pretty)}
      </div>
      <button class="btn ghost btn-full" style="margin-top:10px" data-copy>複製</button>`;
    btn.remove();
    slot.querySelector('[data-copy]').addEventListener('click', async () => {
      toast(await copyText(code) ? '接回碼複製好了' : '複製失敗，手動抄一下');
    });
  } catch (err) {
    btn.disabled = false;
    btn.textContent = '顯示接回碼';
    toast(err.message || '拿不到接回碼，等一下再試');
  }
}

/** 用備份檔裡的邀請碼把群組接回來。失敗不擋人，之後在同行分頁還能手動加。 */
async function rejoinGroups() {
  if (!isOnlineMode()) return;

  const codes = S.myGroups()
    .map((g) => ({ name: g.name, code: g.inviteCode }))
    .filter((g) => g.code);
  if (!codes.length) return;

  await SB.syncProfile().catch(() => {});

  const ok = [];
  for (const g of codes) {
    try {
      await SB.joinGroup(g.code);
      ok.push(g.name);
    } catch (e) {
      console.warn('[燈燈悅心] 重新加入失敗', g.name, e.message);
    }
  }

  if (!ok.length) return toast('紀錄接回來了，但群組要再用邀請碼加一次');

  // 之前因為不在群裡而沒送出去的燈，現在補上
  const n = await SB.resendPublic().catch(() => 0);
  toast(n ? `接回了 ${ok.join('、')}，補送 ${n} 盞燈` : `接回了 ${ok.join('、')}`);
}

function doExport() {
  const blob = new Blob([S.exportAll()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `燈燈悅心-${S.todayStr()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function doImport(go) {
  sheet(`
    <h2>匯入備份</h2>
    <p class="small" style="margin-top:6px">這會蓋掉這台裝置上現有的紀錄，確定再做。</p>
    <input type="file" accept="application/json" class="field" style="margin-top:14px" data-file>
    <button class="btn btn-full" style="margin-top:16px" data-go>讀進來</button>
  `, (el) => {
    el.querySelector('[data-go]').addEventListener('click', async () => {
      const f = el.querySelector('[data-file]').files[0];
      if (!f) return toast('先選一個檔案');
      try {
        S.importAll(await f.text());
        closeSheet();
        toast('匯入完成');
        go('me');
        // 群組成員資格在伺服器上，綁的是匿名身分，不在備份檔裡。
        // 新裝置是新身分，所以匯入完一定不在任何群裡——
        // 畫面上會短暫看到群組，一進同行就被伺服器的空清單蓋掉，
        // 而且之後供的燈會發進虛空（一個群都分享不到）。
        // 備份檔裡每個群都帶著邀請碼，所以這裡直接拿去重新加入。
        rejoinGroups();
      } catch (e) {
        toast(e.message || '這個檔案讀不進來');
      }
    });
  });
}
