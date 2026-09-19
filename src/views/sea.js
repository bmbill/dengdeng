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
import { showMyDay, showSharedLamp } from './lampcard.js';
import { renderLamp, renderSpark, glowOf, TIER_LABEL, BOWLS, FLAMES } from '../lamp.js';
import { SKY_SIZE, SKY_RENDER_CAP, isOnlineMode } from '../config.js';

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
  mode: 'mine',   // 'mine' | 'group'
  groupId: null,
  skyBack: 0,     // 0 = 現在這片天空，1 = 上一片，依此類推
};

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
        <h1 class="plain">璀璨燈海</h1>
        <div class="sub" data-sub></div>
      </div>
    </header>
    ${canGroup ? segmented(groups) : ''}
    <div class="view" data-body></div>
  `;

  root.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
    view.mode = b.dataset.mode;
    view.skyBack = 0;
    render(root, go);
  }));

  root.querySelector('[data-group]')?.addEventListener('change', (e) => {
    view.groupId = e.target.value;
    view.skyBack = 0;
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

  const [lamps, info] = await Promise.all([
    SB.groupSky(groupId, view.skyBack, SKY_SIZE),
    SB.groupSkyInfo(groupId, view.skyBack, SKY_SIZE),
  ]);

  if (lamps === null || !info) {
    body.innerHTML = `<div class="empty">連不上伺服器。<br>你自己的燈還是好好地在「我的」裡面。</div>`;
    return;
  }

  const shown = lamps.length;
  const isNow = view.skyBack === 0;
  const hasPrev = view.skyBack + 1 < info.totalSkies;

  body.innerHTML = `
    <div class="sky-nav">
      <button class="btn chip" data-prev aria-label="上一片天空" ${hasPrev ? '' : 'disabled'}>◀</button>
      <div class="grow center">
        <div class="serif" style="font-size:.94rem;font-weight:600">第 ${info.skyNo} 片天空</div>
        <div class="tiny" style="margin-top:2px">${skyDates(info)}</div>
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
          <div class="t">${info.isFull ? `這片天空滿了 · ${info.filled} 盞` : `這片天空 ${info.filled} 盞`}</div>
          <div class="s">${info.authors} 個人${info.pages ? ` · 誦經 ${info.pages} 頁` : ''}${info.filled > shown ? ` · 畫出其中 ${shown} 盞` : ''}</div>
        </div>
      </div>` : ''}
    </div>

    ${shown ? `<div class="small center">
      點一盞燈，看看那天發生了什麼${lamps.some((l) => l.joinedByMe) ? '<br>外面有圈的，是你隨喜過的' : ''}
    </div>` : ''}
    ${isNow ? fillingCard(info) : sealedCard(info)}
  `;

  body.querySelectorAll('[data-lamp-id]').forEach((b) => {
    b.addEventListener('click', () => openShared(b.dataset.lampId, root, go));
  });

  body.querySelector('[data-prev]').addEventListener('click', () => {
    if (!hasPrev) return toast('再往前就沒有天空了');
    view.skyBack += 1;
    render(root, go);
  });

  body.querySelector('[data-next]').addEventListener('click', () => {
    if (isNow) return;
    view.skyBack -= 1;
    render(root, go);
  });
}

/** 這片天空涵蓋哪幾天。數量制切出來的，所以日期是結果不是條件。 */
function skyDates(info) {
  if (!info.fromDay) return '還沒有燈';
  const a = S.prettyDate(info.fromDay).split(' ·')[0];
  if (info.fromDay === info.toDay) return a;
  const b = S.prettyDate(info.toDay).split(' ·')[0];
  const ma = (a.match(/^(.+月)/) || [])[1];
  const mb = (b.match(/^(.+月)/) || [])[1];
  // 同一個月就不重複月份
  return ma && ma === mb ? `${a}–${b.slice(ma.length)}` : `${a} – ${b}`;
}

/** 現在這片：還在填。這是全群共同的進度，不是誰跟誰比。 */
function fillingCard(info) {
  const left = Math.max(0, info.size - info.filled);
  const pct = Math.round((info.filled / info.size) * 100);
  return `
    <section class="card tight" style="background:var(--night-2)">
      <div class="row" style="align-items:baseline;gap:8px">
        <div class="grow" style="font-size:.81rem;font-weight:500;color:var(--night-ink)">這片天空</div>
        <div class="serif" style="font-size:1.12rem;font-weight:700;color:#F2C877">${info.filled}</div>
        <div style="font-size:.72rem;color:var(--night-muted)">/ ${info.size} 盞</div>
      </div>
      <div class="bar on-night" style="margin-top:11px"><i style="width:${pct}%"></i></div>
      <div style="margin-top:10px;font-size:.72rem;color:var(--night-muted);line-height:1.7">
        ${left ? `再 ${left} 盞就滿了，滿了會自動收起來，換新的一片` : '滿了，下一盞會開新的一片'}
        <br>${info.authors} 個人 · ${info.entries} 則紀錄${info.pages ? ` · ${info.pages} 頁經` : ''} · 只記總數，不排名次
      </div>
    </section>
  `;
}

/** 翻回去看的舊天空：已經封存。 */
function sealedCard(info) {
  return `
    <section class="card tight">
      <div class="row" style="align-items:baseline;gap:8px">
        <div class="grow" style="font-size:.81rem;font-weight:500">第 ${info.skyNo} 片天空 · 共 ${info.totalSkies} 片</div>
        <div class="serif" style="font-size:1.12rem;font-weight:700;color:var(--cinnabar-d)">${info.filled}</div>
        <div class="tiny">盞</div>
      </div>
      <div class="small" style="margin-top:10px">
        ${info.authors} 個人 · ${info.entries} 則紀錄${info.pages ? ` · ${info.pages} 頁經` : ''}
      </div>
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
  const label = [
    '看這盞燈',
    it.joys ? `${it.joys} 人隨喜` : '',
    it.joined ? '你隨喜過' : '',
  ].filter(Boolean).join('，');

  return `<button class="sea-lamp${it.joined ? ' joined' : ''}" style="${pos}"
            data-lamp-id="${esc(it.id)}" title="${label}" aria-label="${label}">${spark}</button>`;
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) >>> 0;
  return h;
}

/* ══════════════════ 點開一盞燈 ══════════════════ */
// 小卡的長相統一放在 lampcard.js：重點是善行，不是燈。

function openMine(date) {
  showMyDay(date);
}

function openShared(lampId, root, go) {
  showSharedLamp(lampId);
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
