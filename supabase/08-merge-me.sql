-- 燈燈悅心 — 把夏安的新身分和舊身分併回同一個
--
-- 04 跑的時候 auth.users 被鎖住，夏安的 app 剛好去問了一次 getUser()，
-- 失敗被誤判成「帳號沒了」，於是丟掉一個完全有效的 session、
-- 重新匿名登入，拿到 ae54db12。舊的 682abcce 沒有被刪，
-- 3 盞燈和群主身分都還在，只是那台裝置再也連不回去。
--
-- 方向是把舊的搬到新的，不是反過來：token 只存在裝置上，
-- 伺服器這邊沒辦法把 682abcce 的 session 還給她。
--
-- 燈的 id 不會變，所以蔡宜臻對那幾盞的隨喜和留言都會留著。
-- 本機那些 remoteId 指的也是燈的 id，一樣繼續有效。

begin;

do $$
declare
  OLD_ID uuid := '682abcce-d7a9-4511-ae27-a05af239b8be';  -- 舊的，有燈、是群主
  NEW_ID uuid := 'ae54db12-b6da-4005-9f78-5cad5cf7d1c9';  -- 04 之後新登入的那個
  g_id uuid;
  n int;
begin
  if not exists (select 1 from auth.users where id = OLD_ID) then
    raise exception '找不到舊身分 %。中止。', OLD_ID;
  end if;
  if not exists (select 1 from auth.users where id = NEW_ID) then
    raise exception '找不到新身分 %。中止。', NEW_ID;
  end if;

  -- lamps 上有 unique (author_id, day)。新身分必須是空的，
  -- 不然搬過去會撞在同一天上，而合併衝突要怎麼取捨不該由腳本決定。
  select count(*) into n from lamps where author_id = NEW_ID;
  if n <> 0 then
    raise exception '新身分底下已經有 % 盞燈了，搬過去會跟同一天撞在一起。先確認狀況。', n;
  end if;

  select id into g_id from groups where invite_code = 'TMDT8K7L';
  if g_id is null then
    raise exception '找不到「快樂學習」。中止。';
  end if;

  -- 先進群，再接群主。順序反過來的話，中間那一刻群主不在成員名單裡。
  insert into group_members (group_id, user_id) values (g_id, NEW_ID)
  on conflict do nothing;

  update groups set owner_id = NEW_ID where owner_id = OLD_ID;

  -- 燈搬過去。id 不動，所以掛在燈上的分享、隨喜、留言都跟著走。
  update lamps set author_id = NEW_ID where author_id = OLD_ID;
  get diagnostics n = row_count;
  raise notice '搬了 % 盞燈', n;

  -- 她給別人的隨喜和留言
  update reactions set user_id = NEW_ID where user_id = OLD_ID;
  update replies set author_id = NEW_ID where author_id = OLD_ID;

  delete from auth.users where id = OLD_ID;
  raise notice '舊身分清掉了';
end $$;

select
  coalesce(p.display_name, '（沒有 profile）')                     as 名字,
  u.id                                                            as 身分id,
  (select count(*) from lamps l where l.author_id = u.id)         as 燈,
  (select count(*) from group_members m where m.user_id = u.id)   as 加入幾群
from auth.users u
left join profiles p on p.id = u.id
order by u.created_at;

select
  g.name                                                          as 群,
  coalesce(o.display_name, '（群主已不存在）')                     as 群主,
  (select count(*) from group_members m where m.group_id = g.id)  as 人數,
  (select count(*) from lamp_shares s where s.group_id = g.id)    as 燈數
from groups g
left join profiles o on o.id = g.owner_id;

commit;
