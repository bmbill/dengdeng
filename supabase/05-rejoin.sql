-- 燈燈悅心 — 把蔡宜臻的裝置接回「快樂學習」
--
-- 她手機上的匿名身分不是有 profile 的那個 81bd9439（那是舊的，已經在群裡）。
-- 伺服器上有兩個「供過燈、卻一個群都沒加」的身分，其中一個就是她現在的手機。
--
-- 用特徵找，不用 id：這兩個身分只在診斷輸出裡露出前 8 碼，
-- 手動補完 uuid 是在賭。「有燈但沒有群」本來就是這件事的定義——
-- 燈只會從 app 供出來，所以有燈就代表有人在用；沒有群卻有燈，
-- 就是「供了燈但分享不到任何地方」，也就是我們要修的那個狀況。
--
-- 兩個都加進去。多出來的那個是不會再登入的空殼，
-- 等她開過 app、看出哪一個活著再刪。先猜一個然後猜錯的話，
-- 她還是連不上，而且看起來像沒修好。
--
-- 這份要在 04-cleanup.sql 之前跑；04 會把這兩個身分刪掉。

begin;

do $$
declare
  g_id uuid;
  n int;
begin
  select id into g_id from groups where invite_code = 'TMDT8K7L';
  if g_id is null then
    raise exception '找不到「快樂學習」。中止。';
  end if;

  with orphan as (
    select u.id
    from auth.users u
    where exists (select 1 from lamps l where l.author_id = u.id)
      and not exists (select 1 from group_members m where m.user_id = u.id)
  )
  insert into group_members (group_id, user_id)
  select g_id, id from orphan
  on conflict do nothing;

  get diagnostics n = row_count;
  raise notice '接回 % 個身分', n;

  if n = 0 then
    raise exception '沒有找到「有燈但沒加入任何群」的身分——狀況跟診斷時不一樣了，先停下來看看。';
  end if;
end $$;

-- 接完長這樣：應該有 4 個人（夏安、蔡宜臻，加兩個待確認的）
select
  coalesce(p.display_name, '（還沒有名字，待確認）')             as 成員,
  m.user_id                                                     as 身分id,
  (select count(*) from lamps l where l.author_id = m.user_id)  as 燈,
  m.joined_at                                                   as 加入時間
from group_members m
join groups g on g.id = m.group_id
left join profiles p on p.id = m.user_id
where g.id = (select id from groups where invite_code = 'TMDT8K7L')
order by p.display_name nulls last;

commit;
