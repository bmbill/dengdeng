-- 燈燈悅心 — 先看清楚有哪些身分（唯讀，不會改任何東西）
--
-- 換手機之後，同一個人會在 auth 裡有兩筆匿名身分：
-- 舊的那筆握有燈和群組成員資格，新的那筆是新手機開 app 時建的。
-- 合併之前一定要先確認哪一筆是哪一筆 —— 照名字猜會出事。

select
  p.id                                                          as 身分id,
  p.display_name                                                as 名字,
  to_char(p.created_at, 'MM/DD HH24:MI')                        as 建立時間,
  to_char(u.last_sign_in_at, 'MM/DD HH24:MI')                   as 最後登入,
  (select count(*) from lamps l where l.author_id = p.id)        as 燈,
  (select count(*) from group_members m where m.user_id = p.id)  as 加入幾群,
  (select count(*) from groups g where g.owner_id = p.id)        as 開過幾群,
  (select count(*) from reactions r where r.user_id = p.id)      as 隨喜過,
  (select max(l.day)::text from lamps l where l.author_id = p.id) as 最後一盞的日期
from profiles p
left join auth.users u on u.id = p.id
order by p.created_at;
