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
import { MONTHLY_GOAL, isOnlineMode } from '../config.js';

let activeGroupId = null;

export function render(root, go) {
  const groups = S.myGroups();
  if (!groups.some((g) => g.id === activeGroupId)) {
    activeGroupId = groups[0]?.id || null;
  }

  root.innerHTML = `
    <header class="hd">
      <div class="hd-grow">
        <h1 class="plain">同行</h1>
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
  sub.textContent = `${groups.length} 個群 · 共 ${groups.reduce((a, g) => a + Number(g.memberCount), 0)} 人次`;

  const today = S.todayStr();
  const [feed, totals] = await Promise.all([
    SB.groupSea(activeGroupId, S.shiftDate(today, -13), today, 40),
    SB.monthlyTotals(activeGroupId),
  ]);

  body.innerHTML = `
    ${groups.length > 1 ? `
      <select class="field" data-group style="padding:11px 13px;font-size:.84rem">
        ${groups.map((g) => `<option value="${esc(g.id)}" ${g.id === activeGroupId ? 'selected' : ''}>${esc(g.name)} · ${g.memberCount} 人</option>`).join('')}
      </select>` : ''}

    ${totals ? progressCard(totals) : ''}

    ${feed && feed.length
      ? feed.map(lampRow).join('')
      : `<div class="empty">這兩週還沒有人公開紀錄。<br>你可以是第一個。</div>`}

    <div class="small center" style="padding:2px 10px 0">
      你的紀錄預設只有自己看得到 · 隨喜別人，你的燈也會亮一點
    </div>

    <div class="stack" style="gap:10px;padding-top:6px">
      <button class="btn ghost btn-full" data-invite>看「${esc(group.name)}」的邀請碼</button>
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
}

/* ── 片段 ── */

function progressCard(t) {
  const pct = Math.min(100, Math.round((t.pages / MONTHLY_GOAL) * 100));
  return `
    <section class="card tight" style="background:var(--night-2)">
      <div class="row" style="align-items:baseline;gap:8px">
        <div class="grow" style="font-size:.81rem;font-weight:500;color:var(--night-ink)">本月大眾共修</div>
        <div class="serif" style="font-size:1.12rem;font-weight:700;color:#F2C877">${t.pages}</div>
        <div style="font-size:.72rem;color:var(--night-muted)">/ ${MONTHLY_GOAL} 頁</div>
      </div>
      <div class="bar on-night" style="margin-top:11px"><i style="width:${pct}%"></i></div>
      <div style="margin-top:10px;font-size:.72rem;color:var(--night-muted);line-height:1.6">
        ${t.lamps} 盞燈 · ${t.entries} 則 · ${t.members} 人一起 · 只記總數，不排名次
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

async function openLamp(lampId, root, go) {
  sheet(`<div class="empty">正在拿這盞燈…</div>`);
  const d = await SB.lampDetail(lampId);
  if (!d) {
    closeSheet();
    return toast('這盞燈拿不到');
  }
  const myId = await SB.myUserId();
  const mine = d.authorId === myId;

  sheet(`
    <div class="center">
      ${renderLamp(d.lamp, { size: 92 })}
      <h2 style="margin-top:6px;font-size:1.2rem;color:var(--cinnabar-d)">${esc(d.lamp.name)}</h2>
      <div class="tiny" style="margin-top:8px">${esc(S.prettyDate(d.date))}</div>
    </div>

    <div class="row" style="margin-top:16px;gap:10px">
      <span class="avatar" style="width:34px;height:34px;border-radius:17px;font-size:.88rem">${esc(d.authorChar)}</span>
      <span class="grow" style="font-size:.81rem;font-weight:500">${esc(d.authorName)}${mine ? '（你）' : ''}</span>
    </div>

    <div class="stack" style="margin-top:14px;gap:12px">
      ${d.entries.length
        ? d.entries.map((e) => `
          <div>
            <div class="tiny">${esc(S.KINDS[e.kind]?.name || '紀錄')}${e.pages ? ` · ${e.pages} 頁` : ''}</div>
            <div class="small" style="color:var(--ink);margin-top:3px">${esc(e.text)}</div>
          </div>`).join('')
        : '<div class="small">這天沒有公開內容，只有一盞燈。</div>'}
    </div>

    ${d.replies.length ? `<div class="stack" style="margin-top:16px;gap:8px">
      ${d.replies.map((r) => `<div class="post-reply"><b>${esc(r.name || '無名')}</b>　${esc(r.body)}</div>`).join('')}
    </div>` : ''}

    <div class="post-acts" style="margin-top:18px">
      ${mine
        ? (d.joyCount ? `<span class="small">${d.joyCount} 人隨喜了這盞燈</span>` : '')
        : `<button class="btn chip ${d.joinedByMe ? 'on' : ''}" data-joy data-on="${d.joinedByMe ? '1' : '0'}">
             <span data-count>隨喜 ${d.joyCount}</span>
           </button>
           <button class="btn chip" data-reply>說一句</button>`}
    </div>
  `, (el) => {
    el.querySelector('[data-joy]')?.addEventListener('click', (e) => onJoy(e.currentTarget, d));
    el.querySelector('[data-reply]')?.addEventListener('click', () => openReply(d, root, go));
  });
}

async function onJoy(btn, d) {
  const on = btn.dataset.on === '1';
  btn.disabled = true;
  try {
    const now = await SB.toggleJoy(d.id, !on);
    btn.dataset.on = now ? '1' : '0';
    btn.classList.toggle('on', now);
    const label = btn.querySelector('[data-count]');
    const n = Number(label.textContent.replace(/\D/g, '')) + (now ? 1 : -1);
    label.textContent = `隨喜 ${Math.max(0, n)}`;

    // 隨喜不佔你今天那 3 則的額度。
    if (now) {
      S.addJoy(d.id, { authorName: d.authorName, date: d.date });
      // 今天的燈還沒點就還來得及讓它亮一點；點過了就只是記下來。
      toast(S.getDay().sealedAt ? '隨喜了' : '隨喜了，你今天的燈也亮一點');
    } else {
      S.removeJoy(d.id);
    }
  } catch (e) {
    toast(e.message || '隨喜失敗');
  } finally {
    btn.disabled = false;
  }
}

function openReply(d, root, go) {
  sheet(`
    <h2>說一句</h2>
    <p class="small" style="margin-top:6px">最多 60 字。這裡不是討論區，一句就好。</p>
    <textarea class="field" rows="3" maxlength="60" style="margin-top:14px" placeholder="例：五頁也是五頁，隨喜。"></textarea>
    <button class="btn btn-full" style="margin-top:16px" data-send>送出</button>
  `, (el) => {
    const ta = el.querySelector('textarea');
    ta.focus();
    el.querySelector('[data-send]').addEventListener('click', async () => {
      const t = ta.value.trim();
      if (!t) return toast('寫一句再送');
      try {
        await SB.reply(d.id, t);
        closeSheet();
        toast('送出了');
        render(root, go);
      } catch (e) {
        toast(e.message || '送不出去');
      }
    });
  });
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
  sheet(`
    <h2>「${esc(g.name)}」的邀請碼</h2>
    <p class="small" style="margin-top:6px">誰有碼誰就進得來，所以不要貼在公開的地方。</p>
    <div class="serif center" style="margin-top:18px;font-size:2rem;font-weight:700;letter-spacing:.3em;color:var(--cinnabar-d)">${esc(code)}</div>
    <button class="btn btn-full" style="margin-top:20px" data-copy>複製邀請碼</button>
  `, (el) => {
    el.querySelector('[data-copy]').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(code);
        toast('複製好了');
      } catch {
        toast('複製失敗，手動抄一下');
      }
    });
  });
}
