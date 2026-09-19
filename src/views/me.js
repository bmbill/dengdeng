/* 我 —— 名字、統計、備份 */

import * as S from '../store.js';
import { esc, sheet, closeSheet, toast } from '../ui.js';
import { isOnlineMode } from '../config.js';
import { unverifiedCount, QUOTES } from '../quotes.js';

export function render(root, go) {
  const me = S.me();
  const t = S.totals();
  const streak = S.currentStreak();
  const longest = S.longestStreak();
  const unchecked = unverifiedCount();

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

      ${unchecked ? `
      <section class="card card-note">
        <div style="font-size:.81rem;font-weight:500">引文還有 ${unchecked} 句沒核對</div>
        <p class="small" style="margin-top:6px">
          <code style="background:#fff;padding:1px 5px;border-radius:5px">src/quotes.js</code> 裡每一條引文都帶
          <code style="background:#fff;padding:1px 5px;border-radius:5px">verified: false</code>。
          逐句對過原典再改成 true，UI 只會顯示核對過的。現在開獎卡只出現燈童自己的話。
        </p>
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
      } catch (e) {
        toast(e.message || '這個檔案讀不進來');
      }
    });
  });
}

export { QUOTES };
