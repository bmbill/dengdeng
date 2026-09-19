-- 燈燈悅心 — Supabase schema
--
-- 在 Supabase 專案的 SQL Editor 整份貼上執行。
-- 執行前先到 Authentication → Providers 把「Anonymous sign-ins」打開，
-- 不然 app 連不進來（我們不用 email 密碼，一個裝置一組匿名身分）。
--
-- ── 資料模型 ──
--
-- **一個人一天一盞燈。燈屬於人，不屬於群。**
--
--   lamps        你的燈（每人每天一盞）
--   lamp_shares  這盞燈分享到哪幾個群（一盞可以分享到多個群）
--
-- 所以一個人可以同時在很多群裡，寫一次就能同時亮在好幾片共同燈海。
-- 取消分享到某個群，只是把那筆 share 拿掉，你自己的燈還在。
--
-- 共同燈海和同行清單是同一份資料的兩種看法，不是兩套資料。
--
-- ── 權限 ──
--
-- 什麼都看不到是預設。要看得到必須證明你跟對方在同一個群組，
-- 而且判斷全部在資料庫做，不靠前端擋。

-- ─────────────────────────── 表 ───────────────────────────

create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '無名',
  avatar_char  text not null default '燈',
  created_at   timestamptz not null default now()
);

create table if not exists groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 40),
  invite_code text not null unique,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  -- 群組人數上限。預設 200，開群的人可以自己調。
  max_members int not null default 200 check (max_members between 1 and 2000),
  created_at  timestamptz not null default now()
);

create table if not exists group_members (
  group_id  uuid not null references groups(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- 一盞燈 = 某人某一天。
-- lamp    是形制／燈身色／焰色，讓前端用同一支 renderLamp() 畫出來。
-- entries 只放那天「公開的」幾則，私密的永遠不會送上來。
create table if not exists lamps (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references auth.users(id) on delete cascade,
  day         date not null,
  lamp        jsonb not null,
  entries     jsonb not null default '[]'::jsonb,
  entry_count int not null default 0 check (entry_count >= 0),
  pages       int not null default 0 check (pages >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (author_id, day)
);

-- 一盞燈分享到哪些群
create table if not exists lamp_shares (
  lamp_id    uuid not null references lamps(id) on delete cascade,
  group_id   uuid not null references groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (lamp_id, group_id)
);

create table if not exists reactions (
  lamp_id    uuid not null references lamps(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null default 'joy' check (kind in ('joy', 'palms')),
  created_at timestamptz not null default now(),
  primary key (lamp_id, user_id, kind)
);

-- 回應刻意限制 60 字，而且在資料庫這層就擋。
-- 這不是技術限制，是設計決定：這裡不做成討論區。
create table if not exists replies (
  id         uuid primary key default gen_random_uuid(),
  lamp_id    uuid not null references lamps(id) on delete cascade,
  author_id  uuid not null references auth.users(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 60),
  created_at timestamptz not null default now()
);

create index if not exists lamps_author_day on lamps (author_id, day desc);
create index if not exists lamps_day        on lamps (day desc);
create index if not exists shares_group     on lamp_shares (group_id);
create index if not exists reactions_lamp   on reactions (lamp_id);
create index if not exists replies_lamp     on replies (lamp_id);

-- ───────────────────── 判斷用的小函式 ─────────────────────
-- security definer：讓它能繞過 RLS 去查關聯表，
-- 否則 policy 查 group_members 會遞迴觸發 group_members 自己的 policy。

create or replace function is_member(g uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from group_members
    where group_id = g and user_id = auth.uid()
  );
$$;

create or replace function shares_group(u uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1
    from group_members a
    join group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = u
  );
$$;

-- 這盞燈我看得到嗎：我自己的，或者它分享到了我所在的某個群
create or replace function can_see_lamp(l uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from lamps lm
    where lm.id = l
      and (
        lm.author_id = auth.uid()
        or exists (
          select 1 from lamp_shares s
          join group_members gm on gm.group_id = s.group_id
          where s.lamp_id = lm.id and gm.user_id = auth.uid()
        )
      )
  );
$$;

create or replace function is_group_owner(g uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (select 1 from groups where id = g and owner_id = auth.uid());
$$;

-- 這盞燈是不是我的。
--
-- 這支一定要是 security definer：lamp_shares 的 policy 需要知道
-- 「這盞燈是不是他的」，但如果直接寫 select ... from lamps，
-- 就會觸發 lamps 的 policy，而 lamps 的 policy 又去查 lamp_shares，
-- 兩邊互相觸發 → infinite recursion detected in policy for relation。
create or replace function owns_lamp(l uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (select 1 from lamps where id = l and author_id = auth.uid());
$$;

-- ─────────────────────────── RLS ───────────────────────────

alter table profiles      enable row level security;
alter table groups        enable row level security;
alter table group_members enable row level security;
alter table lamps         enable row level security;
alter table lamp_shares   enable row level security;
alter table reactions     enable row level security;
alter table replies       enable row level security;

-- profiles：只看得到自己，和跟自己同群的人
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select
  using (id = auth.uid() or shares_group(id));

drop policy if exists profiles_insert on profiles;
create policy profiles_insert on profiles for insert
  with check (id = auth.uid());

drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- groups：只看得到自己加入的群。
-- 用邀請碼找群是走下面的 join_group()，不開放直接查 groups，
-- 否則任何人都能把所有群的邀請碼撈出來。
drop policy if exists groups_select on groups;
create policy groups_select on groups for select
  using (is_member(id));

drop policy if exists groups_update on groups;
create policy groups_update on groups for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- group_members：只看得到同群的成員名單
drop policy if exists members_select on group_members;
create policy members_select on group_members for select
  using (is_member(group_id));

-- 自己退群；群主可以請人離開（200 人的群需要這個）
drop policy if exists members_delete on group_members;
create policy members_delete on group_members for delete
  using (user_id = auth.uid() or is_group_owner(group_id));

-- lamps：自己的，或分享到我所在的群的
drop policy if exists lamps_select on lamps;
create policy lamps_select on lamps for select
  using (
    author_id = auth.uid()
    or exists (
      select 1 from lamp_shares s
      where s.lamp_id = lamps.id and is_member(s.group_id)
    )
  );

drop policy if exists lamps_insert on lamps;
create policy lamps_insert on lamps for insert
  with check (author_id = auth.uid());

drop policy if exists lamps_update on lamps;
create policy lamps_update on lamps for update
  using (author_id = auth.uid()) with check (author_id = auth.uid());

drop policy if exists lamps_delete on lamps;
create policy lamps_delete on lamps for delete
  using (author_id = auth.uid());

-- lamp_shares
-- 這幾條一律走 owns_lamp()，不要直接 select from lamps —— 見上面的遞迴說明。
drop policy if exists shares_select on lamp_shares;
create policy shares_select on lamp_shares for select
  using (is_member(group_id) or owns_lamp(lamp_id));

-- 只能分享自己的燈，而且只能分享到自己有加入的群
drop policy if exists shares_insert on lamp_shares;
create policy shares_insert on lamp_shares for insert
  with check (is_member(group_id) and owns_lamp(lamp_id));

-- 作者自己收回，或群主從自己的群裡移掉（200 人的群需要這個）
drop policy if exists shares_delete on lamp_shares;
create policy shares_delete on lamp_shares for delete
  using (owns_lamp(lamp_id) or is_group_owner(group_id));

-- reactions
drop policy if exists reactions_select on reactions;
create policy reactions_select on reactions for select
  using (can_see_lamp(lamp_id));

drop policy if exists reactions_insert on reactions;
create policy reactions_insert on reactions for insert
  with check (user_id = auth.uid() and can_see_lamp(lamp_id));

drop policy if exists reactions_delete on reactions;
create policy reactions_delete on reactions for delete
  using (user_id = auth.uid());

-- replies
drop policy if exists replies_select on replies;
create policy replies_select on replies for select
  using (can_see_lamp(lamp_id));

drop policy if exists replies_insert on replies;
create policy replies_insert on replies for insert
  with check (author_id = auth.uid() and can_see_lamp(lamp_id));

-- 作者自己刪，或被回應那盞燈的主人刪掉（不想要的話可以移除）
drop policy if exists replies_delete on replies;
create policy replies_delete on replies for delete
  using (author_id = auth.uid() or owns_lamp(lamp_id));

-- ───────────────────────── 開群、入群 ─────────────────────────

create or replace function create_group(group_name text)
returns table (id uuid, name text, invite_code text)
language plpgsql security definer
set search_path = public
as $$
declare
  g groups%rowtype;
  code text;
begin
  if auth.uid() is null then
    raise exception '請先登入';
  end if;

  -- 去掉容易看錯的 0/O/1/I
  loop
    code := (
      select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
                               floor(random() * 32)::int + 1, 1), '')
      from generate_series(1, 8)
    );
    exit when not exists (select 1 from groups where groups.invite_code = code);
  end loop;

  insert into groups (name, invite_code, owner_id)
  values (trim(group_name), code, auth.uid())
  returning * into g;

  insert into group_members (group_id, user_id) values (g.id, auth.uid());

  return query select g.id, g.name, g.invite_code;
end;
$$;

create or replace function join_group(code text)
returns table (id uuid, name text)
language plpgsql security definer
set search_path = public
as $$
declare
  g groups%rowtype;
  n int;
begin
  if auth.uid() is null then
    raise exception '請先登入';
  end if;

  select * into g from groups where groups.invite_code = upper(trim(code));
  if not found then
    raise exception '找不到這個邀請碼';
  end if;

  -- 已經在裡面就直接回，不算滿
  if not exists (select 1 from group_members m where m.group_id = g.id and m.user_id = auth.uid()) then
    select count(*) into n from group_members m where m.group_id = g.id;
    if n >= g.max_members then
      raise exception '這個群已經滿了（上限 % 人）', g.max_members;
    end if;
    insert into group_members (group_id, user_id) values (g.id, auth.uid());
  end if;

  return query select g.id, g.name;
end;
$$;

-- 我加入了哪些群（含人數，給「發到哪幾個群」的選單用）
create or replace function my_groups()
returns table (id uuid, name text, invite_code text, member_count bigint, is_owner boolean)
language sql security definer stable
set search_path = public
as $$
  select
    g.id, g.name, g.invite_code,
    (select count(*) from group_members m where m.group_id = g.id)::bigint,
    (g.owner_id = auth.uid())
  from groups g
  join group_members me on me.group_id = g.id and me.user_id = auth.uid()
  order by g.created_at;
$$;

-- ─────────────────── 一次發到多個群 ───────────────────
-- upsert 自己今天的燈，然後把它分享到指定的那幾個群。
-- 傳空陣列就是收回全部分享（燈還是你的，只是不公開）。

create or replace function publish_lamp(
  p_day     date,
  p_lamp    jsonb,
  p_entries jsonb,
  p_pages   int,
  p_groups  uuid[]
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  lid uuid;
  gid uuid;
  ents jsonb := coalesce(p_entries, '[]'::jsonb);
begin
  if auth.uid() is null then
    raise exception '請先登入';
  end if;

  insert into lamps (author_id, day, lamp, entries, entry_count, pages)
  values (auth.uid(), p_day, p_lamp, ents,
          jsonb_array_length(ents), coalesce(p_pages, 0))
  on conflict (author_id, day) do update
    set lamp = excluded.lamp,
        entries = excluded.entries,
        entry_count = excluded.entry_count,
        pages = excluded.pages,
        updated_at = now()
  returning id into lid;

  -- 不在清單裡的群，把分享收回
  delete from lamp_shares s
  where s.lamp_id = lid
    and (p_groups is null or not (s.group_id = any(p_groups)));

  -- 只分享到我真的有加入的群
  if p_groups is not null then
    foreach gid in array p_groups loop
      if is_member(gid) then
        insert into lamp_shares (lamp_id, group_id)
        values (lid, gid)
        on conflict do nothing;
      end if;
    end loop;
  end if;

  return lid;
end;
$$;

-- ─────────────────── 共同燈海 ───────────────────
--
-- 一片天空 = 一段日期區間（預設三天）。可以一片一片往回翻。
--
-- 這樣分段不只是為了好看：200 人的群一個月就有幾千盞，
-- 按時間切才不會變成無止境的捲動，也才有「那幾天的天空」這件事。
-- 區間內還是可能很多盞，所以仍然保留 p_limit。

create or replace function group_sea(
  g       uuid,
  p_from  date,
  p_to    date,
  p_limit int default 150
)
returns table (
  id uuid,
  day date,
  lamp jsonb,
  entry_count int,
  pages int,
  author_name text,
  author_char text,
  author_id uuid,
  joy_count bigint,
  joined_by_me boolean,
  reply_count bigint
)
language plpgsql security definer stable
set search_path = public
as $$
begin
  if not is_member(g) then
    raise exception '你不在這個群組裡';
  end if;

  return query
    select
      l.id, l.day, l.lamp, l.entry_count, l.pages,
      p.display_name, p.avatar_char, l.author_id,
      (select count(*) from reactions r where r.lamp_id = l.id and r.kind = 'joy')::bigint,
      exists (select 1 from reactions r where r.lamp_id = l.id and r.user_id = auth.uid() and r.kind = 'joy'),
      (select count(*) from replies rp where rp.lamp_id = l.id)::bigint
    from lamps l
    join lamp_shares s on s.lamp_id = l.id and s.group_id = g
    left join profiles p on p.id = l.author_id
    where l.day between p_from and p_to
    order by l.day desc, l.created_at desc
    limit greatest(1, least(coalesce(p_limit, 150), 400));
end;
$$;

-- 這片天空的總數。可能比畫出來的多，前端要據實說。
create or replace function group_sea_stats(g uuid, p_from date, p_to date)
returns table (lamps bigint, authors bigint, entries bigint, pages bigint, members bigint)
language plpgsql security definer stable
set search_path = public
as $$
begin
  if not is_member(g) then
    raise exception '你不在這個群組裡';
  end if;

  return query
    select
      count(l.id)::bigint,
      count(distinct l.author_id)::bigint,
      coalesce(sum(l.entry_count), 0)::bigint,
      coalesce(sum(l.pages), 0)::bigint,
      (select count(*) from group_members m where m.group_id = g)::bigint
    from lamps l
    join lamp_shares s on s.lamp_id = l.id and s.group_id = g
    where l.day between p_from and p_to;
end;
$$;

-- 往回翻的時候，找出「上一片有燈的天空」是哪一天結束，
-- 才不會連按好幾次都是空的。
create or replace function group_sea_prev_day(g uuid, p_before date)
returns date
language plpgsql security definer stable
set search_path = public
as $$
declare d date;
begin
  if not is_member(g) then
    raise exception '你不在這個群組裡';
  end if;

  select max(l.day) into d
  from lamps l
  join lamp_shares s on s.lamp_id = l.id and s.group_id = g
  where l.day < p_before;

  return d;
end;
$$;

-- 一盞燈的完整內容（點開某盞燈時才拉）
create or replace function lamp_detail(l uuid)
returns table (
  id uuid,
  day date,
  lamp jsonb,
  entries jsonb,
  author_name text,
  author_char text,
  author_id uuid,
  joy_count bigint,
  joined_by_me boolean,
  replies jsonb
)
language plpgsql security definer stable
set search_path = public
as $$
begin
  if not can_see_lamp(l) then
    raise exception '看不到這盞燈';
  end if;

  return query
    select
      lm.id, lm.day, lm.lamp, lm.entries,
      p.display_name, p.avatar_char, lm.author_id,
      (select count(*) from reactions r where r.lamp_id = lm.id and r.kind = 'joy')::bigint,
      exists (select 1 from reactions r where r.lamp_id = lm.id and r.user_id = auth.uid() and r.kind = 'joy'),
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', rp.id,
          'body', rp.body,
          'at', rp.created_at,
          'name', pr.display_name
        ) order by rp.created_at)
        from replies rp
        left join profiles pr on pr.id = rp.author_id
        where rp.lamp_id = lm.id
      ), '[]'::jsonb)
    from lamps lm
    left join profiles p on p.id = lm.author_id
    where lm.id = l;
end;
$$;

-- ─────────────────── 本月大眾合計（沒有個人排名） ───────────────────

create or replace function group_month_totals(g uuid)
returns table (lamps bigint, entries bigint, pages bigint, members bigint)
language plpgsql security definer stable
set search_path = public
as $$
begin
  if not is_member(g) then
    raise exception '你不在這個群組裡';
  end if;

  return query
    select
      count(l.id)::bigint,
      coalesce(sum(l.entry_count), 0)::bigint,
      coalesce(sum(l.pages), 0)::bigint,
      (select count(*) from group_members m where m.group_id = g)::bigint
    from lamps l
    join lamp_shares s on s.lamp_id = l.id and s.group_id = g
    where l.day >= date_trunc('month', now())::date;
end;
$$;

-- 這幾支函式本來就要讓一般使用者呼叫，但只有登入的才行。
do $$
declare f text;
begin
  foreach f in array array[
    'create_group(text)',
    'join_group(text)',
    'my_groups()',
    'publish_lamp(date,jsonb,jsonb,integer,uuid[])',
    'group_sea(uuid,date,date,integer)',
    'group_sea_stats(uuid,date,date)',
    'group_sea_prev_day(uuid,date)',
    'lamp_detail(uuid)',
    'group_month_totals(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════
-- 一片天空 = 108 盞（數量制）
-- ═══════════════════════════════════════════════════════════
--
-- 原本是時間制（一片天空 N 天）。改成數量制的理由：
--
--   1. 密度永遠剛好。冷清的一週不會是空蕩蕩的天空，
--      熱鬧的一週也不會糊成一片光。
--   2. 「這片天空滿了」是全群共享的事件，
--      比一個任意的日期切點有意義。
--   3. 它天然給出一個不是排行榜的共同目標：這片天空 87 / 108。
--
-- 切法：把群裡的燈依 (day, created_at) 排好，每 p_size 盞切一塊。
-- 最後一塊就是「現在這片」，還沒滿。p_back = 0 是現在這片，
-- 1 是上一片，依此類推。切點是算出來的，不存狀態，
-- 所以既有的燈不用搬家，也不會有「忘記封存」這種事。

create or replace function group_sky(
  g      uuid,
  p_back int default 0,
  p_size int default 108
)
returns table (
  id uuid,
  day date,
  lamp jsonb,
  entry_count int,
  pages int,
  author_name text,
  author_char text,
  author_id uuid,
  joy_count bigint,
  joined_by_me boolean,
  reply_count bigint
)
language plpgsql security definer stable
set search_path = public
as $$
declare
  sz    int := greatest(10, least(coalesce(p_size, 108), 400));
  back  int := greatest(0, coalesce(p_back, 0));
  total int;
  skies int;
  chunk int;
begin
  if not is_member(g) then
    raise exception '你不在這個群組裡';
  end if;

  select count(*) into total
  from lamps l join lamp_shares s on s.lamp_id = l.id and s.group_id = g;

  skies := greatest(1, ceil(total::numeric / sz)::int);
  chunk := skies - 1 - back;
  if chunk < 0 then
    return;   -- 往回翻過頭了
  end if;

  return query
    with ranked as (
      select
        l.id, l.day, l.lamp, l.entry_count, l.pages, l.author_id, l.created_at,
        ((row_number() over (order by l.day, l.created_at) - 1) / sz)::int as chunk_no
      from lamps l
      join lamp_shares s on s.lamp_id = l.id and s.group_id = g
    )
    select
      r.id, r.day, r.lamp, r.entry_count, r.pages,
      p.display_name, p.avatar_char, r.author_id,
      (select count(*) from reactions x where x.lamp_id = r.id and x.kind = 'joy')::bigint,
      exists (select 1 from reactions x where x.lamp_id = r.id and x.user_id = auth.uid() and x.kind = 'joy'),
      (select count(*) from replies y where y.lamp_id = r.id)::bigint
    from ranked r
    left join profiles p on p.id = r.author_id
    where r.chunk_no = chunk
    order by r.day desc, r.created_at desc;
end;
$$;

-- 這片天空的概況：第幾片、滿了沒、涵蓋哪幾天。
create or replace function group_sky_info(
  g      uuid,
  p_back int default 0,
  p_size int default 108
)
returns table (
  sky_no int,
  total_skies int,
  filled int,
  sky_size int,
  is_full boolean,
  from_day date,
  to_day date,
  authors bigint,
  entries bigint,
  pages bigint,
  members bigint
)
language plpgsql security definer stable
set search_path = public
as $$
declare
  sz    int := greatest(10, least(coalesce(p_size, 108), 400));
  back  int := greatest(0, coalesce(p_back, 0));
  total int;
  skies int;
  chunk int;
begin
  if not is_member(g) then
    raise exception '你不在這個群組裡';
  end if;

  select count(*) into total
  from lamps l join lamp_shares s on s.lamp_id = l.id and s.group_id = g;

  skies := greatest(1, ceil(total::numeric / sz)::int);
  chunk := skies - 1 - back;

  return query
    with ranked as (
      select
        l.id, l.day, l.entry_count, l.pages, l.author_id,
        ((row_number() over (order by l.day, l.created_at) - 1) / sz)::int as chunk_no
      from lamps l
      join lamp_shares s on s.lamp_id = l.id and s.group_id = g
    ),
    mine as (select * from ranked where chunk_no = chunk)
    select
      (chunk + 1),
      skies,
      (select count(*) from mine)::int,
      sz,
      ((select count(*) from mine) >= sz),
      (select min(m.day) from mine m),
      (select max(m.day) from mine m),
      (select count(distinct m.author_id) from mine m)::bigint,
      (select coalesce(sum(m.entry_count), 0) from mine m)::bigint,
      (select coalesce(sum(m.pages), 0) from mine m)::bigint,
      (select count(*) from group_members gm where gm.group_id = g)::bigint;
end;
$$;

revoke all on function group_sky(uuid, integer, integer)      from public, anon;
revoke all on function group_sky_info(uuid, integer, integer) from public, anon;
grant execute on function group_sky(uuid, integer, integer)      to authenticated;
grant execute on function group_sky_info(uuid, integer, integer) to authenticated;
