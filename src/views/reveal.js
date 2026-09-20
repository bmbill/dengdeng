/* 開獎 —— 今天寫的合成一盞燈
 *
 * 兩種開法：
 *   寫下第一則的當下（燈亮了）
 *   之後按「再抽一次」（opts.draw），只往上換，換不換都據實講
 */

import * as S from '../store.js';
import { esc, icon, fullscreen, toast } from '../ui.js';
import { renderLamp, TIER_LABEL, TIER_RANK, GILT_LABEL, FLAMES, BOWLS, FORMS } from '../lamp.js';
import { sayingFor, quoteFor, citationOf } from '../quotes.js';
import { shareCard } from '../share.js';

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
 * @param {{draw?:object, onRedraw?:function}} opts draw 是 store.redraw() 的結果
 */
export function showReveal(day, onClose, opts = {}) {
  const lamp = day.lamp;
  if (!lamp) return;

  const draw = opts.draw || null;

  const all = S.lamps();
  const index = all.findIndex((d) => d.date === day.date) + 1;
  const sameForm = all.filter((d) => d.lamp.form === lamp.form).length;
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

      <div class="reveal-glow">${renderLamp(lamp, { size: 150 })}</div>

      <div class="reveal-name" style="margin-top:2px">${esc(lamp.name)}</div>

      <div class="tags">
        <span class="tag rare">${TIER_LABEL[lamp.tier]}${sameForm > 1 ? ` · 第 ${sameForm} 次遇見` : ' · 初次遇見'}</span>
        <span class="tag info">${FLAMES[lamp.flame].name} · ${BOWLS[lamp.bowl].name}${GILT_LABEL[lamp.tier] ? ` · ${GILT_LABEL[lamp.tier]}` : ''}</span>
      </div>
    </div>

    ${draw ? drawCard(draw) : `
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
    el.querySelector('[data-share]')?.addEventListener('click', (e) => doShare(day, e.currentTarget));
  });
}

/**
 * 抽完的結果，換沒換都據實講。
 *
 * 抽到常見的也照樣講出來——瞞著只說「留著原本那盞」會讓人以為
 * 按鈕壞了。它本來就是運氣，只是這裡的運氣不會往下。
 */
function drawCard(draw) {
  const { drawn, before } = draw;
  const of = (l) => `「${FORMS[l.form].name}」（${TIER_LABEL[l.tier]}）`;

  const said = draw.kept
    ? `這次抽到${of(drawn)}，比原本的${of(before)}少見，換上了。`
    : drawn.form === before.form
      ? `又抽到同一盞${of(drawn)}。`
      : TIER_RANK[drawn.tier] === TIER_RANK[before.tier]
        ? `這次抽到${of(drawn)}，跟原本的「${FORMS[before.form].name}」一樣${TIER_LABEL[before.tier]}，留著原本那盞。`
        : `這次抽到${of(drawn)}，原本的${of(before)}比較少見，留著原本那盞。`;

  return `
    <section class="card" style="margin:26px var(--gutter) 0;animation:fade-up .5s .5s both">
      <div class="card-title">${draw.kept ? '換上了新的一盞' : '留著原本那盞'}</div>
      <p class="small" style="margin-top:8px;line-height:1.9">${said}</p>
      <p class="small" style="margin-top:8px;color:var(--faint)">
        ${draw.left > 0
          ? `還可以抽 ${draw.left} 次。`
          : S.entriesLeft(S.getDay()) > 0
            ? '抽完了。再寫一則就再多一次。'
            : '今天三則都寫了，三次也抽完了。'}
      </p>
    </section>`;
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
