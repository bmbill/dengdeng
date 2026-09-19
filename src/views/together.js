/* 同行 —— 群組，以及用讀的方式看大家的紀錄
 *
 * 跟「燈海 → 大家的」是同一份資料，只是這裡用清單，適合慢慢讀；
 * 那裡用夜空，適合晃一晃看哪盞亮。
 *
 * 刻意沒有排行榜。只有大眾合計，因為比較心對修行社群是有害的。
 */

import * as S from '../store.js';
import * as SB from '../supabase.js';
import { esc, icon, sheet, closeSheet, toast } from '../ui.js';
import { renderLamp } from '../lamp.js';
import { inviteMessage, inviteUrl, copyText, shareOrCopy } from '../invite.js';
import { showSharedLamp } from './lampcard.js';
import { SKY_SIZE, isOnlineMode } from '../config.js';

let activeGroupId = null;

export function render(root, go) {
  const groups = S.myGroups();
  if (!groups.some((g) => g.id === activeGroupId)) {
    activeGroupId = groups[0]?.id || null;
  }

  root.innerHTML = `
    <header class="hd">
      <div class="hd-grow">
        <h1 class="plain">與光同行</h1>
        <div class="sub" data-sub>${isOnlineMode() ? '載入中…' : '還沒連上伺服器'}</div>
      </div>
      <button class="avatar" data-add aria-label="加入或開一個群"
              style="background:#fff;border:1px solid var(--line-2)">${icon.invite()}</button>
    </header>
    <div class="view" data-body></div>
  `;

  const body = root.querySelector('[data-body]');
  root.querySelector('[data-add]').addEventListener('click', () => openAddGroup(root, go));

  if (!isOnlineMode()) {
    root.querySelector('[data-sub]').textContent = '單機模式';
    body.innerHTML = offlineNotice();
    return;
  }

  body.innerHTML = `<div class="empty">正在看大家在做什麼…</div>`;
  load(root, go);
}

async function load(root, go) {
  const body = root.querySelector('[data-body]');
  const sub = root.querySelector('[data-sub]');

  // 整段包起來：任何一個呼叫擲錯都不該讓畫面永遠卡在「載入中」。
  try {
    // 每次進來都重抓群組清單，別人改了名字或有人加入才看得到。
    const groups = await SB.myGroups();
    if (groups === null) {
      sub.textContent = '目前離線';
      body.innerHTML = `<div class="empty">連不上伺服器。<br>你自己的紀錄還是好好存在這台裝置上。</div>`;
      return;
    }

    if (!groups.length) {
      sub.textContent = '還沒加入任何群';
      body.innerHTML = noGroupNotice();
      body.querySelector('[data-join]').addEventListener('click', () => openAddGroup(root, go));
      return;
    }

    if (!groups.some((g) => g.id === activeGroupId)) activeGroupId = groups[0].id;
    const group = groups.find((g) => g.id === activeGroupId);
    sub.textContent = `${groups.length} 個群 · ${group.memberCount} 人`;

    // 跟「燈海 → 大家的」同一份資料，只是這裡用讀的。
    const [feed, info] = await Promise.all([
      SB.groupSky(activeGroupId, 0, SKY_SIZE),
      SB.groupSkyInfo(activeGroupId, 0, SKY_SIZE),
    ]);

    if (feed === null) {
      body.innerHTML = `<div class="empty">讀不到這個群的燈。<br>資料庫可能還沒更新到最新版的 schema。</div>`;
      return;
    }

    body.innerHTML = `
      ${groups.length > 1 ? `
        <select class="field" data-group style="padding:11px 13px;font-size:.84rem">
          ${groups.map((g) => `<option value="${esc(g.id)}" ${g.id === activeGroupId ? 'selected' : ''}>${esc(g.name)} · ${g.memberCount} 人</option>`).join('')}
        </select>` : ''}

      ${info ? progressCard(info) : ''}

      ${feed.length
        ? feed.map(lampRow).join('')
        : `<div class="empty">這片天空還沒有人公開紀錄。<br>你可以是第一個。</div>`}

      <div class="small center" style="padding:2px 10px 0">
        你的紀錄預設只有自己看得到 · 隨喜別人，你的燈也會亮一點
      </div>

      <div class="stack" style="gap:10px;padding-top:6px">
        <button class="btn ghost btn-full" data-invite>邀請朋友加入「${esc(group.name)}」</button>
      </div>
    `;

    body.querySelector('[data-group]')?.addEventListener('change', (e) => {
      activeGroupId = e.target.value;
      render(root, go);
    });

    body.querySelector('[data-invite]').addEventListener('click', () => showCode(group));

    body.querySelectorAll('[data-lamp]').forEach((b) => {
      b.addEventListener('click', () => openLamp(b.dataset.lamp, root, go));
    });
  } catch (e) {
    console.warn('[燈燈] 同行載入失敗', e);
    sub.textContent = '載入失敗';
    body.innerHTML = `<div class="empty">載入失敗了。<br>下拉重新整理，或稍後再試。</div>`;
  }
}

/* ── 片段 ── */

function progressCard(info) {
  const left = Math.max(0, info.size - info.filled);
  const pct = Math.round((info.filled / info.size) * 100);
  return `
    <section class="card tight" style="background:var(--night-2)">
      <div class="row" style="align-items:baseline;gap:8px">
        <div class="grow" style="font-size:.81rem;font-weight:500;color:var(--night-ink)">第 ${info.skyNo} 片天空</div>
        <div class="serif" style="font-size:1.12rem;font-weight:700;color:#F2C877">${info.filled}</div>
        <div style="font-size:.72rem;color:var(--night-muted)">/ ${info.size} 盞</div>
      </div>
      <div class="bar on-night" style="margin-top:11px"><i style="width:${pct}%"></i></div>
      <div style="margin-top:10px;font-size:.72rem;color:var(--night-muted);line-height:1.7">
        ${left ? `再 ${left} 盞就滿了` : '滿了，下一盞會開新的一片'} ·
        ${info.authors} 個人 · ${info.entries} 則${info.pages ? ` · ${info.pages} 頁經` : ''}
        <br>只記總數，不排名次
      </div>
    </section>
  `;
}

function lampRow(l) {
  return `
    <button class="card tight" data-lamp="${esc(l.id)}"
            style="width:100%;text-align:left;border:none;cursor:pointer">
      <span class="row">
        <span class="avatar" style="width:34px;height:34px;border-radius:17px;font-size:.88rem">${esc(l.authorChar)}</span>
        <span class="grow">
          <span style="display:block;font-size:.78rem;font-weight:500">${esc(l.authorName)}</span>
          <span class="tiny" style="display:block;margin-top:1px">${when(l.date)} · ${l.entryCount} 則${l.pages ? ` · ${l.pages} 頁` : ''}</span>
        </span>
        <span style="flex-shrink:0">${renderLamp(l.lamp, { size: 34 })}</span>
      </span>
      <span class="post-acts" style="margin-top:12px">
        <span class="btn chip ${l.joinedByMe ? 'on' : ''}" style="pointer-events:none">
          ${icon.joy(l.joinedByMe ? '#B04A31' : '#8A8073', l.joinedByMe)} 隨喜 ${l.joyCount}
        </span>
        ${l.replyCount ? `<span class="tiny">${l.replyCount} 則回應</span>` : ''}
        <span class="grow"></span>
        <span class="tiny">${esc(l.lamp.name)}</span>
      </span>
    </button>
  `;
}

function when(dateStr) {
  const today = S.todayStr();
  if (dateStr === today) return '今天';
  if (dateStr === S.shiftDate(today, -1)) return '昨天';
  return S.prettyDate(dateStr).split(' ·')[0];
}

function offlineNotice() {
  return `
    <section class="card">
      <div class="card-title">同行還沒開啟</div>
      <p class="small" style="margin-top:8px">
        要跟人一起玩，需要先建一個 Supabase 專案，把網址和 anon key 填進
        <code style="background:var(--paper-2);padding:1px 5px;border-radius:5px">src/config.js</code>。
        步驟寫在 README 裡。
      </p>
      <p class="small" style="margin-top:10px">
        在那之前，app 完全可以自己用：紀錄都存在這台裝置，燈照樣會亮。
      </p>
    </section>
  `;
}

function noGroupNotice() {
  return `
    <section class="card">
      <div class="card-title">還沒加入任何群</div>
      <p class="small" style="margin-top:8px">
        群是邀請制的。跟開群的人要一組邀請碼，或者自己開一個。
        一個人可以同時在好幾個群裡，寫一次就能同時亮在好幾片天空。
      </p>
      <button class="btn btn-full" style="margin-top:14px" data-join>加入或開一個群</button>
    </section>
  `;
}

/* ── 一盞燈 ── */
// 跟燈海點開的是同一張小卡，見 lampcard.js

function openLamp(lampId, root, go) {
  showSharedLamp(lampId, () => render(root, go));
}

/* ── 群組 ── */

function openAddGroup(root, go) {
  if (!isOnlineMode()) return toast('要先在 src/config.js 填上 Supabase 設定');

  sheet(`
    <h2>加入同行</h2>
    <p class="small" style="margin-top:6px">跟開群的人要一組邀請碼。一個人可以同時在好幾個群裡。</p>
    <input class="field" style="margin-top:14px;letter-spacing:.2em;text-align:center;font-size:1.2rem"
           maxlength="8" placeholder="ABCD2345" aria-label="邀請碼" data-code>
    <button class="btn btn-full" style="margin-top:14px" data-join>加入</button>

    <div class="row" style="margin:18px 0 14px;gap:12px">
      <span style="flex-grow:1;height:1px;background:var(--line)"></span>
      <span class="tiny">或者自己開一個</span>
      <span style="flex-grow:1;height:1px;background:var(--line)"></span>
    </div>

    <input class="field" placeholder="群組名稱，例：週三共修" maxlength="40" data-newname aria-label="群組名稱">
    <button class="btn ghost btn-full" style="margin-top:12px" data-create>開一個新群</button>
  `, (el) => {
    el.querySelector('[data-code]').focus();

    el.querySelector('[data-join]').addEventListener('click', async () => {
      const code = el.querySelector('[data-code]').value.trim();
      if (!code) return toast('貼上邀請碼');
      try {
        const g = await SB.joinGroup(code);
        activeGroupId = g.id;
        closeSheet();
        toast(`加入了「${g.name}」`);
        render(root, go);
      } catch (e) {
        toast(e.message || '加入失敗');
      }
    });

    el.querySelector('[data-create]').addEventListener('click', async () => {
      const name = el.querySelector('[data-newname]').value.trim();
      if (!name) return toast('先給這個群一個名字');
      try {
        const g = await SB.createGroup(name);
        activeGroupId = g.id;
        closeSheet();
        showCode(g);
      } catch (e) {
        toast(e.message || '開群失敗');
      }
    });
  });
}

function showCode(g) {
  const code = g.inviteCode || g.invite_code;
  const msg = inviteMessage(g.name, code);

  sheet(`
    <h2>邀請朋友加入「${esc(g.name)}」</h2>
    <p class="small" style="margin-top:6px">
      整段傳給對方就好。他點開連結、取個名字，就直接進來了，不用自己找地方輸入。
    </p>

    <div class="invite-preview">${esc(msg)}</div>

    <button class="btn btn-full" style="margin-top:16px" data-share>傳給朋友</button>
    <button class="btn ghost btn-full" style="margin-top:10px" data-copy-msg>複製整段訊息</button>

    <div class="row" style="margin:18px 0 12px;gap:12px">
      <span style="flex-grow:1;height:1px;background:var(--line)"></span>
      <span class="tiny">或者只給他邀請碼</span>
      <span style="flex-grow:1;height:1px;background:var(--line)"></span>
    </div>

    <button class="btn ghost btn-full" data-copy-code>
      <span class="serif" style="letter-spacing:.24em;font-weight:700">${esc(code)}</span>
    </button>
    <p class="small" style="margin-top:10px;color:var(--faint)">
      誰拿到誰就進得來，不要貼在公開的地方。
    </p>
  `, (el) => {
    el.querySelector('[data-share]').addEventListener('click', async () => {
      const r = await shareOrCopy(msg);
      if (r === 'copied') toast('已複製，貼給朋友就行');
      else if (r === 'failed') toast('複製失敗，手動選取那段字');
    });

    el.querySelector('[data-copy-msg]').addEventListener('click', async () => {
      toast(await copyText(msg) ? '整段複製好了' : '複製失敗，手動選取');
    });

    el.querySelector('[data-copy-code]').addEventListener('click', async () => {
      toast(await copyText(code) ? '邀請碼複製好了' : '複製失敗，手動抄一下');
    });
  });
}

/** 老使用者點了別人的邀請連結。 */
export function promptJoin(code, onDone) {
  sheet(`
    <h2>有人邀你加入</h2>
    <p class="small" style="margin-top:6px">
      邀請碼 <b class="serif" style="letter-spacing:.2em">${esc(code)}</b>。
      加入之後，你發的燈可以選擇要不要同時亮在這個群裡。
    </p>
    <button class="btn btn-full" style="margin-top:18px" data-join>加入</button>
    <button class="btn ghost btn-full" style="margin-top:10px" data-skip>先不要</button>
  `, (el) => {
    el.querySelector('[data-skip]').addEventListener('click', closeSheet);
    el.querySelector('[data-join]').addEventListener('click', async () => {
      try {
        await SB.syncProfile();
        const g = await SB.joinGroup(code);
        activeGroupId = g.id;
        closeSheet();
        toast(`加入了「${g.name}」`);
        onDone?.();
      } catch (e) {
        toast(e.message || '加入失敗');
      }
    });
  });
}

export { inviteUrl };
