/* 今日 —— 隨手寫一則
 *
 * 門檻刻意壓到最低：一則短短的就能點燈（只是隨喜了別人也算）。
 * 上限 3 則。不是限制你，是為了讓「一則」還是一件事——
 * 可以無限寫的話，寫下來這個動作就不值錢了。
 */

import * as S from '../store.js';
import * as SB from '../supabase.js';
import { esc, icon, sheet, closeSheet, toast } from '../ui.js';
import { renderLamp, depthOf } from '../lamp.js';
import { showReveal } from './reveal.js';
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
      ${day.sealedAt ? sealedCard(day) : actionsCard(day, c, left)}

      <section class="card">
        <div class="row" style="align-items:baseline;gap:8px">
          <div class="grow serif" style="font-size:.88rem;font-weight:600">${now.getMonth() + 1} 月</div>
          <div class="tiny">${monthLit(now)} 天亮著</div>
        </div>
        <div class="month-grid" style="margin-top:14px">${monthCells(now)}</div>
        <div class="small" style="margin-top:13px">中斷不會熄滅，只是那天空著。</div>
      </section>
    </div>
  `;

  root.querySelectorAll('[data-write]').forEach((b) => {
    b.addEventListener('click', () => openWrite(b.dataset.write, go));
  });

  root.querySelectorAll('[data-del]').forEach((b) => {
    b.addEventListener('click', () => {
      S.removeEntry(b.dataset.del);
      go('today');
    });
  });

  root.querySelector('[data-seal]')?.addEventListener('click', () => openSeal(go));

  root.querySelector('[data-show-lamp]')?.addEventListener('click', () => {
    showReveal(S.getDay(date), () => go('today'));
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
        ${day.entries.map((e) => entryRow(e, day.sealedAt)).join('')}
        ${c.joys ? joyRow(day, c) : ''}
      </div>
    </section>
  `;
}

function entryRow(e, sealed) {
  const st = KIND_STYLE[e.kind] || KIND_STYLE.deed;
  const label = S.KINDS[e.kind]?.short || '善行';
  return `
    <div class="task">
      <span class="task-icon ${st.cls}">${icon[st.ic]()}</span>
      <span class="grow">
        <span class="task-name" style="display:block">${label}${e.pages ? ` · ${e.pages} 頁` : ''}</span>
        <span class="task-val" style="display:block">${esc(e.text)}</span>
      </span>
      ${sealed ? '' : `<button class="btn chip" data-del="${e.id}" aria-label="移除這則">移除</button>`}
    </div>
  `;
}

/** 隨喜單獨一列，而且明說不佔額度。 */
function joyRow(day, c) {
  const names = [...new Set(day.joys.map((j) => j.authorName).filter(Boolean))];
  return `
    <div class="task">
      <span class="task-icon joy">${icon.joy('#B4842A', true)}</span>
      <span class="grow">
        <span class="task-name" style="display:block">隨喜 ${c.joys} 盞</span>
        <span class="task-val truncate" style="display:block">${names.length ? esc(names.join('、')) : '大家的燈'}</span>
      </span>
      <span class="tiny">不佔額度</span>
    </div>
  `;
}

/**
 * 動作卡。
 *
 * 順序很重要：已經寫了東西的時候，「點今天的燈」要排第一。
 * 本來它排在「再寫一則」和四個類別按鈕的後面，變成第三順位，
 * 使用者寫完一則會以為還沒結束——真正的獎勵動作不該躲在
 * 兩個「再多做一點」的後面。
 */
function actionsCard(day, c, left) {
  const kinds = [
    ['deed', '善行點滴'],
    ['gratitude', '觀功念恩'],
    ['sutra', '誦經'],
    ['note', '其他'],
  ];

  const canSeal = S.canSeal(day.date);
  const depth = depthOf(S.statsOf(day));
  const nudge = left === 0
    ? '今天的三則寫完了。夠了，剩下的留給明天。'
    : depth < 0.95
      ? '再寫一則，比較有機會遇到少見的燈。不寫也沒關係。'
      : '稀有的機會拉到最高了。';

  return `
    <section class="card">
      ${canSeal ? `
        <button class="btn btn-full" data-seal>點今天的燈</button>
        <div class="small" style="margin-top:10px">${nudge}</div>
        <div class="small" style="margin-top:6px;color:var(--faint)">點了就封存，今天不能再改。</div>
      ` : `
        <div class="card-title">今天還沒寫</div>
        <p class="small" style="margin-top:7px">
          一則短短的就好。看到什麼、做了什麼、想到誰的好，寫一句就能點今天的燈。
        </p>
      `}

      ${left > 0 ? `
        <div style="margin-top:${canSeal ? '18px' : '14px'};${canSeal ? 'padding-top:16px;border-top:1px solid var(--line);' : ''}">
          ${canSeal ? '<div class="tiny" style="margin-bottom:10px">還想寫的話</div>' : ''}
          <div class="row" style="gap:8px;flex-wrap:wrap">
            ${kinds.map(([k, name]) => `<button class="btn chip" data-write="${k}">${name}</button>`).join('')}
          </div>
        </div>` : ''}
    </section>
  `;
}

function sealedCard(day) {
  return `
    <button class="card card-note" data-show-lamp style="width:100%;text-align:left;cursor:pointer">
      <span class="row">
        <span style="flex-shrink:0">${renderLamp(day.lamp, { size: 34 })}</span>
        <span class="grow">
          <span style="display:block;font-size:.81rem;font-weight:500">今天點了「${esc(day.lamp.name)}」</span>
          <span class="small" style="display:block;margin-top:2px">按一下再看一次</span>
        </span>
      </span>
    </button>
  `;
}

function monthLit(now) {
  return S.monthGrid(now.getFullYear(), now.getMonth() + 1).filter((x) => x.lamp).length;
}

function monthCells(now) {
  const cells = S.monthGrid(now.getFullYear(), now.getMonth() + 1);
  const today = S.todayStr();
  const tone = { cinnabar: '#C4553A', azurite: '#43707F', gamboge: '#D9A441', malachite: '#6E8F6B', ochre: '#A9713F' };
  return cells.map((x) => {
    if (x.lamp) return `<i style="background:${tone[x.lamp.bowl]}" title="${esc(x.date)}"></i>`;
    if (x.date > today) return '<i style="background:transparent"></i>';
    if (x.date === today) return '<i class="blank"></i>';
    return '<i></i>';
  }).join('');
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
  if (day.sealedAt) return toast('今天的燈已經點了');
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

    <button class="btn btn-full" style="margin-top:16px" data-save>記下來</button>
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

      const res = S.addEntry({ kind: current, text, pages });
      if (!res.ok) {
        return toast(res.reason === 'full' ? `一天 ${MAX_ENTRIES_PER_DAY} 則，今天寫完了` : '存不進去');
      }
      closeSheet();
      go('today');
    });
  });
}

/* ── 點燈 ──
 * 點之前先問要不要發到群裡，以及發到哪幾個群。
 * 預設沿用上次的選擇，不必每天重選。 */

function openSeal(go) {
  const day = S.getDay();
  const groups = S.myGroups();

  // 沒連線或還沒加入任何群，就直接點，不要拿選單煩人。
  if (!isOnlineMode() || groups.length === 0) return doSeal([], go);

  const picked = new Set(day.isPublic === false ? [] : S.shareTargets());

  sheet(`
    <h2>點今天的燈</h2>
    <p class="small" style="margin-top:6px">要讓哪幾個群看到？不選也可以，燈一樣會亮，只是只有你看得到。</p>

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

    <button class="btn btn-full" style="margin-top:16px" data-go>點燈</button>
  `, (el) => {
    el.querySelector('[data-go]').addEventListener('click', () => {
      const ids = [...el.querySelectorAll('[data-g]')].filter((x) => x.checked).map((x) => x.value);
      S.setShareTargets(ids);
      closeSheet();
      doSeal(ids, go);
    });
  });
}

function doSeal(groupIds, go) {
  const sealed = S.seal();
  if (!sealed.lamp) return;

  S.setPublic(groupIds.length > 0);

  // 發布是背景動作：失敗了燈還是亮著，不要卡住開獎那一刻。
  if (groupIds.length) {
    SB.publishLamp(sealed, groupIds)
      .then((id) => { if (id) S.setRemoteId(id, sealed.date); })
      .catch((e) => {
        console.warn('[燈燈] 發布失敗', e.message);
        toast('燈點好了，但還沒送到群裡');
      });
  }

  showReveal(sealed, () => go('today'));
}
