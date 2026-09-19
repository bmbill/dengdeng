/* 燈燈悅心 — 共用的畫面零件 */

/** 把字串安全地放進 HTML。所有使用者輸入都要經過這裡。 */
export function esc(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/* ── 圖示：一律內嵌 stroke SVG，不用 emoji ── */

export const icon = {
  deed: (c = '#B04A31') => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 20s-7-4.4-7-9.2A4.1 4.1 0 0 1 12 8.1a4.1 4.1 0 0 1 7 2.7C19 15.6 12 20 12 20z" stroke="${c}" stroke-width="1.8" stroke-linejoin="round"/></svg>`,

  sutra: (c = '#43707F') => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 7.6C10.8 6.3 8.9 5.6 6 5.6v11.8c2.9 0 4.8.7 6 2 1.2-1.3 3.1-2 6-2V5.6c-2.9 0-4.8.7-6 2z" stroke="${c}" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 7.6v11.8" stroke="${c}" stroke-width="1.7" stroke-linecap="round"/></svg>`,

  joy: (c = '#B4842A', fill = false) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4.2l1.9 5 5 1.9-5 1.9-1.9 5-1.9-5-5-1.9 5-1.9z" ${fill ? `fill="${c}"` : `stroke="${c}" stroke-width="1.7" stroke-linejoin="round"`}/></svg>`,

  note: (c = '#8A6234') => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5.2 19l1-3.7L15.8 5.7a1.85 1.85 0 0 1 2.6 2.6L8.9 18z" stroke="${c}" stroke-width="1.7" stroke-linejoin="round"/></svg>`,

  check: () => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#6E8F6B"/><path d="M7.8 12.4l2.9 2.9 5.5-6" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  close: () => `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6.4 6.4l11.2 11.2M17.6 6.4L6.4 17.6" stroke="#8A8073" stroke-width="2" stroke-linecap="round"/></svg>`,

  invite: () => `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10" cy="8.6" r="3.6" stroke="#8A6234" stroke-width="1.8"/><path d="M3.6 19.6c0-3.5 2.9-5.7 6.4-5.7 1.5 0 2.9.4 4 1.1" stroke="#8A6234" stroke-width="1.8" stroke-linecap="round"/><path d="M18 14.2v5.4M15.3 16.9h5.4" stroke="#8A6234" stroke-width="1.8" stroke-linecap="round"/></svg>`,

  plus: (c = '#B04A31') => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5.5v13M5.5 12h13" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/></svg>`,

  minus: (c = '#6E6456') => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5.5 12h13" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/></svg>`,
};

export const tabIcon = {
  today: (on) => `<svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="4.3" ${on ? 'fill="#B04A31"' : 'stroke="#8A8073" stroke-width="1.8"'}/><path d="M12 2.6v2.4M12 19v2.4M2.6 12H5M19 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M18.7 5.3L17 7M7 17l-1.7 1.7" stroke="${on ? '#B04A31' : '#8A8073'}" stroke-width="1.8" stroke-linecap="round"/></svg>`,

  sea: (on) => `<svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3.4c2.3 3.2 3.6 5 3.6 6.9a3.6 3.6 0 0 1-7.2 0c0-1.9 1.3-3.7 3.6-6.9z" ${on ? 'fill="#B04A31"' : 'stroke="#8A8073" stroke-width="1.7" stroke-linejoin="round"'}/><path d="M5.6 15.4h12.8c0 3.3-2.9 5.4-6.4 5.4s-6.4-2.1-6.4-5.4z" ${on ? 'fill="#B04A31"' : 'stroke="#8A8073" stroke-width="1.7" stroke-linejoin="round"'}/></svg>`,

  together: (on) => `<svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="9" cy="8.6" r="3.1" ${on ? 'fill="#B04A31"' : 'stroke="#8A8073" stroke-width="1.7"'}/><circle cx="16.6" cy="10.2" r="2.4" ${on ? 'fill="#D8907A"' : 'stroke="#8A8073" stroke-width="1.7"'}/><path d="M3.4 19.4c0-3.1 2.5-5 5.6-5s5.6 1.9 5.6 5${on ? 'z' : ''}" ${on ? 'fill="#B04A31"' : 'stroke="#8A8073" stroke-width="1.7" stroke-linecap="round"'}/><path d="M16.4 15.2c2.5.2 4.2 1.9 4.2 4.2${on ? 'h-4.2z' : ''}" ${on ? 'fill="#D8907A"' : 'stroke="#8A8073" stroke-width="1.7" stroke-linecap="round"'}/></svg>`,

  me: (on) => `<svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8.4" r="3.6" ${on ? 'fill="#B04A31"' : 'stroke="#8A8073" stroke-width="1.7"'}/><path d="M5.2 20c0-3.6 3-5.9 6.8-5.9s6.8 2.3 6.8 5.9${on ? 'z' : ''}" ${on ? 'fill="#B04A31"' : 'stroke="#8A8073" stroke-width="1.7" stroke-linecap="round"'}/></svg>`,
};

/* ── 提示 ── */

let toastTimer = null;

export function toast(msg) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = msg;
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2400);
}

/* ── 底部彈層 ── */

export function sheet(html, onMount) {
  close();
  const bg = document.createElement('div');
  bg.className = 'sheet-bg';
  bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  bg.addEventListener('click', (e) => { if (e.target === bg) close(); });
  document.body.appendChild(bg);
  onMount?.(bg.querySelector('.sheet'), close);

  function close() {
    document.querySelector('.sheet-bg')?.remove();
  }
  return close;
}

export function closeSheet() {
  document.querySelector('.sheet-bg')?.remove();
}

/* ── 全螢幕（開獎用） ── */

export function fullscreen(html, onMount) {
  document.querySelector('.fullscreen')?.remove();
  const el = document.createElement('div');
  el.className = 'fullscreen';
  el.innerHTML = html;
  document.body.appendChild(el);
  onMount?.(el, () => el.remove());
  return () => el.remove();
}
