-- 燈燈悅心 — 同行清單用的 group_feed
--
-- 為什麼不直接讓 group_sky 多回 entries：
--   燈海只需要畫光點，不需要內文。共同燈海一次最多 108 盞，
--   每盞多帶一份 entries jsonb，200 人的群一個月就多吃掉
--   將近 1GB 的免費流量額度。所以清單自己一支，只拉 30 筆。
--
-- 這份只有 create or replace function，不碰任何一張表，
-- 所以 app 開著也不會 deadlock。可以重複執行。

create or replace function group_feed(g uuid, p_limit int default 30)
returns table (
  id uuid,
  day date,
  lamp jsonb,
  entries jsonb,
  entry_count int,
  pages int,
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
  if not is_member(g) then
    raise exception '你不在這個群組裡';
  end if;

  return query
    select
      l.id, l.day, l.lamp, l.entries, l.entry_count, l.pages,
      p.display_name, p.avatar_char, l.author_id,
      (select count(*) from reactions r where r.lamp_id = l.id and r.kind = 'joy')::bigint,
      exists (select 1 from reactions r where r.lamp_id = l.id and r.user_id = auth.uid() and r.kind = 'joy'),
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', rp.id, 'body', rp.body, 'at', rp.created_at, 'name', pr.display_name
        ) order by rp.created_at)
        from replies rp
        left join profiles pr on pr.id = rp.author_id
        where rp.lamp_id = l.id
      ), '[]'::jsonb)
    from lamps l
    join lamp_shares s on s.lamp_id = l.id and s.group_id = g
    left join profiles p on p.id = l.author_id
    order by l.day desc, l.created_at desc
    limit greatest(1, least(coalesce(p_limit, 30), 100));
end;
$$;

revoke all on function group_feed(uuid, integer) from public, anon;
grant execute on function group_feed(uuid, integer) to authenticated;
