-- 燈燈悅心 — 接回碼
--
-- 換手機時把舊身分的東西接到新身分底下。
--
-- 為什麼不是「用同一個帳號登入」：匿名 session 的 token 只存在裝置上，
-- 伺服器沒辦法把它再發一次給新手機。所以做的是相反的方向——
-- 新手機用它自己的身分，把舊身分名下的燈、群、隨喜全部接過來。
-- 也就是把 08-merge-me.sql 那件事變成使用者自己按一個鈕。
--
-- 只有函式和一個欄位，沒有重建 table：改 table 要 AccessExclusiveLock，
-- app 活著的時候重跑整份 schema.sql 會 40P01 deadlock。

alter table profiles add column if not exists recovery_code text;
create unique index if not exists profiles_recovery_code on profiles (recovery_code);

-- 12 碼，去掉 0/O/1/I 這種抄起來會錯的字元，剩 32 個字元 → 60 bits。
-- 這串碼就是鑰匙，猜到等於冒名，所以長度不能省。
create or replace function gen_recovery_code()
returns text
language sql volatile
as $$
  select string_agg(
    substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', floor(random() * 32)::int + 1, 1), '')
  from generate_series(1, 12);
$$;

-- 我的接回碼。第一次叫的時候才生成，所以沒人用到就不會存在。
create or replace function my_recovery_code()
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  c text;
  tries int := 0;
begin
  if auth.uid() is null then raise exception '還沒登入'; end if;

  select recovery_code into c from profiles where id = auth.uid();
  if c is not null then return c; end if;

  if not exists (select 1 from profiles where id = auth.uid()) then
    raise exception '還沒有名字，先取個名字';
  end if;

  loop
    tries := tries + 1;
    c := gen_recovery_code();
    begin
      update profiles set recovery_code = c where id = auth.uid();
      return c;
    exception when unique_violation then
      -- 60 bits 撞到的機率極低，但真撞到就重抽，不要讓人看到錯誤
      if tries >= 5 then raise; end if;
    end;
  end loop;
end;
$$;

-- 把接回碼對應的那個舊身分，整個接到現在這個身分底下。
create or replace function reclaim_identity(code text)
returns table (name text, lamps int, groups int)
language plpgsql security definer
set search_path = public
as $$
declare
  old_id uuid;
  new_id uuid := auth.uid();
  clean text := upper(regexp_replace(coalesce(code, ''), '[^0-9A-Za-z]', '', 'g'));
  old_name text;
  n_lamps int;
  n_groups int;
begin
  if new_id is null then raise exception '還沒登入'; end if;

  select p.id, p.display_name into old_id, old_name
  from profiles p where p.recovery_code = clean;

  if old_id is null then raise exception '找不到這組接回碼'; end if;
  if old_id = new_id then raise exception '這就是你現在用的身分'; end if;

  -- lamps 有 unique (author_id, day)：新身分底下只要有一盞，
  -- 搬過來就可能撞在同一天上。合併衝突要怎麼取捨不該由這裡決定，
  -- 所以直接擋掉，請人在還沒開始記的時候接。
  if exists (select 1 from lamps where author_id = new_id) then
    raise exception '這台裝置已經供過燈了，沒辦法再接回別的身分';
  end if;

  -- 群：先讓新身分進去，再把群主換過來，順序反了中間那一刻群主不在名單裡
  insert into group_members (group_id, user_id)
    select gm.group_id, new_id from group_members gm where gm.user_id = old_id
  on conflict do nothing;
  update groups set owner_id = new_id where owner_id = old_id;
  delete from group_members where user_id = old_id;

  -- 燈：id 不動，所以掛在燈上的分享、隨喜、留言都跟著走
  update lamps set author_id = new_id where author_id = old_id;
  get diagnostics n_lamps = row_count;

  -- 她給別人的隨喜。reactions 的主鍵是 (lamp_id, user_id, kind)，
  -- 新身分萬一已經隨喜過同一盞，先把舊的那筆讓開再搬。
  delete from reactions r
   where r.user_id = old_id
     and exists (select 1 from reactions x
                  where x.lamp_id = r.lamp_id and x.user_id = new_id and x.kind = r.kind);
  update reactions set user_id = new_id where user_id = old_id;
  update replies  set author_id = new_id where author_id = old_id;

  -- 舊的那份 profile 先讓出 code（有 unique index），再把名字和碼接過來。
  -- 舊的 auth.users 留著沒關係：名下已經空了，誰也看不到它。
  delete from profiles where id = old_id;
  update profiles set display_name = old_name, recovery_code = clean where id = new_id;

  select count(*) into n_groups from group_members where user_id = new_id;

  return query select old_name, n_lamps, n_groups;
end;
$$;

-- 我自己的燈，用來在新手機上把本機的紀錄補回來。
-- 只有公開過的那幾則——私密的從來沒有離開過原本那台裝置，
-- 那些要靠備份檔，接回碼救不了。
create or replace function my_lamps()
returns table (day date, lamp jsonb, entries jsonb, pages int)
language sql security definer stable
set search_path = public
as $$
  select l.day, l.lamp, l.entries, l.pages
  from lamps l
  where l.author_id = auth.uid()
  order by l.day;
$$;

grant execute on function my_recovery_code()        to authenticated;
grant execute on function reclaim_identity(text)    to authenticated;
grant execute on function my_lamps()                to authenticated;
