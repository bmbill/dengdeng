/* 開獎 —— 今天寫的合成一盞燈 */

import * as S from '../store.js';
import { esc, icon, fullscreen, toast } from '../ui.js';
import { renderLamp, TIER_LABEL, FLAMES, BOWLS } from '../lamp.js';
import { sayingFor, quoteFor, citationOf } from '../quotes.js';
import { shareCard } from '../share.js';

/** 「今天寫了兩則」／「今天隨喜了三盞」——只有隨喜也能點燈。 */
function summaryLine(day) {
  const c = S.countsOf(day);
  const parts = [];
  if (c.total) parts.push(`寫了 ${c.total} 則`);
  if (c.pages) parts.push(`誦了 ${c.pages} 頁`);
  if (c.joys) parts.push(`隨喜 ${c.joys} 盞`);
  return parts.length ? `今天${parts.join('、')}` : '今天';
}

export function showReveal(day, onClose) {
  const lamp = day.lamp;
  if (!lamp) return;

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
        <div class="serif" style="font-size:1.3rem;font-weight:700;letter-spacing:.06em">${summaryLine(day)}</div>
        <div class="tiny" style="margin-top:7px;letter-spacing:.04em">合成了一盞燈</div>
      </div>

      <div class="reveal-glow">${renderLamp(lamp, { size: 150 })}</div>

      <div class="reveal-name" style="margin-top:2px">${esc(lamp.name)}</div>

      <div class="tags">
        <span class="tag rare">${TIER_LABEL[lamp.tier]}${sameForm > 1 ? ` · 第 ${sameForm} 次遇見` : ' · 初次遇見'}</span>
        <span class="tag info">${FLAMES[lamp.flame].name} · ${BOWLS[lamp.bowl].name}</span>
      </div>
    </div>

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
    </section>

    <div class="grow"></div>

    <div class="stack" style="gap:10px;padding:26px var(--gutter) 0">
      <button class="btn btn-full" data-close>供到燈海</button>
      <button class="btn ghost btn-full" data-share>做成圖卡分享</button>
    </div>
  `, (el, close) => {
    el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => {
      close();
      onClose?.();
    }));
    el.querySelector('[data-share]').addEventListener('click', (e) => doShare(day, e.currentTarget));
  });
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
    console.warn('[燈燈] 圖卡失敗', e);
    toast('圖卡做不出來，換個瀏覽器試試');
  } finally {
    btn.disabled = false;
    btn.textContent = was;
  }
}
