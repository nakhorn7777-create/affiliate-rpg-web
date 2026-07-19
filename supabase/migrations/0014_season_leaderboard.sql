-- ============================================================
-- Season Leaderboard: Daily/Weekly/Monthly currency-gained ranking
-- รันใน Supabase SQL Editor หลังจาก 0001-0013 ถูก apply แล้ว
--
-- ⚠️ ต้องเปิด extension pg_cron ผ่าน Supabase Dashboard →
-- Database → Extensions ด้วยมือก่อนรันไฟล์นี้ (ทั้ง test project และ
-- production แยกกัน — migration SQL เปิด extension นี้เองไม่ได้บน
-- platform ของ Supabase)
--
-- ความหมาย: currency_gained = ส่วนต่างระหว่าง snapshot ล่าสุดกับ
-- snapshot ย้อนหลัง N วัน (daily=1, weekly=7, monthly=30) ไม่ใช่ยอด
-- currency สะสมทั้งหมด — ทำให้แต่ละ tab เป็นการแข่งขันคนละสนามจริง
-- ตาม classic RPG leaderboard loop ไม่ต้องแก้ RPC ที่แจก currency
-- เดิมเลยสักตัว (follow/marketplace/academy ฯลฯ)
-- ============================================================

-- ------------------------------------------------------------
-- 1. LEADERBOARD_SNAPSHOTS
-- ปิดสนิท ไม่มี policy ให้ client เลย (อ่อนไหวกว่ายอดรวมตอนนี้เพราะ
-- เก็บ "ประวัติ" ยอดเงินรายวันของทุกคน) เปิดเผยได้ทางเดียวผ่าน
-- get_leaderboard() RPC เท่านั้น
-- ------------------------------------------------------------
create table public.leaderboard_snapshots (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  snapshot_date date not null,
  currency bigint not null,
  created_at timestamptz not null default now(),
  unique (user_id, season_id, snapshot_date)
);

create index idx_leaderboard_snapshots_lookup
  on public.leaderboard_snapshots(season_id, snapshot_date);

comment on table public.leaderboard_snapshots is 'ยอด currency รายวันของแต่ละ user จับภาพทุกวัน 05:00 ไทยผ่าน pg_cron ใช้คำนวณ currency_gained แบบ daily/weekly/monthly ปิดสนิทไม่มี policy ให้ client เลย';

alter table public.leaderboard_snapshots enable row level security;
-- ตั้งใจไม่เขียน policy ใดๆ เลย (RLS enabled + ไม่มี policy = deny ทั้งหมด)

-- ------------------------------------------------------------
-- 2. Function: จับภาพ snapshot ของ season ที่ active อยู่ตอนนี้
-- เรียกจาก cron เท่านั้น (revoke execute จาก client ด้านล่าง) —
-- idempotent ปลอดภัยถ้าถูกเรียกซ้ำในวันเดียวกัน (upsert ทับแถวเดิม)
-- ------------------------------------------------------------
create or replace function public.capture_leaderboard_snapshot()
returns void as $$
declare
  v_active_season uuid;
begin
  select id into v_active_season from public.seasons where status = 'active' limit 1;
  if v_active_season is null then
    return;
  end if;

  insert into public.leaderboard_snapshots (user_id, season_id, snapshot_date, currency)
  select user_id, season_id, current_date, currency
  from public.game_stats
  where season_id = v_active_season
  on conflict (user_id, season_id, snapshot_date) do update
  set currency = excluded.currency;
end;
$$ language plpgsql security definer;

revoke execute on function public.capture_leaderboard_snapshot() from public, anon, authenticated;

-- ------------------------------------------------------------
-- 3. Function: leaderboard แยกตาม timeframe — public, ใครก็เรียกได้
-- ------------------------------------------------------------
create or replace function public.get_leaderboard(p_timeframe text)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  currency_gained bigint
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
  if p_timeframe not in ('daily', 'weekly', 'monthly') then
    raise exception 'invalid timeframe: %', p_timeframe;
  end if;

  select id into v_active_season from public.seasons where status = 'active' limit 1;
  if v_active_season is null then
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
    greatest(latest.currency - coalesce(earlier.currency, 0), 0) as currency_gained
  from public.leaderboard_snapshots latest
  join public.profiles p on p.id = latest.user_id
  left join public.leaderboard_snapshots earlier
    on earlier.user_id = latest.user_id
    and earlier.season_id = latest.season_id
    and earlier.snapshot_date = v_latest_date - v_days
  where latest.season_id = v_active_season
    and latest.snapshot_date = v_latest_date
  order by currency_gained desc
  limit 100;
end;
$$;

grant execute on function public.get_leaderboard(text) to anon, authenticated;

-- ------------------------------------------------------------
-- 4. Cron: จับภาพทุกวัน 22:00 UTC = 05:00 เช้าไทยของวันถัดไปพอดี
-- ------------------------------------------------------------
select cron.schedule(
  'capture-leaderboard-snapshot',
  '0 22 * * *',
  $$select public.capture_leaderboard_snapshot()$$
);
