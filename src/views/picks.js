/* 今天這盞燈的候選
 *
 * 抽到的每一盞都留著，並排讓人自己挑。
 *
 * 原本是「抽到比較難得的才自動換」，所以抽到的那盞要嘛取代現在這盞、
 * 要嘛就消失了——人沒得選，而且「被取代」這件事本身就讓人不舒服：
 * 難得不等於喜歡，有人就是想供那盞樸素的。
 *
 * 這一段 reveal.js 和 today.js 都要用，所以獨立出來。
 */

import * as S from '../store.js';
import { esc } from '../ui.js';
import { renderLamp, TIER_LABEL, FORMS } from '../lamp.js';

/** 並排的候選。只有一盞的時候回空字串——沒得選就不要佔版面。 */
export function picksHTML(day, { size = 62 } = {}) {
  const pool = day.pool || [];
  if (pool.length < 2) return '';

  return `<div class="picks" role="radiogroup" aria-label="選一盞供">
    ${pool.map((l, i) => `
      <button class="pick${i === day.pick ? ' on' : ''}" data-pick="${i}"
              role="radio" aria-checked="${i === day.pick}">
        <span class="pick-lamp">${renderLamp(l, { size })}</span>
        <span class="pick-name">${esc(FORMS[l.form].name)}</span>
        <span class="pick-tier">${esc(TIER_LABEL[l.tier])}</span>
      </button>`).join('')}
  </div>`;
}

/**
 * 接上點選。
 * @param {HTMLElement} root 含有 .picks 的容器
 * @param {function(number):void} onPick 換好之後要做什麼（重畫、重新發布）
 */
export function bindPicks(root, onPick) {
  root.querySelectorAll('[data-pick]').forEach((b) => {
    b.addEventListener('click', () => {
      const n = Number(b.dataset.pick);
      const before = S.getDay().pick;
      S.pickLamp(n);
      if (S.getDay().pick !== before) onPick(n);
    });
  });
}
