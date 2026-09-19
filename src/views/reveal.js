/* 開獎 —— 今天寫的合成一盞燈 */

import * as S from '../store.js';
import { esc, icon, fullscreen, toast } from '../ui.js';
import { renderLamp, TIER_LABEL, FLAMES, BOWLS } from '../lamp.js';
import { sayingFor, quoteFor, citationOf } from '../quotes.js';

/** 燈童：app 自己的角色，不冒名任何人。 */
function companion(size = 38) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" aria-hidden="true">
    <circle cx="32" cy="32" r="32" fill="#F3EADA"/>
    <path d="M32 36c-8.5 0-14 5.6-15 13.2-.4 3 1 4.8 3.8 4.8h22.4c2.8 0 4.2-1.8 3.8-4.8C46 41.6 40.5 36 32 36z" fill="#C4553A"/>
    <path d="M32 36c-2.6 0-4.9.4-6.8 1.2L32 45l6.8-7.8c-1.9-.8-4.2-1.2-6.8-1.2z" fill="#EBD3AE"/>
    <circle cx="32" cy="24" r="12.4" fill="#F1D8B4"/>
    <path d="M25.6 24.4q2.4-2.8 4.8 0" stroke="#2B2620" stroke-width="1.9" stroke-linecap="round"/>
    <path d="M33.6 24.4q2.4-2.8 4.8 0" stroke="#2B2620" stroke-width="1.9" stroke-linecap="round"/>
    <path d="M29.8 29.2q2.2 1.9 4.4 0" stroke="#2B2620" stroke-width="1.9" stroke-linecap="round"/>
    <circle cx="23.4" cy="27.6" r="2.4" fill="#E2A08C" opacity=".75"/>
    <circle cx="40.6" cy="27.6" r="2.4" fill="#E2A08C" opacity=".75"/>
  </svg>`;
}

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

  const saying = sayingFor(S.statsOf(day), { streak, gapDays: S.gapDays() });
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
        ${companion()}
        <div class="grow">
          <div style="font-size:.81rem;font-weight:500">燈童捎來一句</div>
          <div class="tiny" style="margin-top:2px">走了 ${all.length} 天${streak > 1 ? ` · 連續 ${streak} 天` : ''}</div>
        </div>
      </div>
      <div class="quote" style="margin-top:15px">${esc(saying)}</div>
      ${quote ? `
        <div style="margin-top:16px;padding-top:15px;border-top:1px solid var(--line)">
          <div class="quote" style="font-size:1rem">${esc(quote.text)}</div>
          <div class="quote-src">${esc(citationOf(quote).text)}</div>
        </div>` : ''}
    </section>

    <div class="grow"></div>

    <div class="stack" style="gap:10px;padding:26px var(--gutter) 0">
      <button class="btn btn-full" data-close>供到燈海</button>
      <button class="btn ghost btn-full" data-share>做成卡片，分享給同行</button>
    </div>
  `, (el, close) => {
    el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => {
      close();
      onClose?.();
    }));
    el.querySelector('[data-share]').addEventListener('click', () => shareCard(day, lamp));
  });
}

/** 分享：先走系統分享，沒有就複製文字。做圖卡是之後的事。 */
async function shareCard(day, lamp) {
  const c = S.countsOf(day);
  const text = `${S.prettyDate(day.date)}\n今天點了一盞「${lamp.name}」（${TIER_LABEL[lamp.tier]}）\n寫了 ${c.total} 則${c.pages ? ` · 誦經 ${c.pages} 頁` : ''}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: '燈燈悅心', text });
      return;
    }
    await navigator.clipboard.writeText(text);
    toast('已複製，可以貼給朋友');
  } catch {
    toast('這個裝置不支援分享');
  }
}

