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

/* ── 一片天空幾天 ──
 *
 * 不寫死。10 人的群和 200 人的群差 20 倍，固定天數一定有一邊很難看。
 * 依群組最近的實際發文量回推，讓每片天空大約落在目標盞數。
 *
 *   畫面上舒服的密度大概是 40–120 盞：
 *   低於 20 顯得空蕩，高於 150 就糊成一片光。
 */
export const SKY_TARGET_LAMPS = 80;
export const SKY_MIN_DAYS = 1;
export const SKY_MAX_DAYS = 30;
export const SKY_DEFAULT_DAYS = 3;

/** 一片天空最多畫幾盞。超過的據實說「畫出其中 N 盞」。 */
export const SKY_RENDER_CAP = 150;

/** 依最近 30 天的平均每日盞數，回推一片天空該涵蓋幾天。 */
export function skyDaysFor(lampsLast30Days) {
  const perDay = (lampsLast30Days || 0) / 30;
  if (perDay <= 0) return SKY_DEFAULT_DAYS;
  const days = Math.round(SKY_TARGET_LAMPS / perDay);
  return Math.max(SKY_MIN_DAYS, Math.min(SKY_MAX_DAYS, days));
}

/** 預設誦的經。 */
export const DEFAULT_SUTRA = '大般若經';

/** 本月大眾共修目標（頁）。之後可以改成每個群自己設。 */
export const MONTHLY_GOAL = 500;

export const isOnlineMode = () => Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
