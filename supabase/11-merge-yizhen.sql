-- 燈燈悅心 — 把蔡宜臻的兩個身分併成一個
--
-- 8412d77b（3 天，有隨喜和留言）和 fe124aa9（只有 09-19，
-- 是 resendPublic() 補送到一半被關掉留下的）。
--
-- 方向不用猜：留 last_seen 比較新的那個，也就是她手機真的還在用的那個。
-- 這件事以前伺服器答不出來，所以前兩次合併都是憑推理決定方向；
-- 猜錯會把人正在用的裝置標記成退休，然後她就完全動不了。
-- 所以 last_seen 是空的就直接中止，請她先開一次 app。
--
-- 全程不碰 auth.users。delete from auth.users 會鎖住 auth 表，
-- 而那正是這兩天連續兩次把人踢成新身分的原因。
-- 退場的身分改成標記退休、移出群組就好。

begin;

do $$
declare
  A uuid := '8412d77b-b354-41a8-8edc-21bc98c87956';
  B uuid := 'fe124aa9-10ca-47ad-ad19-7dd6ba06abc9';
  live uuid;
  dead uuid;
  sa timestamptz;
  sb timestamptz;
  n int;
begin
  select last_seen into sa from profiles where id = A;
  select last_seen into sb from profiles where id = B;

  if sa is null and sb is null then
    raise exception '兩個身分都還沒有 last_seen。先跑 add-last-seen.sql、等 v36 上線，請她開一次 app 再來。';
  end if;

  if coalesce(sa, 'epoch'::timestamptz) >= coalesce(sb, 'epoch'::timestamptz)
    then live := A; dead := B;
    else live := B; dead := A;
  end if;
  raise notice '留 %，退場 %', live, dead;

  -- 撞到同一天的，留「被回應比較多」的那一份。
  -- 內容兩邊一樣，差別只在隨喜和留言掛在哪一盞上——那些是別人給的，
  -- 弄丟了補不回來，所以以它為準，不是以時間為準。
  with both as (
    select d.id as dead_id, l.id as live_id,
           (select count(*) from reactions r where r.lamp_id = d.id)
         + (select count(*) from replies  r where r.lamp_id = d.id) as dead_n,
           (select count(*) from reactions r where r.lamp_id = l.id)
         + (select count(*) from replies  r where r.lamp_id = l.id) as live_n,
           d.entry_count as dead_e, l.entry_count as live_e
    from lamps d
    join lamps l on l.author_id = live and l.day = d.day
    where d.author_id = dead
  )
  delete from lamps
  where id in (
    select case when (dead_n, dead_e) > (live_n, live_e) then live_id else dead_id end
    from both
  );
  get diagnostics n = row_count;
  raise notice '撞到同一天而刪掉的：% 盞', n;

  -- 剩下的搬過去。燈的 id 不動，掛在燈上的分享、隨喜、留言都跟著走。
  update lamps set author_id = live where author_id = dead;
  get diagnostics n = row_count;
  raise notice '搬了 % 盞燈', n;

  -- 她給別人的隨喜和留言
  delete from reactions r
   where r.user_id = dead
     and exists (select 1 from reactions x
                  where x.lamp_id = r.lamp_id and x.user_id = live and x.kind = r.kind);
  update reactions set user_id = live where user_id = dead;
  update replies  set author_id = live where author_id = dead;

  -- 群主換過去（她目前沒開群，但這樣寫將來也對）
  update groups set owner_id = live where owner_id = dead;

  -- 退場的身分移出群組，標記退休。
  -- 標記是必要的：它那台裝置本機還留著群和邀請碼，
  -- 只移出去的話，下次一打開又會自己加回來。
  delete from group_members where user_id = dead;
  update profiles set retired_at = now(), recovery_code = null where id = dead;
end $$;

select
  coalesce(p.display_name, '（沒有 profile）')                      as 成員,
  m.user_id                                                        as 身分id,
  (select count(*) from lamps l where l.author_id = m.user_id)     as 燈,
  p.last_seen                                                      as 最後連線
from group_members m
left join profiles p on p.id = m.user_id
where m.group_id = (select id from groups where invite_code = 'TMDT8K7L')
order by 成員;

commit;
