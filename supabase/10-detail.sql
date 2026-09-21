-- 燈燈悅心 — 蔡宜臻兩個身分底下各有哪幾天
--
-- 只讀。合併之前要知道兩件事：
--   哪一個是她手機現在用的（最後寫入時間最晚的那個）
--   有沒有撞到同一天（lamps 有 unique (author_id, day)，撞了要決定留哪份）

select
  case l.author_id
    when '8412d77b-b354-41a8-8edc-21bc98c87956' then '舊 8412d77b'
    when 'fe124aa9-10ca-47ad-ad19-7dd6ba06abc9' then '新 fe124aa9'
    else left(l.author_id::text, 8)
  end                                                            as 身分,
  l.day                                                          as 日期,
  l.entry_count                                                  as 幾則,
  l.updated_at                                                   as 最後寫入,
  (select count(*) from lamp_shares s where s.lamp_id = l.id)    as 分享到幾群,
  (select count(*) from reactions r where r.lamp_id = l.id)      as 被隨喜,
  (select count(*) from replies  r where r.lamp_id = l.id)       as 留言,
  left(coalesce(l.entries->0->>'text', ''), 20)                  as 第一則
from lamps l
where l.author_id in (
  '8412d77b-b354-41a8-8edc-21bc98c87956',
  'fe124aa9-10ca-47ad-ad19-7dd6ba06abc9'
)
order by l.day, l.author_id;
