-- 燈燈悅心 — 清理之前一定要先看的兩張表（唯讀）
--
-- 重點是第二張：刪一個身分會連帶刪掉它開的群
-- （groups.owner_id 是 on delete cascade），群一沒，
-- 裡面所有人的分享也跟著沒。所以動手之前要先確認
-- 真人所在的群，群主是不是測試身分。

-- ① 沒有 profile 的身分供了什麼燈 —— 用內容認出誰是誰
select
  l.author_id                                                  as 身分id,
  l.day                                                        as 日期,
  (select count(*) from lamp_shares s where s.lamp_id = l.id)  as 分享到幾個群,
  l.entries                                                    as 內容
from lamps l
join auth.users u on u.id = l.author_id
left join profiles p on p.id = u.id
where p.id is null
order by l.created_at;

-- ② 每個群：誰開的、誰在裡面
select
  g.name                                          as 群名,
  g.invite_code                                   as 邀請碼,
  g.owner_id                                      as 群主id,
  coalesce(op.display_name, '（沒有 profile）')    as 群主,
  m.user_id                                       as 成員id,
  coalesce(mp.display_name, '（沒有 profile）')    as 成員,
  (select count(*) from lamp_shares s where s.group_id = g.id) as 群裡幾盞燈
from groups g
left join profiles op on op.id = g.owner_id
left join group_members m on m.group_id = g.id
left join profiles mp on mp.id = m.user_id
order by g.created_at, mp.display_name nulls last;
