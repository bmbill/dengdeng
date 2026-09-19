/* 一盞燈的小卡
 *
 * 重點是那件善行，不是燈。
 *
 * 之前這張卡把燈畫得很大、稀有度和焰色用大標籤標出來，
 * 善行反而縮在下面——那個比重是反的。有人做了一件好事，
 * 標題不該是「少見 · 藤黃焰」。
 *
 * 現在：內容擺第一，燈縮成一個小圖示，形制焰色收成一行灰字。
 */

import * as S from '../store.js';
import * as SB from '../supabase.js';
import { esc, sheet, closeSheet, toast } from '../ui.js';
import { renderLamp, TIER_LABEL, BOWLS, FLAMES } from '../lamp.js';

/** 燈的細節，一行灰字就好。 */
function lampFootnote(l) {
  const bits = [l.name, TIER_LABEL[l.tier], FLAMES[l.flame]?.name, BOWLS[l.bowl]?.name]
    .filter(Boolean);
  return `
    <div class="card-foot">
      <span style="flex-shrink:0">${renderLamp(l, { size: 22 })}</span>
      <span class="tiny">${esc(bits.join(' · '))}</span>
    </div>
  `;
}

function entryBlock(e) {
  const label = S.KINDS[e.kind]?.name || '紀錄';
  return `
    <div class="entry">
      <div class="entry-kind">${esc(label)}${e.pages ? ` · ${e.pages} 頁` : ''}</div>
      <div class="entry-text">${esc(e.text)}</div>
    </div>
  `;
}

function header(title, sub, char) {
  return `
    <div class="row" style="gap:10px;align-items:flex-start">
      ${char ? `<span class="avatar" style="width:32px;height:32px;border-radius:16px;font-size:.84rem;flex-shrink:0">${esc(char)}</span>` : ''}
      <span class="grow" style="min-width:0">
        <span style="display:block;font-size:.88rem;font-weight:600">${esc(title)}</span>
        <span class="tiny" style="display:block;margin-top:2px">${esc(sub)}</span>
      </span>
      <button class="card-x" data-x aria-label="關閉">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6.4 6.4l11.2 11.2M17.6 6.4L6.4 17.6" stroke="#8A8073" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
    </div>
  `;
}

/* ── 自己的某一天 ── */

export function showMyDay(date) {
  const day = S.getDay(date);
  if (!day.lamp) return;
  const joys = (day.joys || []).length;

  sheet(`
    ${header('那天你寫了', S.prettyDate(date), null)}

    <div class="stack" style="margin-top:14px;gap:12px">
      ${(day.entries || []).length
        ? day.entries.map(entryBlock).join('')
        : '<div class="small">這天沒有寫，只有一盞燈。</div>'}
      ${joys ? `<div class="entry">
        <div class="entry-kind">隨喜</div>
        <div class="entry-text">你隨喜了 ${joys} 盞別人的燈</div>
      </div>` : ''}
    </div>

    <div data-echo></div>
    ${lampFootnote(day.lamp)}
  `, (el) => {
    el.querySelector('[data-x]').addEventListener('click', closeSheet);
    if (day.remoteId) loadEcho(el.querySelector('[data-echo]'), day.remoteId);
  }, { className: 'compact' });
}

/** 自己那盞燈的回音：誰隨喜了、誰說了什麼。 */
async function loadEcho(slot, remoteId) {
  const d = await SB.lampDetail(remoteId);
  if (!d || !slot?.isConnected) return;
  if (!d.joyCount && !d.replies.length) return;

  slot.innerHTML = `
    <div class="echo">
      ${d.joyCount ? `<div class="small" style="color:var(--ink)">${d.joyCount} 個人隨喜了這盞燈</div>` : ''}
      ${d.replies.map((r) => `<div class="post-reply"><b>${esc(r.name || '無名')}</b>　${esc(r.body)}</div>`).join('')}
    </div>
  `;
}

/* ── 別人的燈 ── */

export async function showSharedLamp(lampId, onChange) {
  sheet('<div class="empty">正在拿這盞燈…</div>', null, { className: 'compact' });

  const d = await SB.lampDetail(lampId);
  if (!d) {
    closeSheet();
    return toast('這盞燈拿不到');
  }
  const mine = d.authorId === (await SB.myUserId());

  sheet(`
    ${header(d.authorName + (mine ? '（你）' : ''), S.prettyDate(d.date), d.authorChar)}

    <div class="stack" style="margin-top:14px;gap:12px">
      ${d.entries.length
        ? d.entries.map(entryBlock).join('')
        : '<div class="small">這天沒有公開內容，只有一盞燈。</div>'}
    </div>

    ${d.replies.length ? `<div class="echo">
      ${d.replies.map((r) => `<div class="post-reply"><b>${esc(r.name || '無名')}</b>　${esc(r.body)}</div>`).join('')}
    </div>` : ''}

    <div class="post-acts" style="margin-top:16px">
      ${mine
        ? (d.joyCount ? `<span class="small">${d.joyCount} 個人隨喜了這盞燈</span>` : '<span class="small">還沒有人隨喜</span>')
        : `<button class="btn chip ${d.joinedByMe ? 'on' : ''}" data-joy data-on="${d.joinedByMe ? '1' : '0'}">
             <span data-count>隨喜 ${d.joyCount}</span>
           </button>
           <button class="btn chip" data-reply>留言</button>`}
    </div>

    ${lampFootnote(d.lamp)}
  `, (el) => {
    el.querySelector('[data-x]').addEventListener('click', closeSheet);
    el.querySelector('[data-joy]')?.addEventListener('click', (e) => onJoy(e.currentTarget, d, onChange));
    el.querySelector('[data-reply]')?.addEventListener('click', () => openReply(d, onChange));
  }, { className: 'compact' });
}

async function onJoy(btn, d, onChange) {
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
      toast(S.getDay().sealedAt ? '隨喜了' : '隨喜了，你今天的燈也亮一點');
    } else {
      S.removeJoy(d.id);
    }
    onChange?.();
  } catch (e) {
    toast(e.message || '隨喜失敗');
  } finally {
    btn.disabled = false;
  }
}

function openReply(d, onChange) {
  sheet(`
    <h2>想跟他說什麼</h2>
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
        onChange?.();
      } catch (e) {
        toast(e.message || '送不出去');
      }
    });
  });
}
