-- ============================================================
-- Extend get_leaderboard() with a "season" timeframe (live preview of
-- what distribute_season_rewards() would crown if the season ended
-- right now) and rename the return column currency_gained ->
-- currency_value (accurate for both delta-based and lifetime-total
-- cases, since "season" returns a running total, not a delta)
-- รันใน Supabase SQL Editor หลังจาก 0001-0014 ถูก apply แล้ว
--
-- ต้อง drop+create ใหม่ (ไม่ใช้ create or replace เฉยๆ) เพราะ Postgres
-- ไม่ยอมให้เปลี่ยนชื่อ column ใน RETURN TABLE ของ function เดิม —
-- drop แล้ว grant execute หายไปด้วย ต้อง grant ใหม่ท้ายไฟล์
-- ============================================================

drop function if exists public.get_leaderboard(text);

create or replace function public.get_leaderboard(p_timeframe text)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  currency_value bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_active_season uuid;
  v_days int;
  v_latest_date date;
begin
  if p_timeframe not in ('daily', 'weekly', 'monthly', 'season') then
    raise exception 'invalid timeframe: %', p_timeframe;
  end if;

  select id into v_active_season from public.seasons where status = 'active' limit 1;
  if v_active_season is null then
    return;
  end if;

  -- Season total: ยอดสะสมจริงทั้งซีซั่นจาก game_stats.currency ตรงๆ
  -- ไม่ใช่ delta ระหว่าง snapshot เหมือน 3 timeframe แรก — นี่คือ live
  -- preview ของ ranking เดียวกับที่ distribute_season_rewards() จะใช้
  -- ตอนซีซั่นจบจริง
  if p_timeframe = 'season' then
    return query
      select
        gs.user_id,
        p.username,
        p.display_name,
        p.avatar_url,
        gs.currency as currency_value
      from public.game_stats gs
      join public.profiles p on p.id = gs.user_id
      where gs.season_id = v_active_season
      order by gs.currency desc
      limit 100;
    return;
  end if;

  v_days := case p_timeframe
    when 'daily' then 1
    when 'weekly' then 7
    when 'monthly' then 30
  end;

  select max(snapshot_date) into v_latest_date
  from public.leaderboard_snapshots
  where season_id = v_active_season;

  if v_latest_date is null then
    return;
  end if;

  return query
    select
      latest.user_id,
      p.username,
      p.display_name,
      p.avatar_url,
      greatest(latest.currency - coalesce(earlier.currency, 0), 0) as currency_value
    from public.leaderboard_snapshots latest
    join public.profiles p on p.id = latest.user_id
    left join public.leaderboard_snapshots earlier
      on earlier.user_id = latest.user_id
      and earlier.season_id = latest.season_id
      and earlier.snapshot_date = v_latest_date - v_days
    where latest.season_id = v_active_season
      and latest.snapshot_date = v_latest_date
    order by currency_value desc
    limit 100;
end;
$$;

grant execute on function public.get_leaderboard(text) to anon, authenticated;
