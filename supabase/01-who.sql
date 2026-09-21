-- 燈燈悅心 — 看清楚有哪些身分（唯讀，不會改任何東西）
--
-- 一定要從 auth.users 查，不能從 profiles 查：
-- profiles 只有在 syncProfile() 被呼叫時才建立，而那支只在
-- 「取名字」「開群」「加入群」時跑。用匯入檔換手機的人，
-- dd_me 裡已經有名字 → 取名畫面跳過 → syncProfile 從沒被呼叫
-- → 匿名身分在 auth.users 裡有、profiles 裡沒有。
-- 從 profiles 查就會完全看不到她的新身分。
--
-- 另外 last_sign_in_at 只在明確登入時更新，token 自動續期不算，
-- 不能拿來判斷「最近有沒有在用」。要看 最後一盞 那欄。

select
  u.id                                                            as 身分id,
  coalesce(p.display_name, '（沒有 profile）')                     as 名字,
  to_char(u.created_at, 'MM/DD HH24:MI')                          as 建立,
  (select count(*) from lamps l where l.author_id = u.id)          as 燈,
  (select count(*) from group_members m where m.user_id = u.id)    as 加入幾群,
  (select count(*) from groups g where g.owner_id = u.id)          as 開過幾群,
  (select count(*) from reactions r where r.user_id = u.id)        as 隨喜過,
  (select count(*) from replies  r where r.author_id = u.id)       as 留言過,
  (select max(l.day)::text from lamps l where l.author_id = u.id)  as 最後一盞,
  (p.id is null)                                                   as 沒有profile
from auth.users u
left join profiles p on p.id = u.id
order by u.created_at;
