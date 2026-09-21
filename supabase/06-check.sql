-- 燈燈悅心 — 05 跑完、她開過 app 之後，看看接回來的是哪一個
--
-- 只讀，不改任何東西，可以重複跑。
--
-- 怎麼看：活著的那個身分會「有名字」。她一開 app，catchUp() 就會
-- syncProfile() 把名字寫上去；沒人登入的空殼永遠停在「（空殼）」。
-- 補送成功的話，那個身分的「燈」會是 3、「已分享」也會是 3。

select
  coalesce(p.display_name, '（空殼，可刪）')                        as 成員,
  m.user_id                                                        as 身分id,
  (select count(*) from lamps l
     where l.author_id = m.user_id)                                as 燈,
  (select count(*) from lamps l
     join lamp_shares s on s.lamp_id = l.id
    where l.author_id = m.user_id and s.group_id = m.group_id)     as 已分享,
  (select max(l.day) from lamps l
     where l.author_id = m.user_id)                                as 最近一天
from group_members m
left join profiles p on p.id = m.user_id
where m.group_id = (select id from groups where invite_code = 'TMDT8K7L')
order by 燈 desc, 成員;
