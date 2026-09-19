/* 燈燈悅心 — Supabase 連線
 *
 * 整支都是「可以失敗」的：沒設定、離線、CDN 載不到，都只會回 null，
 * 不會讓 app 當掉。畫面自己處理沒連上的狀況。
 *
 * 資料模型：燈屬於人，不屬於群。一盞燈可以分享到多個群（lamp_shares）。
 */

import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, isOnlineMode } from './config.js';
import * as S from './store.js';

let clientPromise = null;

async function client() {
  if (!isOnlineMode()) return null;
  if (!clientPromise) {
    clientPromise = (async () => {
      try {
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          auth: { persistSession: true, autoRefreshToken: true },
        });
      } catch (e) {
        console.warn('[燈燈] Supabase 載入失敗，改用單機模式', e);
        return null;
      }
    })();
  }
  return clientPromise;
}

let sessionUser = null;

/**
 * 匿名登入：不用 email、不用密碼，裝置上存一組 session。
 *
 * 關鍵在於「驗證」那一段：getSession() 只讀本機，
 * 不保證伺服器那邊這個帳號還在。如果帳號被刪掉（或整個專案重建），
 * token 還留在裝置上，app 會若無其事繼續用它去寫資料，
 * 然後爆出 foreign key violation —— 錯誤訊息完全看不出原因，
 * 而且這台裝置從此再也寫不進東西。
 *
 * 所以拿到 session 之後要跟伺服器確認一次；人不在就丟掉重新登入。
 */
export async function ensureSession() {
  const sb = await client();
  if (!sb) return null;
  if (sessionUser) return sessionUser;

  const { data: { session } } = await sb.auth.getSession();

  if (session) {
    const { data, error } = await sb.auth.getUser();
    if (!error && data?.user) {
      sessionUser = data.user;
      return sessionUser;
    }
    console.warn('[燈燈] 本機的登入資料已失效，重新登入');
    // scope local：伺服器那邊的帳號可能已經不在了，別再打過去
    await sb.auth.signOut({ scope: 'local' }).catch(() => {});
  }

  const { data, error } = await sb.auth.signInAnonymously();
  if (error) {
    console.warn('[燈燈] 匿名登入失敗', error.message);
    return null;
  }
  sessionUser = data.user;
  return sessionUser;
}

export async function myUserId() {
  const u = await ensureSession();
  return u ? u.id : null;
}

/** 一律走這支呼叫 RPC，省掉每個地方都寫一次防呆。 */
async function rpc(name, args, { silent = false } = {}) {
  const sb = await client();
  const user = await ensureSession();
  if (!sb || !user) {
    if (silent) return null;
    throw new Error('目前沒有連上伺服器');
  }
  const { data, error } = await sb.rpc(name, args);
  if (error) {
    if (silent) {
      console.warn(`[燈燈] ${name} 失敗`, error.message);
      return null;
    }
    throw new Error(error.message);
  }
  return data;
}

/** 把本機的名字同步成 profile。 */
export async function syncProfile() {
  const sb = await client();
  const user = await ensureSession();
  if (!sb || !user) return null;
  const me = S.me();
  const { error } = await sb.from('profiles').upsert({
    id: user.id,
    display_name: me.name || '無名',
    avatar_char: me.avatarChar || '燈',
  });
  if (error) console.warn('[燈燈] profile 同步失敗', error.message);
  return user.id;
}

/* ── 群組 ── */

/** 我加入的所有群。順便寫回本機，離線時選單還有東西可顯示。 */
export async function myGroups({ silent = true } = {}) {
  const rows = await rpc('my_groups', {}, { silent });
  if (!rows) return null;
  const groups = rows.map((g) => ({
    id: g.id,
    name: g.name,
    inviteCode: g.invite_code,
    memberCount: g.member_count,
    isOwner: g.is_owner,
  }));
  S.setGroups(groups);
  return groups;
}

export async function createGroup(name) {
  await syncProfile();
  const data = await rpc('create_group', { group_name: name });
  const g = Array.isArray(data) ? data[0] : data;
  await myGroups({ silent: false });
  return { id: g.id, name: g.name, inviteCode: g.invite_code };
}

/**
 * 用邀請碼加入。
 * 走 RPC 而不是直接查 groups——groups 的 RLS 只讓你看到已經加入的群，
 * 不然任何人都能把所有群的邀請碼撈出來。
 */
export async function joinGroup(code) {
  await syncProfile();
  const data = await rpc('join_group', { code });
  const g = Array.isArray(data) ? data[0] : data;
  if (!g) throw new Error('找不到這個邀請碼');
  await myGroups({ silent: false });
  return { id: g.id, name: g.name };
}

/* ── 發布 ── */

/**
 * 把某一天的燈發布出去，同時分享到指定的幾個群。
 * groupIds 傳空陣列 = 收回全部分享（燈還是你的，只是不公開）。
 */
export async function publishLamp(day, groupIds) {
  if (!day.lamp) return null;

  // 只送公開的那幾則，私密的永遠不會離開這台裝置。
  const entries = (day.entries || []).map((e) => ({
    kind: e.kind,
    text: e.text,
    ...(e.pages ? { pages: e.pages } : {}),
  }));
  const pages = entries.reduce((a, e) => a + (e.pages || 0), 0);

  return rpc('publish_lamp', {
    p_day: day.date,
    p_lamp: day.lamp,
    p_entries: entries,
    p_pages: pages,
    p_groups: groupIds || [],
  });
}

/** 取消某一天的公開。 */
export async function unpublishLamp(day) {
  return publishLamp(day, []);
}

/* ── 共同燈海 ── */

/**
 * 一片天空：某個群在 from~to 這段日期裡的燈。
 * 200 人的群一段時間仍可能幾百盞，所以還是保留 limit，
 * 畫不完的用 groupSeaStats() 的總數據實說。
 */
export async function groupSea(groupId, from, to, limit = 150) {
  const rows = await rpc('group_sea', {
    g: groupId, p_from: from, p_to: to, p_limit: limit,
  }, { silent: true });
  if (!rows) return null;
  return rows.map((r) => ({
    id: r.id,
    date: r.day,
    lamp: r.lamp,
    entryCount: r.entry_count,
    pages: r.pages,
    authorName: r.author_name || '無名',
    authorChar: r.author_char || '燈',
    authorId: r.author_id,
    joyCount: Number(r.joy_count || 0),
    joinedByMe: Boolean(r.joined_by_me),
    replyCount: Number(r.reply_count || 0),
  }));
}

/** 這片天空的總數。可能比畫出來的多。 */
export async function groupSeaStats(groupId, from, to) {
  const rows = await rpc('group_sea_stats', { g: groupId, p_from: from, p_to: to }, { silent: true });
  const r = Array.isArray(rows) ? rows[0] : rows;
  if (!r) return null;
  return {
    lamps: Number(r.lamps || 0),
    authors: Number(r.authors || 0),
    entries: Number(r.entries || 0),
    pages: Number(r.pages || 0),
    members: Number(r.members || 0),
  };
}

/** 往回翻：上一片有燈的天空結束在哪一天。回 null 表示再往前就沒有了。 */
export async function prevSkyDay(groupId, beforeDate) {
  return rpc('group_sea_prev_day', { g: groupId, p_before: beforeDate }, { silent: true });
}

/** 點開某一盞燈才拉完整內容。 */
export async function lampDetail(lampId) {
  const rows = await rpc('lamp_detail', { l: lampId }, { silent: true });
  const r = Array.isArray(rows) ? rows[0] : rows;
  if (!r) return null;
  return {
    id: r.id,
    date: r.day,
    lamp: r.lamp,
    entries: r.entries || [],
    authorName: r.author_name || '無名',
    authorChar: r.author_char || '燈',
    authorId: r.author_id,
    joyCount: Number(r.joy_count || 0),
    joinedByMe: Boolean(r.joined_by_me),
    replies: r.replies || [],
  };
}

/* ── 互動 ── */

/** 隨喜／取消隨喜。回傳這盞燈現在有沒有被我隨喜。 */
export async function toggleJoy(lampId, on) {
  const sb = await client();
  const user = await ensureSession();
  if (!sb || !user) throw new Error('目前沒有連上伺服器');

  if (on) {
    const { error } = await sb.from('reactions')
      .upsert({ lamp_id: lampId, user_id: user.id, kind: 'joy' });
    if (error) throw new Error(error.message);
    return true;
  }
  const { error } = await sb.from('reactions')
    .delete().eq('lamp_id', lampId).eq('user_id', user.id).eq('kind', 'joy');
  if (error) throw new Error(error.message);
  return false;
}

/** 短回應。字數在資料庫端也有 CHECK 約束，不是只靠前端擋。 */
export async function reply(lampId, body) {
  const sb = await client();
  const user = await ensureSession();
  if (!sb || !user) throw new Error('目前沒有連上伺服器');
  const { error } = await sb.from('replies')
    .insert({ lamp_id: lampId, author_id: user.id, body: body.slice(0, 60) });
  if (error) throw new Error(error.message);
}

/** 本月大眾合計。只有總數，沒有個人排名。 */
export async function monthlyTotals(groupId) {
  const rows = await rpc('group_month_totals', { g: groupId }, { silent: true });
  const r = Array.isArray(rows) ? rows[0] : rows;
  if (!r) return null;
  return {
    lamps: Number(r.lamps || 0),
    entries: Number(r.entries || 0),
    pages: Number(r.pages || 0),
    members: Number(r.members || 0),
  };
}

export { isOnlineMode };
