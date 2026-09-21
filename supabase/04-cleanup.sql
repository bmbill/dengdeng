-- 燈燈悅心 — 只留夏安和蔡宜臻，其餘全部清掉
--
-- 用白名單刪，不是列出要刪的那些：漏掉一個測試身分只是髒，
-- 但白名單打錯會把真人刪掉，所以下面先驗證要保留的都在、
-- 「快樂學習」還在、而且兩個人都還在群裡，任何一項不符就整份中止。
--
-- 蔡宜臻留的是 8412d77b，她現在手機上那一個，不是有舊 profile 的
-- 81bd9439。她那 3 天的燈會全部重新掛在 8412d77b 底下，
-- 81bd9439 留著只會讓群裡出現兩個蔡宜臻、同一天兩盞燈。
--
-- 會一併消失的：
--   群「週三共修」「測試用－可刪」——群主都是測試身分，
--   刪掉身分時 groups.owner_id 的 cascade 會帶走它們。
--   身分 67692edb——05 那時候分不出兩個空殼哪個是她的手機，
--   兩個都接了回去；這是猜錯的那個，沒人會再登入。
--   身分 81bd9439——蔡宜臻的舊身分，那盞 09-19 已經被新身分重送了。
--
-- 補送有沒有跑成功，腳本自己會查（第 ④ 關），不必先去核對數字。
--
-- 整份在一個交易裡，中間任何一步失敗就全部回滾。

begin;

do $$
declare
  KEEP uuid[] := array[
    '682abcce-d7a9-4511-ae27-a05af239b8be',   -- 夏安（快樂學習的群主）
    '8412d77b-b354-41a8-8edc-21bc98c87956'    -- 蔡宜臻（她現在的手機）
  ];
  GROUP_KEEP uuid;
  n int;
  n_lost text;
begin
  -- ① 要保留的身分都還在嗎
  select count(*) into n from auth.users where id = any(KEEP);
  if n <> array_length(KEEP, 1) then
    raise exception '要保留的身分只找到 % 個，應該有 % 個。先確認 id 有沒有貼錯。',
      n, array_length(KEEP, 1);
  end if;

  -- ② 快樂學習還在，而且群主是要保留的人
  select g.id into GROUP_KEEP
  from groups g
  where g.invite_code = 'TMDT8K7L' and g.owner_id = any(KEEP);
  if GROUP_KEEP is null then
    raise exception '找不到「快樂學習」，或它的群主不在保留名單裡。中止。';
  end if;

  -- ③ 兩個人都還在群裡
  select count(*) into n from group_members where group_id = GROUP_KEEP and user_id = any(KEEP);
  if n <> array_length(KEEP, 1) then
    raise exception '「快樂學習」裡只有 % 個保留的成員，應該有 % 個。中止。',
      n, array_length(KEEP, 1);
  end if;

  -- ④ 要刪的身分裡，有沒有哪一天只存在於它們底下？
  --
  -- 這是整份腳本唯一會真的弄丟東西的地方。刪掉 81bd9439 本來是安全的，
  -- 前提是她那 3 天已經重新掛在新身分底下——補送要是沒跑成功，
  -- 09-19 就只剩舊身分那一份，刪下去就沒了。
  -- 與其請人去比對數字，不如讓腳本自己查：只看快樂學習裡的燈
  -- （測試群整個會消失，那裡面的燈沒有保留的意義）。
  select string_agg(distinct l.day::text, '、' order by l.day::text) into n_lost
  from lamps l
  join lamp_shares s on s.lamp_id = l.id
  where s.group_id = GROUP_KEEP
    and l.author_id <> all(KEEP)
    and not exists (
      select 1 from lamps k
      join lamp_shares ks on ks.lamp_id = k.id
      where ks.group_id = GROUP_KEEP and k.author_id = any(KEEP) and k.day = l.day
    );
  if n_lost is not null then
    raise exception '這幾天只存在於要刪掉的身分底下：%。補送大概還沒跑成功，先別刪。', n_lost;
  end if;

  -- ⑤ 動手。其他表都是 on delete cascade，刪 auth.users 就全帶走。
  delete from auth.users where id <> all(KEEP);
  get diagnostics n = row_count;
  raise notice '清掉 % 個身分', n;
end $$;

-- 清完長這樣
select
  coalesce(p.display_name, '（沒有 profile）')                     as 名字,
  u.id                                                            as 身分id,
  (select count(*) from lamps l where l.author_id = u.id)          as 燈,
  (select count(*) from group_members m where m.user_id = u.id)    as 加入幾群
from auth.users u
left join profiles p on p.id = u.id
order by u.created_at;

select
  g.name                                                          as 還剩下的群,
  g.invite_code                                                   as 邀請碼,
  (select count(*) from group_members m where m.group_id = g.id)  as 人數,
  (select count(*) from lamp_shares s where s.group_id = g.id)    as 燈數
from groups g;

commit;
