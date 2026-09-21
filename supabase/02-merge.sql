-- 燈燈悅心 — 把舊身分的東西全部搬到新身分底下
--
-- 用法：先跑 01-who.sql 看清楚，把兩個 uuid 填進下面兩行，再整份執行。
--   OLD = 舊手機那個身分（有燈、有群組的那筆）
--   NEW = 新手機那個身分（剛建的、幾乎是空的那筆）
--
-- 方向一定是 舊 → 新：新手機上握著的是 NEW 那個 session，
-- 反過來搬的話她還是連不上自己的資料。
--
-- 整份在一個交易裡，中間任何一步失敗就全部回滾，不會搬到一半。

begin;

create temp table merge_clash (
  day date,
  old_lamp uuid,
  new_lamp uuid
) on commit drop;

do $$
declare
  OLD_ID uuid := '00000000-0000-0000-0000-000000000000';  -- ← 改這裡
  NEW_ID uuid := '00000000-0000-0000-0000-000000000000';  -- ← 改這裡

  n_clash int;
  n_moved int;
begin
  if OLD_ID = NEW_ID then
    raise exception '兩個 id 一樣，不用搬';
  end if;
  if not exists (select 1 from auth.users where id = OLD_ID) then
    raise exception '找不到舊身分 %', OLD_ID;
  end if;
  if not exists (select 1 from auth.users where id = NEW_ID) then
    raise exception '找不到新身分 %。她要先在新手機上開過一次 app。', NEW_ID;
  end if;

  -- ── 群組成員資格 ──
  insert into group_members (group_id, user_id, joined_at)
  select gm.group_id, NEW_ID, gm.joined_at
  from group_members gm where gm.user_id = OLD_ID
  on conflict do nothing;

  delete from group_members where user_id = OLD_ID;

  -- ── 開過的群，群主一起換 ──
  update groups set owner_id = NEW_ID where owner_id = OLD_ID;

  -- ── 撞號的日子先記下來 ──
  -- lamps 有 unique(author_id, day)：新身分若在同一天也供過燈就會撞。
  -- 撞到的留著不動，讓你自己決定留哪一盞 —— 不要默默丟掉任何人的紀錄。
  insert into merge_clash (day, old_lamp, new_lamp)
  select o.day, o.id, n.id
  from lamps o
  join lamps n on n.author_id = NEW_ID and n.day = o.day
  where o.author_id = OLD_ID;

  select count(*) into n_clash from merge_clash;

  -- ── 燈：沒撞號的搬過去 ──
  update lamps o
  set author_id = NEW_ID
  where o.author_id = OLD_ID
    and not exists (select 1 from lamps n where n.author_id = NEW_ID and n.day = o.day);
  get diagnostics n_moved = row_count;

  -- lamp_shares 掛在 lamp_id 上，燈換作者它自己跟著走，不用動。

  -- ── 隨喜 ──
  insert into reactions (lamp_id, user_id, kind, created_at)
  select r.lamp_id, NEW_ID, r.kind, r.created_at
  from reactions r where r.user_id = OLD_ID
  on conflict do nothing;

  delete from reactions where user_id = OLD_ID;

  -- ── 留言 ──
  update replies set author_id = NEW_ID where author_id = OLD_ID;

  -- ── 名字：舊的那個才是她自己取的 ──
  update profiles n
  set display_name = o.display_name,
      avatar_char  = o.avatar_char
  from profiles o
  where n.id = NEW_ID and o.id = OLD_ID
    and coalesce(o.display_name, '') not in ('', '無名');

  raise notice '搬了 % 盞燈；% 盞因為同一天撞號留在舊身分底下', n_moved, n_clash;

  if n_clash = 0 then
    -- 沒有殘留才清掉舊身分（其他表都是 on delete cascade）
    delete from auth.users where id = OLD_ID;
    raise notice '舊身分已清除，合併完成';
  else
    raise notice '還有燈留在舊身分，先不刪。看下面那張表決定怎麼處理。';
  end if;
end $$;

-- 撞號的日子。空的就代表乾淨搬完了。
select
  day                                                        as 日期,
  (select count(*) from reactions r where r.lamp_id = old_lamp) as 舊的被隨喜,
  (select count(*) from reactions r where r.lamp_id = new_lamp) as 新的被隨喜,
  old_lamp, new_lamp
from merge_clash
order by day;

commit;
