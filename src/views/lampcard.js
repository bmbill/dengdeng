/* 一盞燈的小卡
 *
 * 標題是那一天，不是那盞燈。
 *
 * 排過兩次。第一版把燈畫得很大、稀有度和焰色用大標籤標出來，
 * 善行縮在下面——有人做了一件好事，標題不該是「少見 · 藤黃焰」。
 * 第二版反過來，內容擺第一、燈縮成一個小圖示，但整張卡變得
 * 沒有重心，看起來就是一段文字。
 *
 * 現在是第三版：日期當標題，燈在標題上面（它就是那一天的樣子），
 * 善行一則一張白卡排在下面。規格不講了——形制、焰色、燈身色是
 * 開獎那一刻的事，之後再看只想知道那天是誰、做了什麼。
 */

import * as S from '../store.js';
import * as SB from '../supabase.js';
import { esc, sheet, closeSheet, toast } from '../ui.js';
import { renderLamp } from '../lamp.js';

/**
 * 卡頭：燈、日期、一行「誰的什麼燈」。
 *
 * 日期用襯線大字當標題——翻回去看舊的燈海時，先想知道的是
 * 「那是哪一天」，不是「那是第幾種形制」。
 */
function head(lamp, date, who) {
  return `
    <div class="row" style="justify-content:flex-end">
      <button class="card-x" data-x aria-label="關閉">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6.4 6.4l11.2 11.2M17.6 6.4L6.4 17.6" stroke="#8A8073" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
    </div>
    <div style="text-align:center">
      <div class="card-lamp">${renderLamp(lamp, { size: 118 })}</div>
      <div class="card-date">${esc(S.prettyDate(date))}</div>
      <div class="tiny" style="margin-top:7px">${esc(who)}</div>
    </div>
  `;
}

function entryBlock(e) {
  const label = S.KINDS[e.kind]?.name || '紀錄';
  return `
    <div class="deed">
      <div class="entry-kind">${esc(label)}${e.pages ? ` · ${e.pages} 頁` : ''}</div>
      <div class="entry-text">${esc(e.text)}</div>
    </div>
  `;
}

/* ── 自己的某一天 ── */

export function showMyDay(date) {
  const day = S.getDay(date);
  if (!day.lamp) return;
  const joys = (day.joys || []).length;

  sheet(`
    ${head(day.lamp, date, `你的${day.lamp.name}`)}

    <div style="margin-top:16px">
      ${(day.entries || []).length
        ? day.entries.map(entryBlock).join('')
        : '<div class="small center">這天沒有寫，只有一盞燈。</div>'}
      ${joys ? `<div class="deed">
        <div class="entry-kind">隨喜</div>
        <div class="entry-text">你隨喜了 ${joys} 盞別人的燈</div>
      </div>` : ''}
    </div>

    <div data-echo></div>
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
    ${head(d.lamp, d.date, `${d.authorName}${mine ? '（你）' : ''} 的${d.lamp.name}`)}

    <div style="margin-top:16px">
      ${d.entries.length
        ? d.entries.map(entryBlock).join('')
        : '<div class="small center">這天沒有公開內容，只有一盞燈。</div>'}
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
  `, (el) => {
    el.querySelector('[data-x]').addEventListener('click', closeSheet);
    el.querySelector('[data-joy]')?.addEventListener('click', (e) => onJoy(e.currentTarget, d, onChange));
    el.querySelector('[data-reply]')?.addEventListener('click', () => openReply(d, onChange));
  }, { className: 'compact' });
}

async function onJoy(btn, d, onChange) {
  const on = btn.dataset.on === '1';
  btn.disabled = true;
  // 一整天只隨喜、沒寫東西，這一下也會供上今天的燈
  const wasLit = Boolean(S.getDay().lamp);
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
      toast(wasLit ? '隨喜了' : '隨喜了 · 今天的燈也亮了');
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
