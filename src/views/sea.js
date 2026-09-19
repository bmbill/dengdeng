/* 燈海
 *
 * 兩種看法，同一份資料：
 *   我的   — 自己供過的所有燈
 *   大家的 — 共同燈海。一片天空 = 幾天，可以一片一片往回翻。
 *            點一盞燈就看得到那天的善行，可以隨喜。
 */

import * as S from '../store.js';
import * as SB from '../supabase.js';
import { esc, icon, sheet, closeSheet, toast } from '../ui.js';
import { showMyDay, showSharedLamp } from './lampcard.js';
import { renderLamp, renderSpark, glowOf, TIER_LABEL, BOWLS, FLAMES } from '../lamp.js';
import { SKY_SIZE, SKY_RENDER_CAP, isOnlineMode } from '../config.js';

/* ── 里程碑 ──
 *
 * 每一個都要真的讓畫面出現東西。
 * 本來只是幾行字（「再 6 盞，燈海起了風」），但 7 盞到了什麼也沒發生——
 * 那等於 app 在承諾一件它不做的事。
 *
 * 現在每一階都對應夜空裡的一樣東西，文案寫的就是你會看到的。 */

const MILESTONES = [
  { at: 7,   cls: 'windy', label: '燈會開始隨風飄' },
  { at: 21,  cls: 'reeds', label: '岸邊長出草，偶爾有人走過' },
  { at: 49,  cls: 'pagoda', label: '遠處浮起一座塔，塔上偶爾亮燈' },
  { at: 108, cls: 'moon',  label: '天上出現月亮' },
  { at: 365, cls: 'stars', label: '滿天都是星' },
];

/** 已經到達的階段，變成夜空的 class。 */
export function stageClasses(count) {
  return MILESTONES.filter((m) => count >= m.at).map((m) => m.cls).join(' ');
}

/** 夜空裡那些「長出來」的東西。 */
export function scenery(count) {
  const has = (at) => count >= at;
  return `
    ${has(108) ? moon() : ''}
    ${has(365) ? starField() : ''}
    ${has(49) ? `<svg class="sky-pagoda" viewBox="0 0 80 96" fill="none" aria-hidden="true">
      <path d="M40 4l20 12H20z"/><path d="M26 16h28v10H26z"/>
      <path d="M40 26l24 12H16z"/><path d="M24 38h32v12H24z"/>
      <path d="M40 50l28 14H12z"/><path d="M22 64h36v22H22z"/>
      <path d="M8 86h64v10H8z"/>
      <rect class="tower-lamp a" x="35" y="69" width="10" height="11" rx="1.4"/>
      <rect class="tower-lamp b" x="36" y="41" width="8" height="7" rx="1.2"/>
    </svg>` : ''}
    ${has(21) ? walker() + reeds() : ''}
  `;
}

/**
 * 月亮，而且跟外面真的月亮同一個月相。
 *
 * 關鍵是：暗面不畫。
 * 本來用「天空色的實心陰影」去切，等於在天空上蓋一塊不透明的深色圓，
 * 所以暗的那半看得見，而且會擋住後面的燈。
 * 現在用遮罩只畫亮的部分，其餘完全透明。
 */
function moonPhase(date = new Date()) {
  const ref = Date.UTC(2000, 0, 6, 18, 14);        // 一個已知的朔
  const syn = 29.530588853 * 86400000;             // 朔望月
  let p = ((date.getTime() - ref) % syn) / syn;
  if (p < 0) p += 1;
  return p;                                        // 0 是朔、0.5 是望
}

let moonSeq = 0;

function moon() {
  const p = moonPhase();
  const cosT = Math.cos(2 * Math.PI * p);
  // 亮的比例。全黑的朔留一點點，不然「天上出現月亮」會看不到東西。
  const k = Math.max(0.055, (1 - cosT) / 2);
  const waxing = p < 0.5;                          // 上弦：北半球亮在右邊
  const gibbous = k > 0.5;
  const rx = (Math.abs(cosT) * 20).toFixed(2);
  const id = `mn${++moonSeq}`;

  // 亮的那半圓：上弦走右邊（sweep 1），下弦走左邊（sweep 0）
  const half = `M20 0A20 20 0 0 ${waxing ? 1 : 0} 20 40Z`;

  return `<span class="sky-moon">
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <mask id="${id}">
        <rect width="40" height="40" fill="#000"/>
        <path d="${half}" fill="#fff"/>
        <ellipse cx="20" cy="20" rx="${rx}" ry="20" fill="${gibbous ? '#fff' : '#000'}"/>
      </mask>
      <circle cx="20" cy="20" r="20" fill="#E8E2D2" mask="url(#${id})"/>
    </svg>
  </span>`;
}

function starField() {
  return [...Array(26)].map((_, i) => {
    const x = (8 + 84 * ((i * 0.7548776662) % 1)).toFixed(1);
    const y = (6 + 56 * ((i * 0.5698402909) % 1)).toFixed(1);
    const s = (0.8 + (i % 3) * 0.5).toFixed(1);
    return `<span class="sky-star" style="left:${x}%;top:${y}%;width:${s}px;height:${s}px;animation-delay:${(i % 7) * 0.6}s"></span>`;
  }).join('');
}

/**
 * 岸邊的草。
 *
 * 本來是一根根細線條，在深色天空上看起來像刮痕，不像植物——
 * 旁邊的塔是實心剪影，一比就輸了。同一張圖裡不該有兩種畫法。
 *
 * 改成剪影，而且分遠近兩層：遠的矮、淺、密，近的高、深、疏。
 * 只有一層會很平，看起來像貼上去的貼紙。
 */
function grassLayer(count, maxH, salt, cls) {
  const W = 320;
  const step = W / count;
  let d = `M0 40`;

  for (let i = 0; i < count; i++) {
    const x = i * step;
    // 瘦而高才像草。寬而尖會變成松林。
    const w = step * (0.42 + ((i * 7 + salt) % 5) * 0.09);
    const h = maxH * (0.5 + ((i * 13 + salt) % 9) / 11);
    const lean = (((i * 5 + salt) % 7) - 3) * (w * 0.55);
    const tip = x + w / 2 + lean;

    // 兩側各自彎，葉子才不會左右對稱得像三角形
    d += ` L${x.toFixed(1)} 40`
       + ` Q${(x + w * 0.1 + lean * 0.4).toFixed(1)} ${(40 - h * 0.55).toFixed(1)} ${tip.toFixed(1)} ${(40 - h).toFixed(1)}`
       + ` Q${(x + w * 0.9 + lean * 0.4).toFixed(1)} ${(40 - h * 0.45).toFixed(1)} ${(x + w).toFixed(1)} 40`;
  }

  return `<path class="${cls}" d="${d} L${W} 40 Z"/>`;
}

/**
 * 偶爾有人走過。
 *
 * 一趟走完大約 35 秒，但整個循環是 4 分鐘——所以多數時候畫面上沒有人，
 * 你偶爾抬頭才會看到有個影子在走。常常出現就不稀奇了。
 *
 * 放在草前面（z-index 2），因為它走的是近岸；藏在草後面只會看到一顆頭。
 */
function walker() {
  return `<span class="sky-walker" aria-hidden="true">
    <svg viewBox="0 0 16 26" fill="none">
      <circle cx="8" cy="4.2" r="3.2"/>
      <path d="M8 7.6c-2.8 0-4.4 2.2-4.9 7L2 24h12l-1.1-9.4c-.5-4.8-2.1-7-4.9-7z"/>
    </svg>
  </span>`;
}

function reeds() {
  return `<svg class="sky-reeds" viewBox="0 0 320 40" preserveAspectRatio="none" fill="none" aria-hidden="true">
    ${grassLayer(40, 24, 0, 'grass-far')}
    ${grassLayer(26, 37, 4, 'grass-near')}
  </svg>`;
}

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

    <div class="sea ${stageClasses(list.length)}">
      ${scenery(list.length)}
      ${list.length
        ? scatter(list.map((d) => ({ key: d.date, lamp: d.lamp, mineDate: d.date })), { avoidMoon: list.length >= 108 })
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

  startWind();

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
      <div class="card-title">最近供的</div>
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

    <div class="sea ${stageClasses(info.filled)}">
      ${scenery(info.filled)}
      ${shown
        ? scatter(lamps.map((l) => ({
            key: l.id, lamp: l.lamp, id: l.id, joined: l.joinedByMe, joys: l.joyCount,
          })), { avoidMoon: info.filled >= 108 })
        : `<div class="empty" style="color:var(--night-muted);position:relative;z-index:2">這片天空還沒有燈</div>`}
      ${shown ? `<div class="sea-foot">
        <div class="grow">
          <div class="t">${info.isFull ? `這片天空滿了 · ${info.filled} 盞` : `這片天空 ${info.filled} 盞`}</div>
          <div class="s">${info.authors} 個人${info.pages ? ` · 誦經 ${info.pages} 頁` : ''}${info.filled > shown ? ` · 畫出其中 ${shown} 盞` : ''}</div>
        </div>
      </div>` : ''}
    </div>

    ${shown ? `<div class="small center">
      點一盞燈，看看那天發生了什麼${lamps.some((l) => l.joinedByMe) ? '<br>旁邊有星星的，是你隨喜過的' : ''}
    </div>` : ''}
    ${isNow ? fillingCard(info) : sealedCard(info)}
  `;

  startWind();

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

export function scatter(items, opts = {}) {
  const shown = items.slice(-SKY_RENDER_CAP);

  if (shown.length <= 2) {
    return shown.map((it, i) => place(it, shown.length === 1 ? 50 : 36 + i * 28, 36)).join('');
  }

  // 亮的燈最後畫，才會疊在上面。
  return shown
    .map((it, i) => {
      const seed = hashStr(it.key);
      const n = i + 1;
      // 小幅抖動，把序列殘留的規律再打散一點
      // 抖動要夠大。R2 序列本身鋪得很勻，但連續的點會排成格子，
      // 一百多盞的時候會看到斜向的條紋。
      const jx = ((seed % 1000) / 1000 - 0.5) * 11;
      const jy = (((seed >>> 10) % 1000) / 1000 - 0.5) * 10;
      let x = 8 + 84 * ((0.5 + n * R2_X) % 1) + jx;
      // 上限壓在地平線以上：草是前景，燈是天上的，掉到草裡就不對了
      let y = 10 + 50 * ((0.5 + n * R2_Y) % 1) + jy;
      if (opts.avoidMoon) ({ x, y } = clearOfMoon(x, y, seed));
      return { it, x, y, glow: glowOf(it.joys), seed };
    })
    .sort((a, b) => a.glow - b.glow)
    .map(({ it, x, y, glow, seed }) => place(it, x, y, glow, seed))
    .join('');
}

/** 天空上的每一盞燈都可以點——不管是自己的還是別人的。 */
/**
 * 月亮周圍留白。
 * 不然一堆燈疊在月亮上，月亮就只是一塊被蓋住的淺色。
 * 落在範圍內的燈往外推到邊上，不是重抽——重抽會讓分布出現一個空洞。
 */
const MOON = { x: 17, y: 18, rx: 12.5, ry: 11.5 };

function clearOfMoon(x, y, seed) {
  const dx = (x - MOON.x) / MOON.rx;
  const dy = (y - MOON.y) / MOON.ry;
  const d = Math.hypot(dx, dy);
  if (d >= 1 || d === 0) return { x, y };

  // 推到邊上再多推一點點，不然所有被推開的燈會沿著邊排成一圈
  const push = 1 + ((seed >>> 20) % 100) / 220;
  return {
    x: MOON.x + (dx / d) * MOON.rx * push,
    y: MOON.y + (dy / d) * MOON.ry * push,
  };
}

function place(it, x, y, glow = 0, seed = 0) {
  const px = { common: 7, uncommon: 9, rare: 12 }[it.lamp.tier] || 7;
  const pos = `left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;${windVars(seed)}`;
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

  // 隨喜過的燈旁邊放一顆星 —— app 裡每個隨喜按鈕用的都是這顆，
  // 所以它已經代表「隨喜」，不用另外學。
  // 本來是畫一圈硬邊圓框，在一片柔光裡看起來像 UI 元件，不像那個世界的東西。
  const mark = it.joined ? `<span class="joined-mark">${icon.joy('#FBF2E2', true)}</span>` : '';

  return `<button class="sea-lamp" style="${pos}"
            data-lamp-id="${esc(it.id)}" title="${label}" aria-label="${label}">${spark}${mark}</button>`;
}

/* ── 風向會轉 ──
 *
 * 每盞燈的擺動路徑是固定的，但整片天空共用一個「主風向」--wind
 * （-1 往左、1 往右）和一個「風力」--windm。這兩個值慢慢變，
 * 所有燈就會一起轉向、一起變強變弱——那才是風，
 * 不然每盞各擺各的，看起來只是一堆東西在抖。
 *
 * 只在畫面上真的有夜空、而且分頁在前景時才跑；
 * 使用者關掉動態效果就完全不啟動。
 */
let windTimer = null;

function stopWind() {
  clearInterval(windTimer);
  windTimer = null;
}

export function startWind() {
  stopWind();
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let from = 1;
  let to = -0.55;
  let t = 0;
  let dur = 24;

  windTimer = setInterval(() => {
    const skies = document.querySelectorAll('.sea.windy');
    if (!skies.length) return stopWind();   // 離開燈海就別再算了
    if (document.hidden) return;

    t += 0.25;
    if (t >= dur) {
      from = to;
      // 下一陣風：有時大轉向，有時只是微調，偶爾幾乎停下來
      const calm = Math.random() < 0.22;
      to = calm
        ? (Math.random() * 0.3 - 0.15)
        : (Math.random() * 2 - 1) * (0.45 + Math.random() * 0.55);
      t = 0;
      dur = 16 + Math.random() * 44;        // 16~60 秒轉完一次
    }

    const k = t / dur;
    const ease = k < 0.5 ? 2 * k * k : 1 - ((-2 * k + 2) ** 2) / 2;
    const w = from + (to - from) * ease;

    skies.forEach((el) => {
      el.style.setProperty('--wind', w.toFixed(3));
      // 上下的浮動不跟著左右翻面，只跟著風力大小
      el.style.setProperty('--windm', (0.35 + Math.abs(w) * 0.65).toFixed(3));
    });
  }, 250);
}

/**
 * 每一盞燈自己的風。
 *
 * 本來所有燈跑同一條 keyframes，只有速度不同——看起來像機械擺動，
 * 不像風。真正的風是：有一個主風向（這裡往右），但每一盞的幅度、
 * 相位、節奏都不一樣，而且來回不對稱（被吹走得快，飄回來得慢）。
 */
function windVars(seed) {
  const h = seed >>> 0;
  // 一律用無號位移 >>>。JS 的 >> 是有號的：h 雖然是正的，
  // h >> 8 會先當成有號 32 位元，最高位是 1 就變負數，
  // 而負數取餘數在 JS 裡結果也是負的 —— 於是會算出
  // 負的動畫時間（直接失效）、正的 delay、方向相反的位移。
  const amp = 3 + (h % 9);                        // 幅度 3~11px
  const sway = 0.45 + ((h >>> 4) % 6) / 10;       // 上下相對幅度
  const dur = 8 + ((h >>> 8) % 11);               // 8~18 秒，快慢差很多才像陣風
  const delay = -((h >>> 13) % 17);               // 錯開起點，不然會一起擺
  const back = 0.25 + ((h >>> 17) % 4) / 10;      // 回擺的深淺

  // 主風向往右：三個時間點都偏正，只是多寡不同
  return [
    `--w1x:${(amp).toFixed(1)}px`,
    `--w1y:${(-amp * sway * 0.7).toFixed(1)}px`,
    `--w2x:${(amp * 0.55).toFixed(1)}px`,
    `--w2y:${(amp * sway).toFixed(1)}px`,
    `--w3x:${(-amp * back).toFixed(1)}px`,
    `--w3y:${(-amp * sway * 0.4).toFixed(1)}px`,
    `--wdur:${dur}s`,
    `--wdelay:${delay}s`,
  ].join(';');
}

/**
 * 字串雜湊。
 *
 * 一定要用會「雪崩」的混合（imul + 位移 + 互斥或），
 * 不能用 h = h * 31 + c 那種簡單累加：連續的日期會算出連續的值，
 * 拿去當抖動就變成一條平滑的斜坡，完全打散不了格紋——
 * 一百多盞的時候整片會出現斜向條紋。
 */
function hashStr(str) {
  let h = 2166136261 ^ String(str).length;
  for (let i = 0; i < String(str).length; i++) {
    h = Math.imul(h ^ String(str).charCodeAt(i), 16777619);
    h = (h << 13) | (h >>> 19);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return h >>> 0;
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
