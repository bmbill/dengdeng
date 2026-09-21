/* 燈燈悅心 — 資料層
 *
 * Local-first：每一筆都先寫進 localStorage，立刻看得到結果，
 * 之後才推去 Supabase。網路壞掉、Supabase 還沒設定，app 都照樣能用。
 */

import { DEFAULT_SUTRA, MAX_ENTRIES_PER_DAY } from './config.js';
import { makeLamp, TIER_RANK } from './lamp.js';

const KEY_DAYS = 'dd_days';
const KEY_ME = 'dd_me';
const KEY_QUEUE = 'dd_sync_queue';
const KEY_UID = 'dd_uid';

/* ── 日期 ── */

export function todayStr(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function shiftDate(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return todayStr(dt);
}

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const CN = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

/** 1–31 的國字。十一、二十、二十一、三十一。 */
function cnNum(n) {
  if (n <= 10) return CN[n];
  if (n < 20) return `十${CN[n - 10]}`;
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return `${CN[tens]}十${ones ? CN[ones] : ''}`;
}

export function prettyDate(dateStr = todayStr()) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${cnNum(m)}月${cnNum(d)}日 · 星期${WEEK[dt.getDay()]}`;
}

/* ── 讀寫 ── */

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // 無痕模式、儲存空間滿了：畫面照跑，只是這次沒存下來。
    return false;
  }
}

/* ── 我 ── */

export function me() {
  let m = read(KEY_ME, null);
  if (!m) {
    m = {
      id: crypto.randomUUID(),
      name: '',
      avatarChar: '燈',
      joinedAt: new Date().toISOString(),
      groups: [],        // [{id, name, inviteCode, memberCount, isOwner}]
      shareTo: [],       // 預設要發到哪幾個群的 id
    };
    write(KEY_ME, m);
  }
  // 舊版只存單一 groupId，補成陣列
  if (!Array.isArray(m.groups)) m.groups = [];
  if (!Array.isArray(m.shareTo)) m.shareTo = [];
  return m;
}

export function setMe(patch) {
  const next = { ...me(), ...patch };
  if (next.name) next.avatarChar = next.name.trim().slice(-1) || '燈';
  write(KEY_ME, next);
  return next;
}

/** 我加入的群。從伺服器同步回來後寫在這裡，離線時選單還有東西可顯示。 */
export function setGroups(groups) {
  const ids = new Set(groups.map((g) => g.id));
  const m = me();
  return setMe({
    groups,
    // 已經退出的群要從預設分享名單裡拿掉
    shareTo: m.shareTo.filter((id) => ids.has(id)),
  });
}

export function myGroups() {
  return me().groups;
}

/** 預設要發到哪幾個群。第一次加入群時自動全選——多數人想要的就是這個。 */
export function shareTargets() {
  const m = me();
  if (m.shareTo.length) return m.shareTo;
  return m.groups.map((g) => g.id);
}

export function setShareTargets(ids) {
  return setMe({ shareTo: [...new Set(ids)] });
}

/* ── 一天 ── */

/**
 * 一天就是一串「則」。
 *
 * 刻意不做成「四格都要填滿才算數」——那比隨手寫一句難太多，
 * 是會把人累垮的那種設計。一則短短的燈就亮了；多寫只是讓你
 * 比較可能遇到少見的燈，不是門檻。
 *
 * entry = { id, kind, text, pages?, postId?, at }
 *   kind: deed 善行點滴 / gratitude 觀功念恩 / sutra 誦經 / note 其他
 */
export const KINDS = {
  deed:      { name: '善行點滴', short: '善行' },
  gratitude: { name: '觀功念恩', short: '念恩' },
  sutra:     { name: '誦經',     short: '誦經' },
  note:      { name: '其他',     short: '其他' },
};

export function emptyDay(date) {
  return {
    date,
    entries: [],          // 你自己寫的，一天最多 MAX_ENTRIES_PER_DAY 則
    joys: [],             // 你隨喜出去的，不佔額度
    sutraName: DEFAULT_SUTRA,
    lamp: null,
    sealedAt: null,
    isPublic: false,
    draws: 0,             // 今天抽過幾次。一則一抽，只往上換
    askedShare: false,    // 今天問過「要發到哪幾個群」了沒
  };
}

/** 舊資料或缺欄位的防呆，讀出來一律補齊。 */
function normalize(day) {
  if (!Array.isArray(day.entries)) day.entries = [];
  if (!Array.isArray(day.joys)) day.joys = [];
  return day;
}

export function allDays() {
  return read(KEY_DAYS, {});
}

export function getDay(date = todayStr()) {
  const d = allDays()[date];
  return d ? normalize(d) : emptyDay(date);
}

function saveDay(day) {
  const days = allDays();
  days[day.date] = day;
  write(KEY_DAYS, days);
  queue({ type: 'day', date: day.date, at: Date.now() });
  return day;
}

/** 當天各類別各幾則，以及總頁數。 */
export function countsOf(day) {
  const c = {
    deed: 0, gratitude: 0, sutra: 0, note: 0,
    pages: 0, total: day.entries.length, joys: day.joys.length,
  };
  for (const e of day.entries) {
    c[e.kind] = (c[e.kind] || 0) + 1;
    c.pages += e.pages || 0;
  }
  return c;
}

export function entriesLeft(day) {
  return Math.max(0, MAX_ENTRIES_PER_DAY - day.entries.length);
}

/** 換算成給 lamp.js 用的當日統計。 */
export function statsOf(day) {
  const c = countsOf(day);
  return {
    date: day.date,
    deeds: c.deed,
    // 隨喜出去的也算念恩——你確實動了那個心，只是沒有寫成一則。
    gratitude: c.gratitude + c.joys,
    sutras: c.sutra,
    notes: c.note,
    pages: c.pages,
    total: c.total,
    joys: c.joys,
    // 今天寫了幾種不同的事。三種以上是難得的一天，燈身會是泥金。
    kinds: ['deed', 'gratitude', 'sutra', 'note'].filter((k) => c[k] > 0).length,
  };
}

/* ── 寫入動作 ── */

/**
 * 寫一則。這是唯一的寫入口。一天最多 MAX_ENTRIES_PER_DAY 則。
 * @param {{kind?:string, text:string, pages?:number}} entry
 * @returns {{day:object, ok:boolean, reason?:string}}
 */
export function addEntry(entry, date = todayStr()) {
  const day = getDay(date);
  if (day.entries.length >= MAX_ENTRIES_PER_DAY) return { day, ok: false, reason: 'full' };

  const kind = KINDS[entry.kind] ? entry.kind : 'deed';
  const text = (entry.text || '').trim();
  if (!text) return { day, ok: false, reason: 'empty' };

  day.entries.push({
    id: crypto.randomUUID(),
    kind,
    text,
    ...(entry.pages ? { pages: Math.max(0, Math.round(entry.pages)) } : {}),
    at: new Date().toISOString(),
  });
  saveDay(day);

  // 寫下去就供燈。第一則把燈供上去，之後每一則讓它跟著今天的紀錄長
  // （顏色與焰色會變，形制要自己按「再抽一次」）。
  return { day: day.sealedAt ? refreshLamp(date) : seal(date), ok: true };
}

/**
 * 移掉一則。
 *
 * 燈已經亮著也照移——打錯字不該變成今天的紀錄。
 * 移到一則不剩、也沒隨喜過，那今天本來就沒發生什麼，燈跟著收掉。
 */
export function removeEntry(id, date = todayStr()) {
  const day = getDay(date);
  day.entries = day.entries.filter((e) => e.id !== id);
  saveDay(day);

  if (!day.sealedAt) return day;
  if (day.entries.length || day.joys.length) return refreshLamp(date);

  day.lamp = null;
  day.sealedAt = null;
  day.draws = 0;
  day.isPublic = false;
  return saveDay(day);
}

/**
 * 隨喜別人的一盞燈。
 * 刻意不佔那 3 則的額度 —— 那 3 則是「你寫下來的」，
 * 隨喜是「你給出去的」，不是同一件事。
 */
export function addJoy(lampId, meta = {}, date = todayStr()) {
  const day = getDay(date);
  // 今天的燈已經供過了也照記。燈是鑄好了不會變，
  // 但「我今天隨喜了誰」是發生過的事，沒有理由不留下來。
  if (day.joys.some((j) => j.lampId === lampId)) return day;
  day.joys.push({ lampId, ...meta, at: new Date().toISOString() });
  saveDay(day);

  // 一整天只隨喜、沒寫東西，燈一樣亮——只是不會自己跑去群裡，
  // 要等你寫第一則的時候才問要不要發。
  return day.sealedAt ? refreshLamp(date) : seal(date);
}

export function removeJoy(lampId, date = todayStr()) {
  const day = getDay(date);
  day.joys = day.joys.filter((j) => j.lampId !== lampId);
  saveDay(day);

  if (!day.sealedAt) return day;
  if (day.entries.length || day.joys.length) return refreshLamp(date);

  // 今天只有那一下隨喜，收回來就等於今天還沒開始
  day.lamp = null;
  day.sealedAt = null;
  day.draws = 0;
  return saveDay(day);
}

export function hasJoyFor(lampId, date = todayStr()) {
  return getDay(date).joys.some((j) => j.lampId === lampId);
}

export function setSutraName(name, date = todayStr()) {
  const day = getDay(date);
  day.sutraName = (name || '').trim() || DEFAULT_SUTRA;
  return saveDay(day);
}

export function setPublic(isPublic, date = todayStr()) {
  const day = getDay(date);
  day.isPublic = Boolean(isPublic);
  day.askedShare = true;
  return saveDay(day);
}

/**
 * 發布成功後記下伺服器那邊的燈 id。
 * 有了它，你才看得到自己那盞燈被誰隨喜、有沒有人說話——
 * 「有人看到我做的事」這個迴路缺了它就接不起來。
 */
export function setRemoteId(id, date = todayStr()) {
  const day = getDay(date);
  day.remoteId = id;
  return saveDay(day);
}

/* ── 供燈 ──
 *
 * 沒有「供燈」按鈕了。寫下第一則的當下燈就亮，寫一句就看得到結果。
 *
 * 本來是寫完自己按一下才開獎，結果變成：想多寫幾則再按比較划算，
 * 於是一直不按，然後忘記，隔天被系統補供——最該屬於你的那一下
 * 反而是系統按的。現在倒過來：第一則就供上去，之後每補一則多一次
 * 重抽的機會，而且只往上，所以晚點寫不會讓人覺得虧。
 */

/** 今天可以抽幾次：寫幾則就幾次。只隨喜沒寫的日子也有一次。 */
export function drawsAllowed(day) {
  return Math.max(1, Math.min(MAX_ENTRIES_PER_DAY, day.entries.length));
}

export function drawsLeft(day) {
  if (!day.lamp) return 0;
  return Math.max(0, drawsAllowed(day) - (day.draws || 1));
}

/** 第 n 抽的燈長什麼樣。同一個 n 永遠一樣，所以重新整理不會換獎。 */
function buildLamp(day, draw) {
  return makeLamp(statsOf(day), {
    streak: streakEndingAt(shiftDate(day.date, -1)) + 1,
    // 舊資料沒存這個旗標，用名字認出來
    isFirstEver: day.isFirst ?? (day.lamp?.name === '初發心燈'),
    seedSalt: me().id,
    draw,
  });
}

export function seal(date = todayStr()) {
  const day = getDay(date);
  if (day.sealedAt || (day.entries.length < 1 && day.joys.length < 1)) return day;

  day.isFirst = lamps().length === 0;
  day.draws = 1;
  day.lamp = buildLamp(day, 1);
  day.sealedAt = new Date().toISOString();
  return saveDay(day);
}

/**
 * 讓燈跟上今天的紀錄。
 *
 * 顏色與焰色本來就不是抽的——是「今天寫了什麼、寫了多少」算出來的，
 * 所以補寫一則之後它們該跟著變。形制是運氣，不在這裡動：
 * 那要自己按「再抽一次」。
 */
export function refreshLamp(date = todayStr()) {
  const day = getDay(date);
  if (!day.lamp || date !== todayStr()) return day;

  const next = buildLamp(day, day.draws || 1);
  day.lamp = { ...next, form: day.lamp.form, tier: day.lamp.tier, name: day.lamp.name };
  return saveDay(day);
}

/**
 * 再抽一次。
 *
 * 只往上：抽到比現在這盞難得才換，不然留著原本那盞。
 * 補寫一則是「多一次機會」，不是「拿已經到手的燈去賭」——
 * 不然就會有人為了不弄丟難得的燈而不敢再寫。
 *
 * @returns {{drawn, before, kept, lamp, left}|null}
 */
export function redraw(date = todayStr()) {
  const day = getDay(date);
  if (!day.lamp || date !== todayStr() || drawsLeft(day) <= 0) return null;

  const before = day.lamp;
  day.draws = (day.draws || 1) + 1;

  const drawn = buildLamp(day, day.draws);
  const kept = TIER_RANK[drawn.tier] > TIER_RANK[before.tier];
  // 沒換形制也要收下新的顏色：那是今天多寫的那一則算出來的。
  day.lamp = kept ? drawn : { ...drawn, form: before.form, tier: before.tier, name: before.name };
  saveDay(day);

  return { drawn, before, kept, lamp: day.lamp, left: drawsLeft(day) };
}

/**
 * 補上沒亮起來的燈。
 *
 * 改成「寫下去就供燈」之後，這裡多半沒事做了——留著是因為
 * 舊版本存下來的日子還沒有燈，以及偶爾寫得進 localStorage、
 * 燈卻沒存成功的意外。只補「過去」的：今天的不補，
 * 今天要嘛已經亮了，要嘛你還沒寫。
 *
 * @returns 補了哪幾天
 */
export function sealOverdue() {
  const today = todayStr();
  const done = [];

  for (const date of Object.keys(allDays()).sort()) {
    if (date >= today) continue;
    const d = getDay(date);
    if (d.sealedAt) continue;
    if (d.entries.length < 1 && d.joys.length < 1) continue;
    if (seal(date).lamp) done.push(date);
  }
  return done;
}

/* ── 統計 ── */

export function lamps() {
  return Object.values(allDays())
    .filter((d) => d.lamp)
    .map(normalize)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** 從某一天往回數，連續幾天有燈。 */
export function streakEndingAt(date) {
  const days = allDays();
  let n = 0;
  let cursor = date;
  while (days[cursor] && days[cursor].lamp) {
    n += 1;
    cursor = shiftDate(cursor, -1);
  }
  return n;
}

/** 目前的連續天數。今天還沒供燈不算斷，從昨天起算。 */
export function currentStreak() {
  const t = todayStr();
  return getDay(t).lamp ? streakEndingAt(t) : streakEndingAt(shiftDate(t, -1));
}

export function longestStreak() {
  const dates = lamps().map((d) => d.date);
  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of dates) {
    run = prev && shiftDate(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/** 距離上一盞燈隔了幾天。用來決定燈童要不要講「回來了」。 */
export function gapDays() {
  const list = lamps();
  if (!list.length) return 0;
  const last = list[list.length - 1].date;
  const t = todayStr();
  let n = 0;
  let cursor = shiftDate(t, -1);
  while (cursor > last) {
    n += 1;
    cursor = shiftDate(cursor, -1);
  }
  return n;
}

export function totals() {
  const days = Object.values(allDays()).map(normalize);
  const t = { lamps: 0, pages: 0, entries: 0, joys: 0, deed: 0, gratitude: 0, sutra: 0, note: 0 };
  for (const d of days) {
    if (d.lamp) t.lamps += 1;
    const c = countsOf(d);
    t.pages += c.pages;
    t.entries += c.total;
    t.joys += c.joys;
    t.deed += c.deed;
    t.gratitude += c.gratitude;
    t.sutra += c.sutra;
    t.note += c.note;
  }
  return t;
}

/** 某個月每一天的燈（沒有就是 null），給月曆用。 */
export function monthGrid(year, month) {
  const days = allDays();
  const last = new Date(year, month, 0).getDate();
  const p = (n) => String(n).padStart(2, '0');
  const out = [];
  for (let d = 1; d <= last; d++) {
    const key = `${year}-${p(month)}-${p(d)}`;
    out.push({ date: key, lamp: days[key] ? days[key].lamp : null });
  }
  return out;
}

/* ── 同步佇列 ──
 * Supabase 還沒接上時，動作先排隊，接上之後再一次推上去。 */

function queue(item) {
  const q = read(KEY_QUEUE, []);
  q.push(item);
  write(KEY_QUEUE, q.slice(-500));
}

export function pendingSync() {
  return read(KEY_QUEUE, []);
}

export function clearSync() {
  write(KEY_QUEUE, []);
}

/* ── 匯出／匯入（換手機用） ── */

export function exportAll() {
  return JSON.stringify({ v: 1, me: me(), days: allDays() }, null, 2);
}

export function importAll(json) {
  const data = JSON.parse(json);
  if (!data || data.v !== 1) throw new Error('檔案格式不對');
  write(KEY_ME, data.me);

  const days = data.days || {};
  for (const d of Object.values(days)) delete d.remoteId;
  write(KEY_DAYS, days);
  return true;
}

/**
 * remoteId 是「這盞燈在伺服器上的 id」，而伺服器上的燈掛在某個身分底下。
 * 一換身分，那些 id 就不是你的了。留著會有兩個後果：補送時被當成
 * 「已經送過」而跳過，以及「誰隨喜了我」跑去讀別人的燈。
 * @returns 清掉幾個
 */
export function dropRemoteIds() {
  const days = allDays();
  let n = 0;
  for (const d of Object.values(days)) if (d.remoteId) { delete d.remoteId; n += 1; }
  if (n) write(KEY_DAYS, days);
  return n;
}

/**
 * 記住這台裝置現在用的是哪個身分。換了人就把 remoteId 全部作廢。
 *
 * 會換人的情況比想像中多：匯入別台的備份、伺服器上的帳號被刪掉、
 * 整個專案重建。每一種都會讓本機那堆 remoteId 變成指向別人的燈，
 * 而且症狀都一樣難查——燈明明標記公開，群裡就是看不到。
 * 在這裡一次擋掉，比在每個呼叫點各自處理可靠。
 */
export function noteUserId(id) {
  if (!id) return false;
  const prev = read(KEY_UID, null);
  if (prev === id) return false;
  write(KEY_UID, id);
  // 第一次登入沒有 prev，那不算換人（匯入時 importAll 已經清過了）
  if (!prev) return false;
  dropRemoteIds();
  return true;
}
