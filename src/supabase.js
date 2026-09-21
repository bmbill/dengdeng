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
        console.warn('[燈燈悅心] Supabase 載入失敗，改用單機模式', e);
        return null;
      }
    })();
  }
  return clientPromise;
}

let sessionUser = null;
let sessionPromise = null;

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
  if (sessionUser) return sessionUser;

  // 同時進來的呼叫共用同一個登入。
  // sessionUser 要等 await 回來才設定，所以沒有這道鎖的話，
  // Promise.all 同時發兩個 RPC 會讓兩邊都看到 null、
  // 兩邊都去 signInAnonymously()，生出兩個匿名身分——
  // 其中一個立刻變成沒人認領的孤兒。
  if (sessionPromise) return sessionPromise;

  sessionPromise = openSession().finally(() => { sessionPromise = null; });
  return sessionPromise;
}

async function openSession() {
  const sb = await client();
  if (!sb) return null;

  const { data: { session } } = await sb.auth.getSession();

  if (session) {
    const { data, error } = await sb.auth.getUser();
    if (!error && data?.user) {
      sessionUser = data.user;
      S.noteUserId(sessionUser.id);
      return sessionUser;
    }
    // 只有伺服器明確說「這個 token 不算數」才丟掉。
    //
    // getUser() 失敗的原因不只一種：網路不通、GoTrue 那一下在忙
    // （例如剛好有人在後台大量刪身分，auth.users 被鎖住）。
    // 把那些也當成帳號沒了，裝置就會無聲無息換一個新的匿名身分，
    // 跟自己所有的紀錄和群斷掉——比起暫時連不上，那個難修太多了。
    // 分不出來的時候，寧可沿用本機這份。
    const status = error?.status;
    if (status !== 401 && status !== 403) {
      console.warn('[燈燈悅心] 問不到伺服器，先沿用本機的登入', error?.message);
      sessionUser = session.user;
      S.noteUserId(sessionUser.id);
      return sessionUser;
    }

    console.warn('[燈燈悅心] 本機的登入資料已失效，重新登入');
    // scope local：伺服器那邊的帳號可能已經不在了，別再打過去
    await sb.auth.signOut({ scope: 'local' }).catch(() => {});
  }

  const { data, error } = await sb.auth.signInAnonymously();
  if (error) {
    console.warn('[燈燈悅心] 匿名登入失敗', error.message);
    return null;
  }
  sessionUser = data.user;
  // 剛換了身分（帳號被刪、專案重建、從別台匯過來）的話，
  // 本機那些 remoteId 就作廢了，不然補送會以為早就送過。
  S.noteUserId(sessionUser.id);
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
      console.warn(`[燈燈悅心] ${name} 失敗`, error.message);
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
  if (error) console.warn('[燈燈悅心] profile 同步失敗', error.message);
  return user.id;
}

/* ── 群組 ── */

/**
 * 伺服器說我一個群都沒有，可是本機記著群、還記著邀請碼——
 * 這個組合只有一個意思：身分換了（匯入了別台的備份、帳號被刪掉、
 * 專案重建）。拿本機那些邀請碼自己接回去。
 *
 * 用 rpc 而不是 joinGroup()，因為 joinGroup() 會回頭呼叫 myGroups()。
 * @returns 有沒有接回任何一個
 */
async function rejoinFromLocal() {
  const codes = S.myGroups().map((g) => g.inviteCode).filter(Boolean);
  if (!codes.length) return false;

  await syncProfile().catch(() => {});
  let ok = 0;
  for (const code of codes) {
    try {
      await rpc('join_group', { code });
      ok += 1;
    } catch (e) {
      // 這台已經被接走了。再試下去只會把同一則錯誤跑一遍，
      // 而且真的接回去的話群裡就會多出一個同名的人。
      if (isRetired(e)) { retiredMsg = e.message; return 'retired'; }
      console.warn('[燈燈悅心] 用邀請碼接回失敗', code, e.message);
    }
  }
  return ok > 0;
}

/** 伺服器說這個身分已經被另一台手機接走了。 */
function isRetired(e) {
  return String(e?.message || '').includes('接到另一台手機');
}

// 被接走的裝置，開場對帳時要講一句。myGroups() 自己會把這個狀況
// 吞掉（回 null 才不會洗掉本機的群組清單），所以記在這裡讓 catchUp 拿。
let retiredMsg = null;

/**
 * 我加入的所有群。順便寫回本機，離線時選單還有東西可顯示。
 *
 * 伺服器回空陣列是「成功」的回應，所以會一路走到 setGroups([])，
 * 把本機那份連同邀請碼一起洗掉——連自己接回去的路都沒了。
 * 所以在寫回去之前先試著接回來：換了身分的人不該因此弄丟群。
 */
export async function myGroups({ silent = true, heal = true } = {}) {
  const rows = await rpc('my_groups', {}, { silent });
  if (!rows) return null;

  if (!rows.length && heal) {
    const healed = await rejoinFromLocal();
    // 被接走的裝置：不要把本機那份群組清單洗掉。
    // 它已經寫不進東西了，清單留著至少畫面上還看得懂發生什麼事。
    if (healed === 'retired') return null;
    // heal: false —— 接回去之後還是空的就認了，不要無限重試
    if (healed) return myGroups({ silent, heal: false });
  }

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

/**
 * 補送「標記為公開、但其實沒在群裡」的燈。
 *
 * 要補的原因不只一種：供燈時還沒加入任何群、當下離線、
 * 或者那幾天是在別的身分底下供的（換手機、匯入備份）。
 *
 * 判斷「這一天到底送到了沒」要問伺服器，不能看本機的 remoteId——
 * 那個標記只記得「發布這個動作成功過」，不記得發布到了哪裡。
 * 一盞在還沒加入群的時候供的燈照樣拿得到 remoteId，於是被跳過，
 * 可是它一個群都沒進。my_shared_days() 直接從 lamp_shares 回答，
 * 而且只算 auth.uid() 自己的，所以上面那幾種情況一次蓋掉。
 *
 * 刻意不補「沒標記公開」的：加入新群不該把過去的私人紀錄倒進去。
 * 也刻意信任伺服器說「這天有分享」——那幾天可能是使用者自己挑了
 * 某幾個群，不該被補送推到其他群去。
 *
 * @returns 補送了幾盞
 */
export async function resendPublic({ limit = 90 } = {}) {
  const groupIds = S.shareTargets();
  if (!groupIds.length) return 0;

  const rows = await rpc('my_shared_days', {}, { silent: true });
  // 問不到就不要亂猜。整批重送的代價比少送一次高。
  if (!rows) return 0;
  // setof date 回來可能是 ['2026-09-19'] 也可能是 [{my_shared_days:'2026-09-19'}]，
  // 看 PostgREST 版本。兩種都接。
  const done = new Set(rows.map((r) => (typeof r === 'string' ? r : Object.values(r)[0])));

  const pending = S.lamps()
    .filter((d) => d.isPublic && !done.has(d.date))
    .slice(-limit)
    .reverse();

  let n = 0;
  for (const day of pending) {
    try {
      // 一盞一盞來。並行只會讓失敗更難查，而且這是背景工作，不急。
      const id = await publishLamp(day, groupIds);
      if (id) { S.setRemoteId(id, day.date); n += 1; }
    } catch (e) {
      console.warn('[燈燈悅心] 補送失敗', day.date, e.message);
    }
  }
  return n;
}

/**
 * 開 app 時對一次帳。
 *
 * 做兩件事：把群組清單抓下來，然後補送漏掉的燈。
 *
 * 之所以要放在啟動而不是只放在「匯入」和「加入群」之後，是因為
 * 燈沒送出去的原因不只一種——供燈時剛好離線、伺服器那一下出錯、
 * 或者被管理員直接加進群（本機從來沒經手過）。與其一個一個補，
 * 不如每次開 app 都對一次；沒事的時候 pending 是空的，不花什麼。
 *
 * 一律安靜失敗：這是背景工作，沒連上就下次再說。
 * @returns 補送了幾盞
 */
export async function catchUp() {
  if (!isOnlineMode()) return { sent: 0 };
  try {
    // 名字放在這裡同步，不放在加入群的時候——被管理員直接加進群的人
    // 從來不會經過那條路，群裡就會看到一個「無名」。
    await syncProfile();
    const groups = await myGroups();
    if (retiredMsg) return { sent: 0, retired: retiredMsg };
    if (!groups || !groups.length) return { sent: 0 };
    return { sent: await resendPublic() };
  } catch (e) {
    if (isRetired(e)) return { sent: 0, retired: e.message };
    console.warn('[燈燈悅心] 開場對帳失敗', e.message);
    return { sent: 0 };
  }
}

/** 取消某一天的公開。 */
export async function unpublishLamp(day) {
  return publishLamp(day, []);
}

/* ── 換手機 ── */

/**
 * 我的接回碼。伺服器第一次被問到的時候才生成，沒人用到就不存在。
 */
export async function myRecoveryCode() {
  await syncProfile();
  return rpc('my_recovery_code', {});
}

/**
 * 用接回碼把舊身分名下的東西接到現在這個身分底下。
 *
 * 不是「用舊帳號登入」——匿名 session 的 token 只在原本那台裝置上，
 * 伺服器沒辦法再發一次。所以是反過來搬。
 */
export async function reclaimIdentity(code) {
  // 先建 profile：接回那一步要往新身分的 profile 寫名字和碼
  await syncProfile();
  const rows = await rpc('reclaim_identity', { code });
  const r = Array.isArray(rows) ? rows[0] : rows;
  if (!r) throw new Error('接不回來');
  return { name: r.name, lamps: Number(r.lamps || 0), groups: Number(r.groups || 0) };
}

/**
 * 把伺服器上自己的燈抓回本機。
 * 只有公開過的那幾則——沒公開的從來沒離開過原本那台裝置，
 * 那些只能靠備份檔。
 * @returns 補回幾天
 */
export async function pullMyLamps() {
  const rows = await rpc('my_lamps', {}, { silent: true });
  if (!rows) return 0;
  return S.hydrateDays(rows.map((r) => ({
    date: r.day,
    lamp: r.lamp,
    entries: r.entries || [],
  })));
}

/* ── 共同燈海 ── */

/**
 * 一片天空：第 p_back 片（0 = 現在這片，1 = 上一片）。
 * 切點由資料庫依數量算出來，不存狀態，所以不會有「忘記封存」這種事。
 */
export async function groupSky(groupId, back = 0, size) {
  const rows = await rpc('group_sky', { g: groupId, p_back: back, p_size: size }, { silent: true });
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

/** 這片天空的概況：第幾片、滿了沒、涵蓋哪幾天。 */
export async function groupSkyInfo(groupId, back = 0, size) {
  const rows = await rpc('group_sky_info', { g: groupId, p_back: back, p_size: size }, { silent: true });
  const r = Array.isArray(rows) ? rows[0] : rows;
  if (!r) return null;
  return {
    skyNo: Number(r.sky_no || 1),
    totalSkies: Number(r.total_skies || 1),
    filled: Number(r.filled || 0),
    size: Number(r.sky_size || 108),
    isFull: Boolean(r.is_full),
    fromDay: r.from_day,
    toDay: r.to_day,
    authors: Number(r.authors || 0),
    entries: Number(r.entries || 0),
    pages: Number(r.pages || 0),
    members: Number(r.members || 0),
  };
}

/**
 * 同行清單：帶著內文和回應的最近幾盞。
 * 跟 groupSky 分開，是因為燈海只要畫光點，不需要每盞都拉內文——
 * 200 人的群那樣拉一個月會多吃掉將近 1GB 的免費流量。
 */
export async function groupFeed(groupId, limit = 30) {
  const rows = await rpc('group_feed', { g: groupId, p_limit: limit }, { silent: true });
  if (!rows) return null;
  return rows.map((r) => ({
    id: r.id,
    date: r.day,
    lamp: r.lamp,
    entries: r.entries || [],
    entryCount: r.entry_count,
    pages: r.pages,
    authorName: r.author_name || '無名',
    authorChar: r.author_char || '燈',
    authorId: r.author_id,
    joyCount: Number(r.joy_count || 0),
    joinedByMe: Boolean(r.joined_by_me),
    replies: r.replies || [],
  }));
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
