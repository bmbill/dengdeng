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
import { renderLamp, renderSpark, glowOf } from '../lamp.js';
import { stageClasses, sceneryHTML, nextMilestone, sceneOf, SKY_STAGES, LIFE_STAGES } from '../sky.js';
import { SKY_SIZE, SKY_RENDER_CAP, isOnlineMode } from '../config.js';

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
  const next = nextMilestone(list.length);
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

    <div class="sea ${stageClasses({ filled: list.length })}">
      ${sceneryHTML({ filled: list.length })}
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
  const prev = [...SKY_STAGES, ...LIFE_STAGES]
    .filter((m) => m.at <= count && m.at < next.at).pop();
  const from = prev ? prev.at : 0;
  const pct = Math.round(((count - from) / (next.at - from)) * 100);
  return `
    <section class="card tight">
      <div class="row">
        <span style="flex-shrink:0;width:52px;height:52px;border-radius:17px;background:var(--paper-2);display:flex;align-items:center;justify-content:center">
          ${renderLamp({ form: 'pagoda', bowl: 'cinnabar', flame: 'gamboge' }, { size: 30, lit: false })}
        </span>
        <span class="grow">
          <span style="display:block;font-size:.81rem;font-weight:500">再 ${next.left} 盞，${esc(next.label)}</span>
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

  // 這個群一共供過幾盞。一片上限就是 108，所以只看「這一片」的話
  // 49 以上幾乎沒東西可長——景要分兩層，這是另外那一層。
  const reached = (info.skyNo - 1) * info.size + info.filled;
  const scene = sceneOf(info.skyNo);
  const spots = layoutOf(lamps.map((l) => ({
    key: l.id, lamp: l.lamp, id: l.id, joined: l.joinedByMe, joys: l.joyCount,
  })), { avoidMoon: info.filled >= 108 });

  body.innerHTML = `
    <div class="sky-nav">
      <button class="btn chip" data-prev aria-label="上一片天空" ${hasPrev ? '' : 'disabled'}>◀</button>
      <div class="grow center">
        <div class="serif" style="font-size:.94rem;font-weight:600">第 ${info.skyNo} 片 · ${scene.name}</div>
        <div class="tiny" style="margin-top:2px">${skyDates(info)}</div>
      </div>
      <button class="btn chip" data-next aria-label="下一片天空" ${isNow ? 'disabled' : ''}>▶</button>
    </div>

    <div class="sea ${stageClasses({ filled: info.filled, reached, skyNo: info.skyNo })}">
      ${sceneryHTML({ filled: info.filled, reached, skyNo: info.skyNo })}
      ${shown && scene.key === 'lake' ? `<div class="sky-reflect" aria-hidden="true">${reflect(spots)}</div>` : ''}
      ${shown
        ? paint(spots)
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

/**
 * 算出每一盞的位置。
 * 跟畫分開，是因為分享圖卡要用同一組座標——兩邊各算一次就會長不一樣。
 */
export function layoutOf(items, opts = {}) {
  const shown = items.slice(-SKY_RENDER_CAP);

  if (shown.length <= 2) {
    return shown.map((it, i) => ({
      it, x: shown.length === 1 ? 50 : 36 + i * 28, y: 36, glow: glowOf(it.joys), seed: 0,
    }));
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
    .sort((a, b) => a.glow - b.glow);
}

/** 算好的位置畫成 DOM。 */
export function paint(spots) {
  return spots.map(({ it, x, y, glow, seed }) => place(it, x, y, glow, seed)).join('');
}

/**
 * 水裡的倒影。
 *
 * 不是照鏡子——真的照鏡子的話，天上那盞燈的倒影會落到畫面外。
 * 水面的倒影是壓扁的（CSS 那邊 scaleY(-.45)），所以這裡照原位置畫，
 * 壓扁交給容器。點不到，也不進無障礙樹。
 */
export function reflect(spots) {
  return spots.map(({ it, x, y, glow, seed }) =>
    `<span class="sea-lamp" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;${windVars(seed)}">${renderSpark(it.lamp, { common: 7, uncommon: 9, rare: 12 }[it.lamp.tier] || 7, glow)}</span>`
  ).join('');
}

export function scatter(items, opts = {}) {
  return paint(layoutOf(items, opts));
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
