-- 燈燈悅心 — profiles.last_seen
--
-- 「這個身分現在還有人在用嗎」這件事，伺服器原本答不出來。
-- 一台裝置換了身分之後，舊的那個從資料上看跟活著的沒兩樣——
-- 要合併的時候就只能猜方向，而猜錯會把人正在用的那台標記成退休。
--
-- syncProfile() 每次開 app 都會跑，順手把時間記下來就有答案了。
-- 只加欄位，不動 policy：profiles 的 update 本來就限定自己那一列。

alter table profiles add column if not exists last_seen timestamptz;

-- 現在誰還活著
-- select display_name, id, last_seen from profiles order by last_seen desc nulls last;
