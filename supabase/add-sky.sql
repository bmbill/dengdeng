-- 燈燈悅心 — 只加「一片天空」需要的兩支函式
--
-- 為什麼不直接重跑整份 schema.sql：
--   那份會對每張表做 DDL（alter table enable rls、drop/create policy），
--   需要 AccessExclusiveLock。如果此時有人正在用 app 讀那些表，
--   兩邊搶鎖就會 deadlock —— 就是你剛才看到的 40P01。
--
-- 這份只有 create or replace function，不碰任何一張表，
-- 所以就算 app 開著也不會卡。
--
-- 貼到 SQL Editor 執行即可。可以重複執行。

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
