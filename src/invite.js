/* 邀請連結與邀請訊息
 *
 * 邀請碼放在網址上（?j=CODE），朋友點開就自動帶入，
 * 取完名字直接進群，不用自己找輸入框——中間每多一步都會流失人。
 *
 * 這跟直接給他一串碼的風險是一樣的：誰拿到誰就進得來。
 * 所以邀請訊息本身就不該貼在公開的地方。
 */

const PARAM = 'j';

/**
 * 從網址讀出邀請碼，順手把它從網址上抹掉。
 * 抹掉是必要的：不然重新整理會再觸發一次，網址列也會一直掛著那串碼。
 */
export function takeInviteCode() {
  const url = new URL(location.href);
  const raw = (url.searchParams.get(PARAM) || '').trim().toUpperCase();
  if (!raw) return null;

  url.searchParams.delete(PARAM);
  history.replaceState(null, '', url.pathname + url.search + url.hash);

  // 亂填的東西不要拿去打 API
  return /^[A-Z0-9]{4,12}$/.test(raw) ? raw : null;
}

/** 邀請連結。用 location 推出來，所以換網域也不用改程式。 */
export function inviteUrl(code) {
  return `${location.origin}${location.pathname}?${PARAM}=${encodeURIComponent(code)}`;
}

/** 可以直接貼進 LINE 的一整段訊息。 */
export function inviteMessage(groupName, code) {
  return [
    '我在用「燈燈悅心」記每天的善行，一天點一盞燈。',
    `一起來「${groupName}」吧：`,
    '',
    inviteUrl(code),
    '',
    `點開輸入名字就會自動加入。邀請碼 ${code}，手動輸入也可以。`,
  ].join('\n');
}

/**
 * 複製到剪貼簿。
 * navigator.clipboard 在非 https 或沒授權時會擲錯，所以留一條後路。
 */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** 有系統分享就用系統分享（手機上直接跳出 LINE），沒有就複製。 */
export async function shareOrCopy(text) {
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return 'shared';
    } catch (e) {
      // 使用者自己取消，不要再退回複製去煩他
      if (e && e.name === 'AbortError') return 'cancelled';
    }
  }
  return (await copyText(text)) ? 'copied' : 'failed';
}
