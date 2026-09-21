-- 燈燈悅心 — 群裡多出來的人是誰、什麼時候進來的
--
-- 只讀，可以重複跑。
--
-- 看三件事：
--   身分是什麼時候建立的（created_at）——剛建的就是某台裝置新登入的
--   什麼時候進群的（joined_at）——對得上你做了什麼操作
--   有沒有退休（retired_at）——被接走的身分不該還在群裡

select
  coalesce(p.display_name, '（沒有 profile）')                      as 成員,
  m.user_id                                                        as 身分id,
  (select count(*) from lamps l where l.author_id = m.user_id)     as 燈,
  u.created_at                                                     as 身分建立於,
  m.joined_at                                                      as 進群於,
  p.retired_at                                                     as 已退休,
  case when p.recovery_code is null then '' else '有接回碼' end     as 備註
from group_members m
join auth.users u on u.id = m.user_id
left join profiles p on p.id = m.user_id
where m.group_id = (select id from groups where invite_code = 'TMDT8K7L')
order by m.joined_at;

-- 所有身分，包含不在群裡的
select
  coalesce(p.display_name, '（沒有 profile）')                      as 名字,
  u.id                                                             as 身分id,
  u.created_at                                                     as 建立於,
  (select count(*) from lamps l where l.author_id = u.id)          as 燈,
  (select count(*) from group_members m where m.user_id = u.id)    as 加入幾群,
  p.retired_at                                                     as 已退休
from auth.users u
left join profiles p on p.id = u.id
order by u.created_at;
