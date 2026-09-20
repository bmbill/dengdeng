/* 今日 —— 隨手寫一則
 *
 * 門檻刻意壓到最低：一則短短的燈就亮了（只是隨喜了別人也算）。
 * 上限 3 則。不是限制你，是為了讓「一則」還是一件事——
 * 可以無限寫的話，寫下來這個動作就不值錢了。
 *
 * 沒有「供燈」按鈕：寫下去燈就亮了，寫一句馬上看得到結果。
 * 之後補寫一則就多一次「再抽一次」的機會，而且只往上換。
 */

import * as S from '../store.js';
import * as SB from '../supabase.js';
import { esc, icon, sheet, closeSheet, toast } from '../ui.js';
import { renderLamp } from '../lamp.js';
import { showReveal } from './reveal.js';
import { showMyDay } from './lampcard.js';
import { DEFAULT_SUTRA, MAX_ENTRIES_PER_DAY, isOnlineMode } from '../config.js';

const KIND_STYLE = {
  deed:      { cls: 'deed',  ic: 'deed' },
  gratitude: { cls: 'joy',   ic: 'joy' },
  sutra:     { cls: 'sutra', ic: 'sutra' },
  note:      { cls: 'note',  ic: 'note' },
};

export function render(root, go) {
  const date = S.todayStr();
  const day = S.getDay(date);
  const c = S.countsOf(day);
  const left = S.entriesLeft(day);
  const me = S.me();
  const now = new Date();

  root.innerHTML = `
    <header class="hd">
      <div class="hd-grow">
        <h1>燈燈悅心</h1>
        <div class="sub">${S.prettyDate(date)}</div>
      </div>
      <div class="avatar">${esc(me.avatarChar || '燈')}</div>
    </header>

    <div class="view">
      ${c.total || c.joys ? entriesCard(day, c) : ''}
      ${day.sealedAt ? sealedCard(day) : ''}
      ${actionsCard(day, c, left)}

      ${monthCard(now)}
    </div>
  `;

  root.querySelectorAll('[data-write]').forEach((b) => {
    b.addEventListener('click', () => openWrite(b.dataset.write, go));
  });

  root.querySelectorAll('[data-del]').forEach((b) => {
    b.addEventListener('click', () => {
      // 移掉最後一則會讓燈跟著收掉，群裡那盞也要跟著收回。
      const before = S.getDay();
      const after = S.removeEntry(b.dataset.del);
      if (before.isPublic && isOnlineMode()) {
        (after.lamp
          ? SB.publishLamp(after, S.shareTargets())
          // 燈收掉了，群裡那盞也要收回。帶 before 的燈只是為了讓 RPC 認得這一天，
          // 送出去的內容是 after —— 不然剛移掉的那則會再被寫回去一次。
          : SB.unpublishLamp({ ...after, lamp: before.lamp })).catch(() => {});
      }
      go('today');
    });
  });

  root.querySelector('[data-redraw]')?.addEventListener('click', () => doRedraw(go));
  root.querySelector('[data-share-to]')?.addEventListener('click', () => openShare(go));

  root.querySelector('[data-show-lamp]')?.addEventListener('click', () => {
    showReveal(S.getDay(date), () => go('today'));
  });

  root.querySelectorAll('[data-day]').forEach((b) => {
    b.addEventListener('click', () => showMyDay(b.dataset.day));
  });
}

/* ── 片段 ── */

function entriesCard(day, c) {
  return `
    <section class="card">
      <div class="row" style="align-items:baseline;gap:7px">
        <div class="grow card-title">今天</div>
        <div class="serif" style="font-size:1.25rem;font-weight:700;color:var(--cinnabar-d)">${c.total}</div>
        <div class="tiny">/ ${MAX_ENTRIES_PER_DAY} 則${c.pages ? ` · ${c.pages} 頁` : ''}</div>
      </div>

      <div class="segbar" style="margin-top:13px">
        ${Array.from({ length: MAX_ENTRIES_PER_DAY }, (_, i) =>
          `<i class="${i < c.total ? 'on' : ''}"></i>`).join('')}
      </div>

      <div class="stack" style="margin-top:16px;gap:12px">
        ${day.entries.map((e) => entryRow(e)).join('')}
        ${c.joys ? joyRow(day, c) : ''}
      </div>
    </section>
  `;
}

/* 燈亮著也還是可以移。打錯字不該變成今天的紀錄——
 * 移掉之後顏色會重算，移到一則不剩燈才收掉。 */
function entryRow(e) {
  const st = KIND_STYLE[e.kind] || KIND_STYLE.deed;
  const label = S.KINDS[e.kind]?.short || '善行';
  return `
    <div class="task">
      <span class="task-icon ${st.cls}">${icon[st.ic]()}</span>
      <span class="grow">
        <span class="task-name" style="display:block">${label}${e.pages ? ` · ${e.pages} 頁` : ''}</span>
        <span class="task-val" style="display:block">${esc(e.text)}</span>
      </span>
      <button class="btn chip" data-del="${e.id}" aria-label="移除這則">移除</button>
    </div>
  `;
}

/** 隨喜單獨一列。要講清楚它不算在那 3 則裡，不然會以為自己寫超過了。 */
function joyRow(day, c) {
  const names = [...new Set(day.joys.map((j) => j.authorName).filter(Boolean))];
  return `
    <div class="task">
      <span class="task-icon joy">${icon.joy('#B4842A', true)}</span>
      <span class="grow">
        <span class="task-name" style="display:block">隨喜 ${c.joys} 盞</span>
        <span class="task-val truncate" style="display:block">${names.length ? esc(names.join('、')) : '大家的燈'}</span>
      </span>
      <span class="tiny">不算在 3 則裡</span>
    </div>
  `;
}

/**
 * 動作卡。
 *
 * 本來這裡的主角是「供今天的燈」。拿掉了：那個按鈕讓人想「再多寫幾則
 * 一次供比較划算」，於是一直不按，然後忘記，隔天被系統補供——
 * 最該屬於你的那一下反而是系統按的。
 *
 * 現在寫下去燈就亮了，這張卡的主角變成「再抽一次」：
 * 補寫一則就多一次機會，而且只往上，晚點寫不會虧。
 */
function actionsCard(day, c, left) {
  const kinds = [
    ['deed', '善行點滴'],
    ['gratitude', '觀功念恩'],
    ['sutra', '誦經'],
    ['note', '其他'],
  ];

  const chips = `
    <div class="row" style="gap:8px;flex-wrap:wrap">
      ${kinds.map(([k, name]) => `<button class="btn chip" data-write="${k}">${name}</button>`).join('')}
    </div>`;

  // 今天還什麼都沒有：燈還沒亮，這張卡只講一件事——寫一句。
  if (!day.lamp) {
    return `
      <section class="card">
        <div class="card-title">今天還沒寫</div>
        <p class="small" style="margin-top:7px">
          一則短短的就好。看到什麼、做了什麼、想到誰的好——寫一句，今天的燈就亮了。
        </p>
        <div style="margin-top:14px">${chips}</div>
      </section>
    `;
  }

  const draws = S.drawsLeft(day);
  if (draws === 0 && left === 0) {
    return `<div class="small center" style="padding:2px 10px">今天三則都寫了，三次也抽完了。</div>`;
  }

  const nudge = draws > 0
    ? '只會往上：抽到比較難得的才換，抽到普通的就留著現在這盞。'
    : '再寫一則，就多一次抽的機會。不寫也沒關係，燈已經亮著了。';

  return `
    <section class="card">
      ${draws > 0 ? `
        <button class="btn btn-full" data-redraw>再抽一次${draws > 1 ? ` · 還有 ${draws} 次` : ''}</button>
        <div class="small" style="margin-top:10px">${nudge}</div>
      ` : `
        <div class="card-title">還想寫什麼</div>
        <p class="small" style="margin-top:7px">${nudge}</p>
      `}

      ${left > 0 ? `
        <div style="margin-top:${draws > 0 ? '18px' : '14px'};${draws > 0 ? 'padding-top:16px;border-top:1px solid var(--line);' : ''}">
          ${draws > 0 ? '<div class="tiny" style="margin-bottom:10px">還想寫的話</div>' : ''}
          ${chips}
        </div>` : ''}
    </section>
  `;
}

/** 今天那盞燈。底下那行講它亮在哪裡，按了可以改。 */
function sealedCard(day) {
  const groups = S.myGroups();
  const shown = day.isPublic ? groups.filter((g) => S.shareTargets().includes(g.id)) : [];

  const where = !isOnlineMode() || groups.length === 0
    ? ''
    : shown.length
      ? `亮在 ${esc(shown.map((g) => g.name).join('、'))}`
      : '只有你看得到';

  return `
    <section class="card card-note">
      <button data-show-lamp class="row" style="width:100%;text-align:left;border:none;background:none;padding:0;cursor:pointer">
        <span style="flex-shrink:0">${renderLamp(day.lamp, { size: 34 })}</span>
        <span class="grow">
          <span style="display:block;font-size:.81rem;font-weight:500">今天供了「${esc(day.lamp.name)}」</span>
          <span class="small" style="display:block;margin-top:2px">按一下再看一次</span>
        </span>
      </button>

      ${where ? `
        <div class="row" style="margin-top:12px;padding-top:10px;border-top:1px solid #F0E2C6">
          <span class="tiny grow">${where}</span>
          <button class="btn chip" data-share-to>改</button>
        </div>` : ''}
    </section>
  `;
}

/**
 * 真的月曆，不是一排格子。
 *
 * 本來是 10 欄的色塊，沒有日期也沒有星期，寫了一則之後
 * 只有一格亮著，看起來像「亮在最後面」，完全看不出那是幾號。
 * 現在照星期排，標日期，那一天的燈直接畫在格子裡。
 */
function monthCard(now) {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const cells = S.monthGrid(y, m);
  const today = S.todayStr();
  const firstDow = new Date(y, m - 1, 1).getDay();
  const lit = cells.filter((c) => c.lamp).length;

  return `
    <section class="card">
      <div class="row" style="align-items:baseline;gap:8px">
        <div class="grow serif" style="font-size:.88rem;font-weight:600">${m} 月</div>
        <div class="tiny">${lit} 天亮著</div>
      </div>

      <div class="cal" style="margin-top:14px">
        ${['日', '一', '二', '三', '四', '五', '六'].map((d) => `<div class="cal-dow">${d}</div>`).join('')}
        ${Array.from({ length: firstDow }, () => '<div></div>').join('')}
        ${cells.map((c) => calCell(c, today)).join('')}
      </div>

      <div class="small" style="margin-top:13px">中斷不會熄滅，只是那天空著。</div>
    </section>
  `;
}

function calCell(c, today) {
  const d = Number(c.date.slice(8));
  const isToday = c.date === today;

  if (c.lamp) {
    return `<button class="cal-day lit${isToday ? ' today' : ''}" data-day="${esc(c.date)}"
              aria-label="${d} 日 · ${esc(c.lamp.name)}">
      ${renderLamp(c.lamp, { size: 20 })}
      <span>${d}</span>
    </button>`;
  }

  const cls = isToday ? ' today' : (c.date > today ? ' future' : '');
  return `<div class="cal-day${cls}"><span>${d}</span></div>`;
}

/* ── 寫一則 ── */

const PLACEHOLDER = {
  deed: '例：幫鄰居把回收提下樓',
  gratitude: '例：同事默默把茶水間收乾淨了',
  sutra: '例：坐下來誦，誦完反而醒了',
  note: '例：今天想到的一句',
};

const HINT = {
  deed: '再小都算。幫人開個門、忍住一句話，都是。',
  gratitude: '看到誰的好，替他高興一下。不一定要當面說。',
  sutra: '翻幾頁都算。頁數可以留空。',
  note: '想到什麼寫什麼，不用有結論。',
};

function openWrite(kind, go) {
  const day = S.getDay();
  if (S.entriesLeft(day) === 0) return toast(`一天 ${MAX_ENTRIES_PER_DAY} 則，今天寫完了`);

  let current = S.KINDS[kind] ? kind : 'deed';
  const left = S.entriesLeft(day);

  sheet(`
    <div class="row" style="align-items:baseline;gap:8px">
      <h2 class="grow">寫一則</h2>
      <span class="tiny">還可以寫 ${left} 則</span>
    </div>
    <div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap">
      ${Object.entries(S.KINDS).map(([k, v]) =>
        `<button class="btn chip ${k === current ? 'on' : ''}" data-kind="${k}">${v.name}</button>`).join('')}
    </div>
    <p class="small" style="margin-top:12px" data-hint>${HINT[current]}</p>
    <textarea class="field" rows="3" style="margin-top:12px" data-text placeholder="${PLACEHOLDER[current]}"></textarea>

    <div data-pages style="margin-top:12px;${current === 'sutra' ? '' : 'display:none'}">
      <div class="row" style="gap:10px">
        <input class="field grow" value="${esc(day.sutraName || DEFAULT_SUTRA)}" data-sutra-name aria-label="經名">
        <input class="field" type="number" min="0" inputmode="numeric" placeholder="頁" data-page-count
               aria-label="頁數" style="width:88px;text-align:center">
      </div>
    </div>

    <button class="btn btn-full" style="margin-top:16px" data-save>${day.lamp ? '記下來' : '記下來，供今天的燈'}</button>
  `, (el) => {
    const ta = el.querySelector('[data-text]');
    ta.focus();

    el.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => {
      current = b.dataset.kind;
      el.querySelectorAll('[data-kind]').forEach((x) => x.classList.toggle('on', x.dataset.kind === current));
      el.querySelector('[data-hint]').textContent = HINT[current];
      ta.placeholder = PLACEHOLDER[current];
      el.querySelector('[data-pages]').style.display = current === 'sutra' ? '' : 'none';
      ta.focus();
    }));

    el.querySelector('[data-save]').addEventListener('click', () => {
      const text = ta.value.trim();
      if (!text) return toast('一句就好');

      const pages = current === 'sutra'
        ? Number(el.querySelector('[data-page-count]').value) || 0
        : 0;
      if (current === 'sutra') {
        S.setSutraName(el.querySelector('[data-sutra-name]').value);
      }

      const before = S.getDay();
      const res = S.addEntry({ kind: current, text, pages });
      if (!res.ok) {
        return toast(res.reason === 'full' ? `一天 ${MAX_ENTRIES_PER_DAY} 則，今天寫完了` : '存不進去');
      }

      closeSheet();
      const after = S.getDay();

      // 今天第一則：燈剛剛亮起來，先問要讓哪幾個群看到，然後開獎。
      if (!before.askedShare && after.entries.length === 1) return openShare(go, { reveal: true });

      // 補寫：顏色跟著今天的紀錄變了，群裡看到的內容也要跟著更新。
      if (after.isPublic && isOnlineMode()) {
        SB.publishLamp(after, S.shareTargets()).catch(() => {});
      }

      go('today');
      if (S.drawsLeft(after) > 0) toast('記下來了 · 可以再抽一次');
    });
  });
}

/* ── 亮在哪幾個群 ──
 *
 * 燈在你寫下第一則的當下就亮了，這裡只決定它亮在哪裡。
 * 預設沿用上次的選擇，不必每天重選；之後在今日卡片上按「改」還能再調。
 */

function openShare(go, { reveal = false } = {}) {
  const day = S.getDay();
  const groups = S.myGroups();

  // 沒連線或還沒加入任何群，就別拿選單煩人。
  if (!isOnlineMode() || groups.length === 0) return applyShare([], go, reveal);

  // 問過了而且當時選了不分享，才是真的都不勾；還沒問過就用預設（第一次是全選）。
  const picked = new Set(day.askedShare && !day.isPublic ? [] : S.shareTargets());

  sheet(`
    <h2>${reveal ? '燈亮了' : '亮在哪幾個群'}</h2>
    <p class="small" style="margin-top:6px">要讓哪幾個群看到？不選也可以，燈一樣亮著，只是只有你看得到。</p>

    <div class="stack" style="margin-top:16px;gap:10px">
      ${groups.map((g) => `
        <label class="row" style="gap:12px;cursor:pointer;padding:4px 0;min-height:44px">
          <input type="checkbox" value="${esc(g.id)}" data-g ${picked.has(g.id) ? 'checked' : ''}
                 style="width:20px;height:20px;accent-color:var(--cinnabar-d)">
          <span class="grow">
            <span style="display:block;font-size:.84rem">${esc(g.name)}</span>
            <span class="tiny" style="display:block;margin-top:1px">${g.memberCount} 人</span>
          </span>
        </label>`).join('')}
    </div>

    <p class="small" style="margin-top:14px;color:var(--faint)">
      只有你寫的那幾則會送出去，誦經頁數也會算進大眾合計。
    </p>

    <button class="btn btn-full" style="margin-top:16px" data-go>${reveal ? '看今天的燈' : '好了'}</button>
  `, (el) => {
    el.querySelector('[data-go]').addEventListener('click', () => {
      const ids = [...el.querySelectorAll('[data-g]')].filter((x) => x.checked).map((x) => x.value);
      S.setShareTargets(ids);
      closeSheet();
      applyShare(ids, go, reveal);
    });
  });
}

function applyShare(groupIds, go, reveal) {
  const was = S.getDay();
  const day = S.setPublic(groupIds.length > 0);
  if (!day.lamp) return go('today');

  // 送出去是背景動作：失敗了燈還是亮著，不要卡住開獎那一刻。
  if (groupIds.length) {
    SB.publishLamp(day, groupIds)
      .then((id) => { if (id) S.setRemoteId(id, day.date); })
      .catch((e) => {
        console.warn('[燈燈悅心] 發布失敗', e.message);
        toast('燈亮著，但還沒送到群裡');
      });
  } else if (was.isPublic && isOnlineMode()) {
    SB.unpublishLamp(was).catch(() => {});
  }

  if (reveal) showReveal(day, () => go('today'));
  else go('today');
}

/* ── 再抽一次 ──
 *
 * 只往上。補寫一則是多一次機會，不是拿已經到手的燈去賭——
 * 不然就會有人為了不弄丟難得的燈而不敢再寫，那就本末倒置了。
 */

function doRedraw(go) {
  const r = S.redraw();
  if (!r) return;

  const day = S.getDay();
  if (day.isPublic && isOnlineMode()) {
    SB.publishLamp(day, S.shareTargets()).catch(() => {});
  }

  showReveal(day, () => go('today'), { draw: r, onRedraw: () => doRedraw(go) });
}
