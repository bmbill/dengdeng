/* 開獎 —— 今天寫的合成一盞燈
 *
 * 兩種開法：
 *   寫下第一則的當下（燈亮了）
 *   之後按「再抽一次」（opts.draw）——抽到的都留著，底下並排讓人自己挑
 */

import * as S from '../store.js';
import { esc, icon, fullscreen, toast } from '../ui.js';
import { renderLamp, TIER_LABEL, GILT_LABEL, FLAMES, BOWLS, FORMS } from '../lamp.js';
import { sayingFor, quoteFor, citationOf } from '../quotes.js';
import { shareCard } from '../share.js';
import { picksHTML, bindPicks } from './picks.js';

/** 「今天寫了兩則」／「今天隨喜了三盞」——只有隨喜燈也會亮。 */
function summaryLine(day) {
  const c = S.countsOf(day);
  const parts = [];
  if (c.total) parts.push(`寫了 ${c.total} 則`);
  if (c.pages) parts.push(`誦了 ${c.pages} 頁`);
  if (c.joys) parts.push(`隨喜 ${c.joys} 盞`);
  return parts.length ? `今天${parts.join('、')}` : '今天';
}

/**
 * @param {object} day 今天（燈已經亮著）
 * @param {function} onClose
 * @param {{draw?:object, onRedraw?:function, onPick?:function}} opts draw 是 store.redraw() 的結果
 */
export function showReveal(day, onClose, opts = {}) {
  const lamp = day.lamp;
  if (!lamp) return;

  const draw = opts.draw || null;

  const all = S.lamps();
  const index = all.findIndex((d) => d.date === day.date) + 1;
  const streak = S.streakEndingAt(day.date);

  const { voice, line } = sayingFor(S.statsOf(day), { streak, gapDays: S.gapDays() });
  const quote = quoteFor(day.date);

  fullscreen(`
    <div class="row">
      <div class="grow tiny" style="letter-spacing:.06em">${S.prettyDate(day.date)} · 第 ${index} 盞</div>
      <button data-close aria-label="關閉" style="width:34px;height:34px;border:none;background:none;display:flex;align-items:center;justify-content:center;min-height:44px">${icon.close()}</button>
    </div>

    <div class="reveal">
      <div style="margin-top:26px">
        <div class="serif" style="font-size:1.3rem;font-weight:700;letter-spacing:.06em">${draw ? '再抽了一次' : summaryLine(day)}</div>
        <div class="tiny" style="margin-top:7px;letter-spacing:.04em">${draw ? `今天的第 ${day.draws} 抽` : '合成了一盞燈'}</div>
      </div>

      <div data-stage>${stageHTML(day, all)}</div>
    </div>

    ${draw ? pickCard(day, draw) : `
    <section class="card" style="margin:26px var(--gutter) 0;animation:fade-up .5s .7s both">
      <div class="row">
        ${voice.art(38)}
        <div class="grow">
          <div style="font-size:.81rem;font-weight:500">${esc(voice.name)}捎來一句</div>
          <div class="tiny" style="margin-top:2px">走了 ${all.length} 天${streak > 1 ? ` · 連續 ${streak} 天` : ''}</div>
        </div>
      </div>
      <div class="quote" style="margin-top:15px">${esc(line)}</div>
      ${quote ? `
        <div style="margin-top:16px;padding-top:15px;border-top:1px solid var(--line)">
          <div class="quote" style="font-size:1rem">${esc(quote.text)}</div>
          <div class="quote-src">${esc(citationOf(quote).text)}</div>
        </div>` : ''}
    </section>`}

    <div class="grow"></div>

    <div class="stack" style="gap:10px;padding:26px var(--gutter) 0">
      ${draw && draw.left > 0
        ? `<button class="btn btn-full" data-again>再抽一次 · 還有 ${draw.left} 次</button>
           <button class="btn ghost btn-full" data-close>好了</button>`
        : `<button class="btn btn-full" data-close>好了</button>
           <button class="btn ghost btn-full" data-share>做成圖卡分享</button>`}
    </div>
  `, (el, close) => {
    el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => {
      close();
      onClose?.();
    }));
    el.querySelector('[data-again]')?.addEventListener('click', () => opts.onRedraw?.());

    // 換一盞：就地重畫那盞大的和候選列，不要關掉重開——
    // 關掉重開會把整段進場動畫再跑一次，像出了什麼事。
    bindPicks(el, () => {
      const now = S.getDay();
      el.querySelector('[data-stage]').innerHTML = stageHTML(now, all);
      const card = el.querySelector('[data-picks-card]');
      if (card) card.innerHTML = pickCardInner(now, draw);
      bindPicks(el, () => {});   // 新畫出來的按鈕要重新接
      opts.onPick?.();
    });
    el.querySelector('[data-share]')?.addEventListener('click', (e) => doShare(day, e.currentTarget));
  });
}

/** 那盞大的，連同名字和標籤。換燈的時候整塊重畫。 */
function stageHTML(day, all) {
  const lamp = day.lamp;
  const sameForm = all.filter((d) => d.lamp.form === lamp.form).length;
  return `
    <div class="reveal-glow">${renderLamp(lamp, { size: 150 })}</div>

    <div class="reveal-name" style="margin-top:2px">${esc(lamp.name)}</div>
    ${lamp.name === FORMS[lamp.form].name ? '' : `
      <div class="tiny" style="margin-top:4px">形制：${esc(FORMS[lamp.form].name)}</div>`}

    <div class="tags">
      <span class="tag rare">${TIER_LABEL[lamp.tier]}${sameForm > 1 ? ` · 第 ${sameForm} 次遇見` : ' · 初次遇見'}</span>
      <span class="tag info">${FLAMES[lamp.flame].name} · ${BOWLS[lamp.bowl].name}${GILT_LABEL[lamp.tier] ? ` · ${GILT_LABEL[lamp.tier]}` : ''}</span>
    </div>`;
}

/**
 * 抽完之後選一盞。
 *
 * 抽到常見的也照樣並排擺出來——瞞著只留下好的會讓人以為按鈕壞了。
 * 它本來就是運氣，只是現在抽到的不會互相取代。
 */
function pickCardInner(day, draw) {
  const drawn = draw.drawn;
  const same = day.pool.filter((l) => l.form === drawn.form).length > 1;
  const said = same
    ? `又抽到「${FORMS[drawn.form].name}」（${TIER_LABEL[drawn.tier]}）。`
    : `這次抽到「${FORMS[drawn.form].name}」（${TIER_LABEL[drawn.tier]}），已經換上了。`;

  return `
    <div class="card-title">選一盞來供</div>
    <p class="small" style="margin-top:6px">${said}不喜歡的話點旁邊那盞換回去，今天隨時可以改。</p>
    <div style="margin-top:13px">${picksHTML(day)}</div>`;
}

function pickCard(day, draw) {
  return `<section class="card" data-picks-card style="margin:26px var(--gutter) 0;animation:fade-up .5s .5s both">${pickCardInner(day, draw)}</section>`;
}

/** 分享：畫成一張圖，善行是主角。 */
async function doShare(day, btn) {
  const was = btn.textContent;
  btn.disabled = true;
  btn.textContent = '正在畫…';
  try {
    const r = await shareCard(day);
    if (r === 'saved') toast('圖卡存好了，可以傳給朋友');
  } catch (e) {
    console.warn('[燈燈悅心] 圖卡失敗', e);
    toast('圖卡做不出來，換個瀏覽器試試');
  } finally {
    btn.disabled = false;
    btn.textContent = was;
  }
}
