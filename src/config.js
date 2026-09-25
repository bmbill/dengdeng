/* 燈燈悅心 — 設定
 *
 * 兩個值都留空時，app 跑「單機模式」：所有紀錄只存在這台裝置的瀏覽器裡，
 * 共同燈海會顯示未連線。填上之後才會開始同步、才有群組功能。
 *
 * 這把金鑰本來就是公開的（它靠 Supabase 的 Row Level Security 擋權限，
 * 不是靠保密），所以直接寫在這裡、commit 進 git 都沒問題。
 *
 * 真正不能外流的是 sb_secret_... （舊名 service_role）——
 * 那支繞過所有 RLS，永遠不要放進前端。它在 Dashboard 上就在這把的下面，
 * 長得很像，別拿錯。
 *
 * 取得方式：Supabase 專案 → Project Settings → API Keys
 *   Publishable key   sb_publishable_...  （就是下面這個。舊版叫 anon key，
 *                                          是一長串 eyJhbG... 的 JWT，也還能用）
 *   Project URL       https://<Project ID>.supabase.co
 */

export const SUPABASE_URL = 'https://ianytdudabzedqcracve.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_v2M2Lk5XTuBgxaBZD75HKg_BDDMkGGW';

/* ── 一天寫幾則 ──
 *
 * 上限 3 則。不是為了限制你，是為了讓「一則」還是一件事。
 * 可以無限寫的話，寫下來這個動作就不值錢了。
 *
 * 隨喜別人不算在這 3 則裡 —— 那是給出去的，不是寫下來的。
 */
export const MAX_ENTRIES_PER_DAY = 3;

/* ── 一天幾盞燈 ──
 *
 * 一天一盞。算過了：
 *   一則一盞的話，200 人 × 3 則 × 3 天 = 一片天空 1800 盞，
 *   畫面糊成一片，而且每一盞就不代表什麼了。
 *   一天一盞，同樣條件最多 600 盞，實際活躍率算三成大概 180 盞，
 *   是一片看得出層次的夜空。
 *
 * 寫得多不是多幾盞燈，是那一盞比較可能是少見的形制、焰色比較旺。
 */
export const LAMPS_PER_DAY = 1;

/* ── 一片天空 108 盞 ──
 *
 * 數量制，不是時間制。滿了就自動封存，下一盞開新的一片。
 *
 * 為什麼不用時間切：
 *   密度會忽高忽低。冷清的一週是空蕩蕩的天空，
 *   熱鬧的一週糊成一片光，兩邊都不好看。
 *
 * 為什麼是 108：
 *   佛教慣用的數字，而且正好落在畫面舒服的密度範圍。
 *   40–120 盞是耐看的區間：低於 20 顯得空蕩，高於 150 就糊掉。
 *
 * 附帶的好處是它給出一個不是排行榜的共同目標：這片天空 87 / 108。
 * 人多的群天空換得快，那本身就是群體動能的樣子。
 */
export const SKY_SIZE = 108;

/** 一片天空最多畫幾盞。超過的據實說「畫出其中 N 盞」。 */
export const SKY_RENDER_CAP = 150;

/** 預設誦的經。 */
export const DEFAULT_SUTRA = '大般若經';

/** 本月大眾共修目標（頁）。之後可以改成每個群自己設。 */
export const MONTHLY_GOAL = 500;

export const isOnlineMode = () => Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

/* ── 推播 ──
 *
 * 兩個都填了才會出現「每天提醒」那一區；留空就整個藏起來。
 *
 * PUSH_URL 是另外一支 Cloudflare Worker（push/ 目錄），跟網站本身分開部署——
 * 推播要在沒人開著網頁的時候發，那得有個一直醒著的東西，
 * 靜態網站做不到。部署步驟寫在 push/index.js 最上面。
 *
 * VAPID 公鑰跟 Supabase 那把一樣是公開的：它只是讓推播服務認得
 * 「這則是誰發的」。私鑰在 Worker 的 secret 裡，不在這裡。
 */
export const PUSH_URL = '';
export const VAPID_PUBLIC = '';

export const isPushMode = () => Boolean(PUSH_URL && VAPID_PUBLIC);
