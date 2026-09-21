-- 燈燈悅心 — 只留夏安和蔡宜臻，其餘全部清掉
--
-- 用白名單刪，不是列出要刪的那些：漏掉一個測試身分只是髒，
-- 但白名單打錯會把真人刪掉，所以下面先驗證要保留的都在、
-- 「快樂學習」還在、而且兩個人都還在群裡，任何一項不符就整份中止。
--
-- 會一併消失的：
--   群「週三共修」「測試用－可刪」——群主都是測試身分，
--   刪掉身分時 groups.owner_id 的 cascade 會帶走它們。
--   兩盞孤兒燈（8412d77b、67692edb 供的）——它們一個群都沒分享到，
--   任何人都看不到；蔡宜臻手機上那 3 盞才是真的，
--   她重新匯入後 resendPublic() 會照正確的方式補送。
--
-- 整份在一個交易裡，中間任何一步失敗就全部回滾。

begin;

do $$
declare
  KEEP uuid[] := array[
    '682abcce-d7a9-4511-ae27-a05af239b8be',   -- 夏安（快樂學習的群主）
    '81bd9439-668b-4471-9c06-d56bff5c6caa'    -- 蔡宜臻
  ];
  GROUP_KEEP uuid;
  n int;
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

  -- ④ 動手。其他表都是 on delete cascade，刪 auth.users 就全帶走。
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
