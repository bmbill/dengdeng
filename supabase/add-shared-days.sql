-- 燈燈悅心 — my_shared_days()
--
-- 只有函式，沒有 table DDL：改 table 要 AccessExclusiveLock，
-- 在 app 還活著的時候重跑整份 schema.sql 會 40P01 deadlock。
--
-- 回答一個本機答不出來的問題：「我哪幾天的燈真的在群裡？」
--
-- 本機原本用 remoteId 當作「送過了」，但那個標記只記得「發布這個動作
-- 成功過」，不記得「發布到了哪裡」。一盞在還沒加入任何群的時候供的燈
-- 一樣會拿到 remoteId，於是補送就跳過它——可是它一個群都沒進。
-- 換身分之後更糟：remoteId 指向的是別人底下的燈。
--
-- 這支的答案直接來自 lamp_shares，而且只看 auth.uid() 自己的燈，
-- 所以上面那幾種情況一次解決：沒送過、送了但沒分享到、
-- 送在舊身分底下，都不會出現在回傳裡，也就都會被補送。
--
-- 附帶一個好處：刻意只分享給某幾個群的那幾天會出現在回傳裡，
-- 補送就不會自作主張把它們推到其他群去。

create or replace function my_shared_days()
returns setof date
language sql security definer stable
set search_path = public
as $$
  select distinct l.day
  from lamps l
  where l.author_id = auth.uid()
    and exists (select 1 from lamp_shares s where s.lamp_id = l.id);
$$;

grant execute on function my_shared_days() to authenticated;
