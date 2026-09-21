-- 燈燈悅心 — 04 跑完之後看看還剩什麼
--
-- 只讀，可以重複跑。
--
-- 要回答的問題是「群還在嗎」。在的話，就只是某台裝置上的匿名身分
-- 被刪掉了，重新用邀請碼加回去就好，資料都還在。

select '身分' as 類別, count(*)::text as 數量 from auth.users
union all
select '群', count(*)::text from groups
union all
select '燈', count(*)::text from lamps
union all
select '分享', count(*)::text from lamp_shares;

select
  g.name                                                          as 群,
  g.invite_code                                                   as 邀請碼,
  coalesce(o.display_name, '（群主已不存在）')                     as 群主,
  g.owner_id                                                      as 群主id,
  (select count(*) from group_members m where m.group_id = g.id)  as 人數,
  (select count(*) from lamp_shares s where s.group_id = g.id)    as 燈數
from groups g
left join profiles o on o.id = g.owner_id;

select
  coalesce(p.display_name, '（沒有 profile）')                     as 名字,
  u.id                                                            as 身分id,
  (select count(*) from lamps l where l.author_id = u.id)         as 燈,
  (select count(*) from group_members m where m.user_id = u.id)   as 加入幾群
from auth.users u
left join profiles p on p.id = u.id
order by u.created_at;
