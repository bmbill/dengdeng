/* 燈海
 *
 * 兩種看法，同一份資料：
 *   我的   — 自己點過的所有燈
 *   大家的 — 共同燈海。一片天空 = 幾天，可以一片一片往回翻。
 *            點一盞燈就看得到那天的善行，可以隨喜。
 */

import * as S from '../store.js';
import * as SB from '../supabase.js';
import { esc, sheet, closeSheet, toast } from '../ui.js';
import { renderLamp, renderSpark, glowOf, TIER_LABEL, BOWLS, FLAMES } from '../lamp.js';
import { skyDaysFor, SKY_DEFAULT_DAYS, SKY_RENDER_CAP, isOnlineMode } from '../config.js';

/* 里程碑用佛教慣用的數字，不是整十整百。 */
const MILESTONES = [
  { at: 7, label: '燈海起了風' },
  { at: 21, label: '習慣開始長根' },
  { at: 49, label: '燈海浮起一座塔' },
  { at: 108, label: '繞成一圈' },
  { at: 365, label: '這是一整片夜空' },
];

/* 跨重繪保留的檢視狀態 */
const view = {
  mode: 'mine',      // 'mine' | 'group'
  groupId: null,
  skyEnd: null,      // 這片天空的最後一天，null = 到今天
};

/* 每個群各自的「一片天空幾天」。算過一次就記著，不用每次重算。 */
const skyDays = new Map();

/**
 * 一片天空該涵蓋幾天，依這個群最近 30 天的實際發文量回推。
 * 10 人的群和 200 人的群差 20 倍，寫死一定有一邊很難看。
 */
async function daysFor(groupId) {
  if (skyDays.has(groupId)) return skyDays.get(groupId);

  const today = S.todayStr();
  const stats = await SB.groupSeaStats(groupId, S.shiftDate(today, -29), today);
  const days = stats ? skyDaysFor(stats.lamps) : SKY_DEFAULT_DAYS;
  skyDays.set(groupId, days);
  return days;
}

export function render(root, go) {
  const groups = S.myGroups();
  const canGroup = isOnlineMode() && groups.length > 0;

  if (!canGroup) view.mode = 'mine';
  if (canGroup && !groups.some((g) => g.id === view.groupId)) {
    view.groupId = groups[0].id;
  }

  root.innerHTML = `
    <header class="hd">
      <div class="hd-grow">
        <h1 class="plain">燈海</h1>
        <div class="sub" data-sub></div>
      </div>
    </header>
    ${canGroup ? segmented(groups) : ''}
    <div class="view" data-body></div>
  `;

  root.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
    view.mode = b.dataset.mode;
    view.skyEnd = null;
    render(root, go);
  }));

  root.querySelector('[data-group]')?.addEventListener('change', (e) => {
    view.groupId = e.target.value;
    view.skyEnd = null;
    render(root, go);
  });

  if (view.mode === 'mine') renderMine(root, go);
  else renderGroup(root, go);
}

function segmented(groups) {
  return `
    <div style="padding:0 var(--gutter) 4px">
      <div class="seg">
        <button data-mode="mine" class="${view.mode === 'mine' ? 'on' : ''}">我的</button>
        <button data-mode="group" class="${view.mode === 'group' ? 'on' : ''}">大家的</button>
      </div>
      ${view.mode === 'group' && groups.length > 1 ? `
        <select class="field" data-group style="margin-top:10px;padding:10px 12px;font-size:.81rem">
          ${groups.map((g) => `<option value="${esc(g.id)}" ${g.id === view.groupId ? 'selected' : ''}>${esc(g.name)} · ${g.memberCount} 人</option>`).join('')}
        </select>` : ''}
    </div>
  `;
}

/* ══════════════════ 我的 ══════════════════ */

function renderMine(root, go) {
  const list = S.lamps();
  const t = S.totals();
  const next = MILESTONES.find((m) => m.at > list.length);
  const streak = S.currentStreak();
  const body = root.querySelector('[data-body]');

  root.querySelector('[data-sub]').textContent = list.length
    ? `從 ${S.prettyDate(list[0].date).split(' ·')[0]} 起，一天一盞`
    : '還沒有燈';

  body.innerHTML = `
    <div class="stats">
      <div class="stat"><b style="color:var(--cinnabar-d)">${t.lamps}</b><span>盞燈</span></div>
      <div class="stat"><b style="color:var(--ochre-d)">${t.entries}</b><span>則紀錄</span></div>
      <div class="stat"><b style="color:var(--azurite-d)">${t.pages}</b><span>頁經</span></div>
    </div>

    <div class="sea">
      ${list.length
        ? scatter(list.map((d) => ({ key: d.date, lamp: d.lamp, mineDate: d.date })))
        : `<div class="empty" style="color:var(--night-muted);position:relative;z-index:2">寫一則短短的<br>這裡就會亮起第一盞</div>`}
      ${list.length ? `<div class="sea-foot">
        <div class="grow">
          <div class="t">今晚亮著 ${list.length} 盞</div>
          <div class="s">最新一盞：${esc(list[list.length - 1].lamp.name)}${streak > 1 ? ` · 連續 ${streak} 天` : ''}</div>
        </div>
        <button class="btn sm on-night" data-all>看全部</button>
      </div>` : ''}
    </div>

    ${next ? milestone(list.length, next) : ''}
    ${list.length ? recent(list) : ''}
  `;

  body.querySelector('[data-all]')?.addEventListener('click', openAll);
  body.querySelectorAll('[data-mine]').forEach((b) => {
    b.addEventListener('click', () => openMine(b.dataset.mine));
  });
}

function milestone(count, next) {
  const prev = MILESTONES.filter((m) => m.at <= count).pop();
  const from = prev ? prev.at : 0;
  const pct = Math.round(((count - from) / (next.at - from)) * 100);
  return `
    <section class="card tight">
      <div class="row">
        <span style="flex-shrink:0;width:52px;height:52px;border-radius:17px;background:var(--paper-2);display:flex;align-items:center;justify-content:center">
          ${renderLamp({ form: 'pagoda', bowl: 'cinnabar', flame: 'gamboge' }, { size: 30, lit: false })}
        </span>
        <span class="grow">
          <span style="display:block;font-size:.81rem;font-weight:500">再 ${next.at - count} 盞，${esc(next.label)}</span>
          <span class="bar" style="display:block;margin-top:7px"><i style="width:${pct}%"></i></span>
          <span class="tiny" style="display:block;margin-top:6px">${count} / ${next.at}</span>
        </span>
      </div>
    </section>
  `;
}

function recent(list) {
  const last = list.slice(-6).reverse();
  return `
    <section class="card">
      <div class="card-title">最近點的</div>
      <div style="margin-top:14px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px">
        ${last.map((d) => `
          <button data-mine="${esc(d.date)}" style="border:none;background:none;padding:8px 4px;border-radius:var(--r-m);text-align:center;min-height:44px">
            ${renderLamp(d.lamp, { size: 54 })}
            <span class="tiny" style="display:block;margin-top:4px">${esc(d.lamp.name)}</span>
          </button>`).join('')}
      </div>
    </section>
  `;
}

/* ══════════════════ 大家的 ══════════════════ */

async function renderGroup(root, go) {
  const body = root.querySelector('[data-body]');
  const sub = root.querySelector('[data-sub]');
  const groupId = view.groupId;
  const group = S.myGroups().find((g) => g.id === groupId);

  sub.textContent = group ? `${group.name} · ${group.memberCount} 人` : '大家的燈海';
  body.innerHTML = `<div class="empty">正在點亮這片天空…</div>`;

  const days = await daysFor(groupId);
  const end = view.skyEnd || S.todayStr();
  const start = S.shiftDate(end, -(days - 1));
  const isNow = !view.skyEnd;

  const [lamps, stats] = await Promise.all([
    SB.groupSea(groupId, start, end, SKY_RENDER_CAP),
    SB.groupSeaStats(groupId, start, end),
  ]);

  if (lamps === null) {
    body.innerHTML = `<div class="empty">連不上伺服器。<br>你自己的燈還是好好地在「我的」裡面。</div>`;
    return;
  }

  const shown = lamps.length;
  const total = stats ? stats.lamps : shown;

  body.innerHTML = `
    <div class="sky-nav">
      <button class="btn chip" data-prev aria-label="上一片天空">◀</button>
      <div class="grow center">
        <div class="serif" style="font-size:.94rem;font-weight:600">${skyLabel(start, end)}</div>
        <div class="tiny" style="margin-top:2px">${spanLabel(days, isNow)}</div>
      </div>
      <button class="btn chip" data-next aria-label="下一片天空" ${isNow ? 'disabled' : ''}>▶</button>
    </div>

    <div class="sea">
      ${shown
        ? scatter(lamps.map((l) => ({
            key: l.id, lamp: l.lamp, id: l.id, joined: l.joinedByMe, joys: l.joyCount,
          })))
        : `<div class="empty" style="color:var(--night-muted);position:relative;z-index:2">這片天空還沒有燈</div>`}
      ${shown ? `<div class="sea-foot">
        <div class="grow">
          <div class="t">這片天空 ${total} 盞</div>
          <div class="s">${stats ? `${stats.authors} 個人${stats.pages ? ` · 誦經 ${stats.pages} 頁` : ''}` : ''}${total > shown ? ` · 畫出其中 ${shown} 盞` : ''}</div>
        </div>
      </div>` : ''}
    </div>

    ${shown ? `<div class="small center">點一盞燈，看看那天發生了什麼</div>` : ''}
    ${stats ? groupStats(stats) : ''}
  `;

  body.querySelectorAll('[data-lamp-id]').forEach((b) => {
    b.addEventListener('click', () => openShared(b.dataset.lampId, root, go));
  });

  body.querySelector('[data-prev]').addEventListener('click', async () => {
    const prev = await SB.prevSkyDay(groupId, start);
    if (!prev) return toast('再往前就沒有燈了');
    view.skyEnd = prev;
    render(root, go);
  });

  body.querySelector('[data-next]').addEventListener('click', () => {
    const nextEnd = S.shiftDate(end, SKY_DAYS);
    view.skyEnd = nextEnd >= S.todayStr() ? null : nextEnd;
    render(root, go);
  });
}

/**
 * 天數是自動算的，所以說明文字也要跟著。
 * 人少的群一片天空可能橫跨一個月，那時候寫「這幾天」是騙人的。
 */
function spanLabel(days, isNow) {
  if (!isNow) return '往回翻';
  if (days <= 1) return '今天';
  if (days <= 4) return '這幾天';
  if (days <= 10) return `最近 ${days} 天`;
  return `最近 ${days} 天 · 人多起來會自動縮短`;
}

function skyLabel(start, end) {
  if (start === end) return S.prettyDate(end).split(' ·')[0];
  const a = S.prettyDate(start).split(' ·')[0];
  const b = S.prettyDate(end).split(' ·')[0];
  // 同一個月就不重複月份
  const [, ma] = a.match(/^(.+月)/) || [];
  const [, mb] = b.match(/^(.+月)/) || [];
  return ma && ma === mb ? `${a}–${b.slice(ma.length)}` : `${a} – ${b}`;
}

function groupStats(s) {
  return `
    <section class="card tight" style="background:var(--night-2)">
      <div class="row" style="align-items:baseline;gap:8px">
        <div class="grow" style="font-size:.81rem;font-weight:500;color:var(--night-ink)">這幾天，大家一起</div>
      </div>
      <div class="row" style="margin-top:12px;gap:18px">
        <div><div class="serif" style="font-size:1.25rem;font-weight:700;color:#F2C877">${s.lamps}</div><div style="font-size:.69rem;color:var(--night-muted);margin-top:2px">盞燈</div></div>
        <div><div class="serif" style="font-size:1.25rem;font-weight:700;color:#F2C877">${s.entries}</div><div style="font-size:.69rem;color:var(--night-muted);margin-top:2px">則紀錄</div></div>
        ${s.pages ? `<div><div class="serif" style="font-size:1.25rem;font-weight:700;color:#F2C877">${s.pages}</div><div style="font-size:.69rem;color:var(--night-muted);margin-top:2px">頁經</div></div>` : ''}
      </div>
      <div style="margin-top:12px;font-size:.72rem;color:var(--night-muted);line-height:1.6">只記總數，不排名次</div>
    </section>
  `;
}

/* ══════════════════ 散佈 ══════════════════
 *
 * R2 低差異序列（Roberts sequence）：步長取自塑膠數 g = 1.3247…，
 * 兩軸用 1/g 和 1/g²。這組是專門為二維設計的——
 * 用黃金比例配隨便一個無理數會讓連續的點落在格子上，
 * 夜空就會出現一條一條的斜紋。
 *
 * 同一批燈每次算出來的位置都一樣，刷新不會跳動。 */

const R2_X = 0.7548776662466927;   // 1/g
const R2_Y = 0.5698402909980532;   // 1/g²

function scatter(items) {
  const shown = items.slice(-SKY_RENDER_CAP);

  if (shown.length <= 2) {
    return shown.map((it, i) => place(it, shown.length === 1 ? 50 : 36 + i * 28, 44)).join('');
  }

  // 亮的燈最後畫，才會疊在上面。
  return shown
    .map((it, i) => {
      const seed = hashStr(it.key);
      const n = i + 1;
      // 小幅抖動，把序列殘留的規律再打散一點
      const jx = ((seed % 1000) / 1000 - 0.5) * 5;
      const jy = (((seed >> 10) % 1000) / 1000 - 0.5) * 5;
      const x = 8 + 84 * ((0.5 + n * R2_X) % 1) + jx;
      const y = 11 + 64 * ((0.5 + n * R2_Y) % 1) + jy;
      return { it, x, y, glow: glowOf(it.joys) };
    })
    .sort((a, b) => a.glow - b.glow)
    .map(({ it, x, y, glow }) => place(it, x, y, glow))
    .join('');
}

/** 天空上的每一盞燈都可以點——不管是自己的還是別人的。 */
function place(it, x, y, glow = 0) {
  const px = { common: 7, uncommon: 9, rare: 12 }[it.lamp.tier] || 7;
  const pos = `left:${x.toFixed(1)}%;top:${y.toFixed(1)}%`;
  const spark = renderSpark(it.lamp, px, glow);

  // 自己的燈海：點了看那天寫了什麼
  if (it.mineDate) {
    return `<button class="sea-lamp" style="${pos}"
              data-mine="${esc(it.mineDate)}"
              aria-label="看 ${esc(it.mineDate)} 這盞燈">${spark}</button>`;
  }

  // 共同燈海：點了看那天的善行，可以隨喜
  const label = it.joys ? `看這盞燈，${it.joys} 人隨喜` : '看這盞燈';
  return `<button class="sea-lamp${it.joined ? ' joined' : ''}" style="${pos}"
            data-lamp-id="${esc(it.id)}" aria-label="${label}">${spark}</button>`;
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) >>> 0;
  return h;
}

/* ══════════════════ 點開一盞燈 ══════════════════ */

/**
 * 自己的燈：內容直接讀本機，不用等網路。
 * 如果這盞有發出去，再去問一下有誰隨喜、有誰說了話。
 */
function openMine(date) {
  const day = S.getDay(date);
  if (!day.lamp) return;
  const l = day.lamp;
  const joys = (day.joys || []).length;

  sheet(`
    ${lampHead(l, S.prettyDate(date))}

    <div class="stack" style="margin-top:20px;gap:12px">
      ${(day.entries || []).length
        ? (day.entries || []).map((e) => entryBlock(e)).join('')
        : '<div class="small">這天沒有寫，只有一盞燈。</div>'}
      ${joys ? `<div>
        <div class="tiny">隨喜</div>
        <div class="small" style="color:var(--ink);margin-top:3px">你隨喜了 ${joys} 盞別人的燈</div>
      </div>` : ''}
    </div>

    <div data-echo style="margin-top:16px"></div>

    <button class="btn ghost btn-full" style="margin-top:20px" data-dismiss>關起來</button>
  `, (el) => {
    el.querySelector('[data-dismiss]').addEventListener('click', closeSheet);
    if (day.remoteId) loadEcho(el.querySelector('[data-echo]'), day.remoteId);
  });
}

/** 自己那盞燈的回音：誰隨喜了、誰說了什麼。 */
async function loadEcho(slot, remoteId) {
  const d = await SB.lampDetail(remoteId);
  if (!d || !slot.isConnected) return;
  if (!d.joyCount && !d.replies.length) return;

  slot.innerHTML = `
    <div style="padding-top:15px;border-top:1px solid var(--line)">
      ${d.joyCount ? `<div class="row" style="gap:10px">
        <span style="flex-shrink:0">${renderLamp(d.lamp, { size: 28 })}</span>
        <span class="small" style="color:var(--ink)">${d.joyCount} 個人隨喜了這盞燈</span>
      </div>` : ''}
      ${d.replies.length ? `<div class="stack" style="margin-top:12px;gap:8px">
        ${d.replies.map((r) => `<div class="post-reply"><b>${esc(r.name || '無名')}</b>　${esc(r.body)}</div>`).join('')}
      </div>` : ''}
    </div>
  `;
}

/** 別人的燈：拉完整內容，可以隨喜、可以說一句。 */
async function openShared(lampId, root, go) {
  sheet(`<div class="empty">正在拿這盞燈…</div>`);
  const d = await SB.lampDetail(lampId);
  if (!d) {
    closeSheet();
    return toast('這盞燈拿不到');
  }

  const mine = d.authorId === (await SB.myUserId());

  sheet(`
    ${lampHead(d.lamp, S.prettyDate(d.date))}

    <div class="row" style="margin-top:16px;gap:10px">
      <span class="avatar" style="width:34px;height:34px;border-radius:17px;font-size:.88rem">${esc(d.authorChar)}</span>
      <span class="grow" style="font-size:.81rem;font-weight:500">${esc(d.authorName)}${mine ? '（你）' : ''}</span>
    </div>

    <div class="stack" style="margin-top:14px;gap:12px">
      ${d.entries.length
        ? d.entries.map((e) => entryBlock(e)).join('')
        : '<div class="small">這天沒有公開內容，只有一盞燈。</div>'}
    </div>

    ${d.replies.length ? `<div class="stack" style="margin-top:16px;gap:8px">
      ${d.replies.map((r) => `<div class="post-reply"><b>${esc(r.name || '無名')}</b>　${esc(r.body)}</div>`).join('')}
    </div>` : ''}

    <div class="post-acts" style="margin-top:18px">
      ${mine ? '' : `
        <button class="btn chip ${d.joinedByMe ? 'on' : ''}" data-joy data-on="${d.joinedByMe ? '1' : '0'}">
          <span data-count>隨喜 ${d.joyCount}</span>
        </button>
        <button class="btn chip" data-reply>說一句</button>`}
      ${mine && d.joyCount ? `<span class="small">${d.joyCount} 人隨喜了這盞燈</span>` : ''}
    </div>
  `, (el) => {
    el.querySelector('[data-joy]')?.addEventListener('click', (e) => onJoy(e.currentTarget, d, root, go));
    el.querySelector('[data-reply]')?.addEventListener('click', () => openReply(d, root, go));
  });
}

function lampHead(l, dateText) {
  return `
    <div class="center">
      ${renderLamp(l, { size: 110 })}
      <h2 style="margin-top:6px;font-size:1.3rem;color:var(--cinnabar-d)">${esc(l.name)}</h2>
      <div class="tags" style="margin-top:10px">
        <span class="tag rare">${TIER_LABEL[l.tier]}</span>
        <span class="tag info">${FLAMES[l.flame]?.name} · ${BOWLS[l.bowl]?.name}</span>
      </div>
      <div class="tiny" style="margin-top:12px">${esc(dateText)}</div>
    </div>
  `;
}

function entryBlock(e) {
  const label = S.KINDS[e.kind]?.name || '紀錄';
  return `
    <div>
      <div class="tiny">${esc(label)}${e.pages ? ` · ${e.pages} 頁` : ''}</div>
      <div class="small" style="color:var(--ink);margin-top:3px">${esc(e.text)}</div>
    </div>
  `;
}

async function onJoy(btn, d, root, go) {
  const on = btn.dataset.on === '1';
  btn.disabled = true;
  try {
    const now = await SB.toggleJoy(d.id, !on);
    btn.dataset.on = now ? '1' : '0';
    btn.classList.toggle('on', now);
    const label = btn.querySelector('[data-count]');
    const n = Number(label.textContent.replace(/\D/g, '')) + (now ? 1 : -1);
    label.textContent = `隨喜 ${Math.max(0, n)}`;

    // 隨喜不佔你今天那 3 則的額度 —— 那 3 則是你寫下來的，這是你給出去的。
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
      } catch (e) {
        toast(e.message || '送不出去');
      }
    });
  });
}

/* ── 我的全部 ── */

function openAll() {
  const list = S.lamps().slice().reverse();
  sheet(`
    <h2>全部的燈 · ${list.length} 盞</h2>
    <div style="margin-top:16px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px">
      ${list.map((d) => `
        <button data-mine="${esc(d.date)}" style="border:none;background:none;padding:6px 2px;border-radius:var(--r-s);min-height:44px">
          ${renderLamp(d.lamp, { size: 44 })}
          <span class="tiny" style="display:block;margin-top:2px">${esc(d.date.slice(5).replace('-', '/'))}</span>
        </button>`).join('')}
    </div>
  `, (el) => {
    el.querySelectorAll('[data-mine]').forEach((b) => {
      b.addEventListener('click', () => openMine(b.dataset.mine));
    });
  });
}
