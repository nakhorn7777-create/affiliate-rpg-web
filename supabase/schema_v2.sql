-- ============================================================
-- Schema v2: Affiliate Profile + RPG Game (Supabase / PostgreSQL)
-- รันใน Supabase SQL Editor
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. PROFILES
-- 1:1 กับ auth.users
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  bio text,
  tiktok_url text,
  facebook_url text,
  instagram_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'ข้อมูล Affiliate profile ผูก 1:1 กับ auth.users';

-- ============================================================
-- 2. SEASONS
-- ============================================================
create table public.seasons (
  id uuid primary key default uuid_generate_v4(),
  season_number int not null unique,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'upcoming'
    check (status in ('upcoming', 'active', 'ended')),
  created_at timestamptz not null default now()
);

-- บังคับว่ามี season ที่ status = 'active' ได้แค่ 1 season เท่านั้น
-- ในเวลาเดียวกันเสมอ (partial unique index) กันเผลอเปิด 2 season
-- พร้อมกันโดยไม่ตั้งใจ ซึ่งจะทำให้ trigger/function หลายตัวพังทันที
create unique index one_active_season_idx on public.seasons ((true)) where status = 'active';

-- ============================================================
-- 3. FOLLOWERS
-- ระบบ follow ภายในเว็บเราเอง (ไม่ใช่ยอด follower จาก TikTok/FB/IG)
-- follower_id = คนกดติดตาม, following_id = เจ้าของโปรไฟล์ที่ถูกติดตาม
-- ไม่มี unfollow แต่ follow ซ้ำได้ใหม่ทุก season -> unique รวม season_id ด้วย
-- ============================================================
create table public.followers (
  id uuid primary key default uuid_generate_v4(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint no_self_follow check (follower_id <> following_id),
  unique (follower_id, following_id, season_id)
);

create index idx_followers_following_id on public.followers(following_id);
create index idx_followers_season_id on public.followers(season_id);

comment on table public.followers is 'ระบบติดตามภายในเว็บ follow ได้ใหม่ทุก season (ไม่มี unfollow) unique ต่อ (follower, following, season)';

-- ============================================================
-- 4. AFFILIATE_LINKS
-- ปกติจำกัด 10 ช่อง/คน, subscriber (tier platinum/legendary) ได้ 100 ช่อง
-- ตรวจสอบ cap จริงผ่าน trigger validate_affiliate_slot (ด้านล่าง หลัง
-- ตาราง game_stats เพราะต้อง query tier)
-- ============================================================
create table public.affiliate_links (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  slot_number smallint not null check (slot_number between 1 and 100),
  title text not null,
  url text not null,
  image_url text,
  description text,
  click_count bigint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slot_number)
);

create index idx_affiliate_links_user_id on public.affiliate_links(user_id);

comment on table public.affiliate_links is 'ลิงก์สินค้า/ผลงาน สูงสุด 10 ช่อง (100 ช่องถ้าเป็น subscriber) บังคับผ่าน trigger';

-- ============================================================
-- 5. PROFILE_VIEWS
-- คนดูโปรไฟล์ = ได้ token ให้เจ้าของโปรไฟล์
-- ต้อง login ก่อนถึงจะนับ (viewer_id not null)
-- จำกัด 1 ครั้ง/คนดู/โปรไฟล์/วัน กันปั่นยอด
-- ============================================================
create table public.profile_views (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  view_date date not null default current_date,
  viewed_at timestamptz not null default now(),
  constraint no_self_view check (profile_id <> viewer_id),
  unique (profile_id, viewer_id, view_date)
);

create index idx_profile_views_profile_id on public.profile_views(profile_id);

comment on table public.profile_views is 'บันทึกการเข้าชมโปรไฟล์ที่ผ่าน login แล้ว จำกัด 1 ครั้ง/คน/โปรไฟล์/วัน สำหรับแจก token';

-- ============================================================
-- Function: คำนวณ Tier ของผู้เล่น จาก (จำนวนวันล็อกอินสะสม, สถานะ subscribe)
-- Tier ladder: copper(0) < silver(1) < gold(2) < platinum(3) < legendary(4)
--
-- สายฟรี: 0-29 วัน = copper, 30-59 = silver, 60-89 = gold, 90+ = platinum
-- สาย subscribe: เอา index ตามวัน + 3 แล้ว cap ที่ legendary (4) สูงสุด
--   เช่น copper(0)+3 = platinum(3), silver(1)+3 = legendary(4, cap แล้ว)
-- เป็น generated column เพื่อไม่ต้องมี trigger คอยอัปเดต tier เอง
-- ============================================================
create or replace function public.compute_tier(p_days int, p_is_subscribed boolean)
returns text as $$
declare
  v_tiers text[] := array['copper', 'silver', 'gold', 'platinum', 'legendary'];
  v_natural_index int;
  v_final_index int;
begin
  v_natural_index := case
    when p_days >= 90 then 3
    when p_days >= 60 then 2
    when p_days >= 30 then 1
    else 0
  end;

  v_final_index := case
    when p_is_subscribed then least(v_natural_index + 3, 4)
    else v_natural_index
  end;

  return v_tiers[v_final_index + 1]; -- array index ของ Postgres เริ่มที่ 1
end;
$$ language plpgsql immutable;

-- ============================================================
-- 6. GAME_STATS
-- token/level/xp ของผู้เล่นต่อซีซั่น + สถานะ tier/subscription
-- ============================================================
create table public.game_stats (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  currency bigint not null default 0 check (currency >= 0),
  level int not null default 1,
  xp bigint not null default 0,
  total_login_days int not null default 0 check (total_login_days >= 0),
  last_login_date date,
  is_subscribed boolean not null default false,
  subscription_started_at timestamptz,
  subscription_expires_at timestamptz,
  follow_tokens_earned bigint not null default 0
    check (follow_tokens_earned >= 0 and follow_tokens_earned <= 1000),
  tier text generated always as (public.compute_tier(total_login_days, is_subscribed)) stored,
  updated_at timestamptz not null default now(),
  unique (user_id, season_id)
);

create index idx_game_stats_user_id on public.game_stats(user_id);
create index idx_game_stats_season_id on public.game_stats(season_id);

comment on table public.game_stats is 'token/level/xp/tier/สถานะ subscription ของผู้เล่นต่อซีซั่น';

-- ============================================================
-- Function: บันทึกการล็อกอินรายวัน เรียกทุกครั้งที่ผู้ใช้เข้าเว็บ
-- (นับวันสะสม ไม่ใช่ streak ต่อเนื่อง — ขาดวันไหนไม่เป็นไร วันที่ตามมา
-- ยังนับสะสมต่อได้) เพิ่ม total_login_days แค่ 1 ครั้งต่อวันปฏิทิน
-- ============================================================
create or replace function public.record_daily_login(p_user_id uuid, p_season_id uuid)
returns void as $$
begin
  insert into public.game_stats (user_id, season_id, total_login_days, last_login_date)
  values (p_user_id, p_season_id, 1, current_date)
  on conflict (user_id, season_id) do update
  set total_login_days = public.game_stats.total_login_days + 1,
      last_login_date = current_date
  where public.game_stats.last_login_date is distinct from current_date;
end;
$$ language plpgsql security definer;

-- ============================================================
-- Function: เปิดใช้งาน subscription ให้ผู้เล่น
-- มีผลถึงวันจบ season (subscription_expires_at = seasons.ends_at)
-- ============================================================
create or replace function public.subscribe_player(p_user_id uuid, p_season_id uuid)
returns void as $$
declare
  v_season_ends_at timestamptz;
begin
  select ends_at into v_season_ends_at
  from public.seasons
  where id = p_season_id;

  if v_season_ends_at is null then
    raise exception 'ไม่พบ season ที่ระบุ';
  end if;

  insert into public.game_stats (user_id, season_id, is_subscribed, subscription_started_at, subscription_expires_at)
  values (p_user_id, p_season_id, true, now(), v_season_ends_at)
  on conflict (user_id, season_id) do update
  set is_subscribed = true,
      subscription_started_at = now(),
      subscription_expires_at = v_season_ends_at;
end;
$$ language plpgsql security definer;

-- ============================================================
-- SUBSCRIPTION_CODES
-- โค้ด subscribe ฟรี (ช่วงแรกของโปรเจกต์ ก่อนมีระบบจ่ายเงินจริง)
-- 1 โค้ด ใช้ได้ครั้งเดียว
-- ============================================================
create table public.subscription_codes (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,
  is_used boolean not null default false,
  used_by uuid references public.profiles(id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.subscription_codes is 'โค้ด subscribe ฟรีสำหรับแจกช่วงแรก ใช้ได้ครั้งเดียวต่อโค้ด';

create or replace function public.redeem_subscription_code(
  p_code text,
  p_user_id uuid,
  p_season_id uuid
) returns void as $$
declare
  v_code record;
begin
  select * into v_code
  from public.subscription_codes
  where code = p_code
  for update; -- ล็อกกันคน 2 คนใช้โค้ดเดียวกันพร้อมกัน

  if v_code is null then
    raise exception 'โค้ดไม่ถูกต้อง';
  end if;

  if v_code.is_used then
    raise exception 'โค้ดนี้ถูกใช้ไปแล้ว';
  end if;

  update public.subscription_codes
  set is_used = true, used_by = p_user_id, used_at = now()
  where id = v_code.id;

  perform public.subscribe_player(p_user_id, p_season_id);
end;
$$ language plpgsql security definer;

-- ============================================================
-- SUBSCRIPTION_CANCELLATIONS
-- ยกเลิก subscription ทำได้ทาง admin เท่านั้น (ติดต่อ admin ให้ยกเลิกให้)
-- คืนเงินเกิดขึ้นทีหลังผ่านระบบจ่ายเงินจริง เก็บสถานะ refund ไว้ track
-- ============================================================
create table public.subscription_cancellations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  cancelled_by uuid not null references public.profiles(id),
  refund_status text not null default 'pending'
    check (refund_status in ('pending', 'refunded', 'not_applicable')),
  cancelled_at timestamptz not null default now(),
  refunded_at timestamptz
);

comment on table public.subscription_cancellations is 'ประวัติการยกเลิก subscription โดย admin พร้อม track สถานะคืนเงิน';

create or replace function public.admin_cancel_subscription(
  p_user_id uuid,
  p_season_id uuid,
  p_admin_id uuid
) returns void as $$
begin
  update public.game_stats
  set is_subscribed = false,
      subscription_expires_at = now()
  where user_id = p_user_id and season_id = p_season_id;

  insert into public.subscription_cancellations (user_id, season_id, cancelled_by)
  values (p_user_id, p_season_id, p_admin_id);
end;
$$ language plpgsql security definer;

-- ============================================================
-- ANTI-FRAUD: SIGNUP_AUDIT_LOG
-- เก็บ IP + User-Agent ตอนสมัครสมาชิก เพื่อตรวจจับบัญชีผีจำนวนมาก
-- จาก IP เดียวกัน
--
-- สำคัญ: ตารางนี้ปิดสนิท (ไม่มี select policy ให้ client เลย) เพราะ
-- IP/User-Agent เป็นข้อมูลส่วนบุคคลอ่อนไหว (PDPA) เข้าถึงได้เฉพาะผ่าน
-- service role (แผง admin) เท่านั้น
--
-- ข้อควรรู้ทางเทคนิค: Postgres trigger ไม่สามารถอ่าน IP จริงของ client
-- ได้เอง ต้องให้ Edge Function (ที่รับ request ตรงจาก browser) ดึง IP
-- จาก request header (เช่น cf-connecting-ip ถ้าอยู่หลัง Cloudflare)
-- แล้วส่งเป็น parameter ที่เชื่อถือได้เข้ามาที่ฟังก์ชัน record_signup_ip
-- ด้านล่าง -- ห้ามให้ client ส่ง IP ของตัวเองมาโดยตรงเด็ดขาด เพราะ
-- ปลอมแปลงได้ง่าย
-- ============================================================
create table public.signup_audit_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  ip_address inet not null,
  user_agent text,
  turnstile_verified boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_signup_audit_log_ip_date on public.signup_audit_log(ip_address, created_at);

comment on table public.signup_audit_log is 'IP/User-Agent ตอนสมัครสมาชิก บันทึกโดย Edge Function เท่านั้น (ไม่ใช่ client โดยตรง) ปิดสนิทไม่มี select policy';

-- ============================================================
-- ANTI-FRAUD: FRAUD_FLAGS
-- เคสที่ตรวจพบว่าน่าสงสัย (เช่น IP เดียวกันสมัครเกิน 3 บัญชี/วัน)
-- ไม่บล็อกอัตโนมัติ แค่ flag ไว้ให้ admin ตรวจสอบทีหลัง
-- ============================================================
create table public.fraud_flags (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  flag_type text not null check (flag_type in ('multi_account_ip')),
  reason text not null,
  detected_at timestamptz not null default now(),
  reviewed boolean not null default false,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  admin_action text
);

create index idx_fraud_flags_reviewed on public.fraud_flags(reviewed);

comment on table public.fraud_flags is 'เคสต้องสงสัยที่ระบบตรวจพบอัตโนมัติ รอ admin ตรวจสอบ ไม่บล็อก token ทันที';

-- ============================================================
-- Function: บันทึก IP ตอนสมัครสมาชิก + ตรวจสอบว่า IP นี้สมัคร
-- เกิน 3 บัญชีในวันเดียวกันหรือไม่ (ถ้าเกิน = flag ไว้ ไม่บล็อก token)
-- เรียกจาก Edge Function ทันทีหลัง signup สำเร็จ พร้อม IP จริงที่ดัก
-- ได้จาก request header (ไม่ใช่ IP ที่ client ส่งมาเอง)
-- ============================================================
create or replace function public.record_signup_ip(
  p_user_id uuid,
  p_ip inet,
  p_user_agent text,
  p_turnstile_verified boolean
) returns void as $$
declare
  v_accounts_today int;
begin
  insert into public.signup_audit_log (user_id, ip_address, user_agent, turnstile_verified)
  values (p_user_id, p_ip, p_user_agent, p_turnstile_verified);

  select count(distinct user_id) into v_accounts_today
  from public.signup_audit_log
  where ip_address = p_ip
    and created_at::date = current_date;

  if v_accounts_today > 3 then
    insert into public.fraud_flags (user_id, flag_type, reason)
    values (
      p_user_id,
      'multi_account_ip',
      format('IP %s สมัครไปแล้ว %s บัญชีในวันนี้ (เกินเกณฑ์ 3 บัญชี/วัน)', p_ip, v_accounts_today)
    );
  end if;
end;
$$ language plpgsql security definer;

-- ============================================================
-- Function: admin ตรวจสอบ fraud flag แล้วปิดเคส พร้อมบันทึกว่าทำอะไรไป
-- (เช่น 'no_action', 'account_banned', 'tokens_revoked')
-- ============================================================
create or replace function public.admin_resolve_fraud_flag(
  p_flag_id uuid,
  p_admin_id uuid,
  p_action text
) returns void as $$
begin
  update public.fraud_flags
  set reviewed = true,
      reviewed_by = p_admin_id,
      reviewed_at = now(),
      admin_action = p_action
  where id = p_flag_id;
end;
$$ language plpgsql security definer;

-- ============================================================
-- Function: จำนวนช่อง affiliate_links สูงสุดที่ผู้ใช้คนนี้ได้สิทธิ์
-- ดูจาก tier ของ season ที่ active อยู่ตอนนี้ (platinum/legendary = 100, อื่นๆ = 10)
-- ============================================================
create or replace function public.get_max_affiliate_slots(p_user_id uuid)
returns int as $$
declare
  v_active_season uuid;
  v_tier text;
begin
  select id into v_active_season from public.seasons where status = 'active' limit 1;

  if v_active_season is null then
    return 10;
  end if;

  select tier into v_tier
  from public.game_stats
  where user_id = p_user_id and season_id = v_active_season;

  if v_tier in ('platinum', 'legendary') then
    return 100;
  else
    return 10;
  end if;
end;
$$ language plpgsql stable;

-- ============================================================
-- Trigger: ตรวจสอบว่า slot_number ที่จะตั้งขาย/เพิ่มลิงก์ ไม่เกินสิทธิ์
-- ปัจจุบันของผู้ใช้ (10 ปกติ / 100 ถ้าเป็น subscriber)
-- ============================================================
create or replace function public.validate_affiliate_slot()
returns trigger as $$
declare
  v_max int;
begin
  v_max := public.get_max_affiliate_slots(new.user_id);

  if new.slot_number > v_max then
    raise exception 'slot % เกินสิทธิ์ปัจจุบัน (สูงสุด % ช่อง)', new.slot_number, v_max;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger validate_affiliate_slot_trigger
  before insert or update on public.affiliate_links
  for each row execute function public.validate_affiliate_slot();

-- ============================================================
-- 7. GAME_ITEMS
-- master data ไอเทม/ทรัพยากรทั้งหมดในเกม (ไม่ผูกกับ season)
-- ============================================================
create table public.game_items (
  id uuid primary key default uuid_generate_v4(),
  item_key text unique not null,
  name text not null,
  description text,
  item_type text not null check (item_type in ('resource', 'crafted', 'tool')),
  icon_url text,
  is_tradeable boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.game_items is 'รายการไอเทม/ทรัพยากรทั้งหมดในเกม เป็น master data ไม่ผูก season';

-- ============================================================
-- 8. CRAFTING_RECIPES + INGREDIENTS
-- 1 recipe ผลิตได้ 1 item, ใช้วัตถุดิบได้หลายชนิด (junction table)
-- ============================================================
create table public.crafting_recipes (
  id uuid primary key default uuid_generate_v4(),
  result_item_id uuid not null references public.game_items(id) on delete cascade,
  result_quantity int not null default 1,
  description text,
  created_at timestamptz not null default now()
);

create table public.crafting_recipe_ingredients (
  recipe_id uuid not null references public.crafting_recipes(id) on delete cascade,
  item_id uuid not null references public.game_items(id) on delete cascade,
  quantity int not null check (quantity > 0),
  primary key (recipe_id, item_id)
);

comment on table public.crafting_recipes is 'สูตร crafting: 1 recipe -> 1 ผลลัพธ์';
comment on table public.crafting_recipe_ingredients is 'วัตถุดิบที่ต้องใช้ต่อ 1 recipe (many-to-many กับ game_items)';

-- ============================================================
-- 9. PLAYER_INVENTORY
-- ไอเทมที่ผู้เล่นถืออยู่จริง ต่อซีซั่น
-- ============================================================
create table public.player_inventory (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  item_id uuid not null references public.game_items(id) on delete cascade,
  quantity bigint not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  unique (user_id, season_id, item_id)
);

create index idx_player_inventory_user_season on public.player_inventory(user_id, season_id);

comment on table public.player_inventory is 'คลังไอเทมจริงของผู้เล่น แยกตาม season เพื่อรีเซ็ตง่าย';

-- ============================================================
-- Function: จำนวนช่องใหญ่คลังเก็บของ ที่ผู้ใช้คนนี้ได้สิทธิ์
-- ปกติ 5 ช่องใหญ่ / subscriber (tier platinum, legendary) ได้ 50 ช่องใหญ่
-- 1 ช่องใหญ่ = 20 ช่องเล็ก, 1 ช่องเล็ก เก็บไอเทมชนิดเดียวได้สูงสุด 99 ชิ้น
-- ============================================================
create or replace function public.get_max_storage_big_slots(p_user_id uuid)
returns int as $$
declare
  v_active_season uuid;
  v_tier text;
begin
  select id into v_active_season from public.seasons where status = 'active' limit 1;

  if v_active_season is null then
    return 5;
  end if;

  select tier into v_tier
  from public.game_stats
  where user_id = p_user_id and season_id = v_active_season;

  if v_tier in ('platinum', 'legendary') then
    return 50;
  else
    return 5;
  end if;
end;
$$ language plpgsql stable;

-- ============================================================
-- Trigger: ตรวจสอบความจุคลังก่อน insert/update player_inventory
-- คำนวณ "ช่องเล็กที่ใช้ไป" จากทุกไอเทมของ user คนนี้ในซีซั่นนี้
-- (แต่ละไอเทม ceil(quantity / 99) ช่องเล็ก) รวมกันต้องไม่เกิน
-- max_big_slots * 20 ช่องเล็ก
-- หมายเหตุ: เป็นการประมาณด้วย quantity รวม ไม่ได้ผูก stack เป็นราย
-- ช่องจริงจัง (เพียงพอสำหรับ enforce ความจุ ไม่ต้องเพิ่มตารางใหม่)
-- ============================================================
create or replace function public.validate_inventory_capacity()
returns trigger as $$
declare
  v_max_small_slots int;
  v_used_small_slots numeric;
begin
  v_max_small_slots := public.get_max_storage_big_slots(new.user_id) * 20;

  select coalesce(sum(ceil(quantity::numeric / 99)), 0)
  into v_used_small_slots
  from public.player_inventory
  where user_id = new.user_id
    and season_id = new.season_id
    and item_id <> new.item_id;

  v_used_small_slots := v_used_small_slots + ceil(new.quantity::numeric / 99);

  if v_used_small_slots > v_max_small_slots then
    raise exception 'คลังเก็บของเต็ม (ใช้ % จาก % ช่องเล็ก)', v_used_small_slots, v_max_small_slots;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger validate_inventory_capacity_trigger
  before insert or update on public.player_inventory
  for each row execute function public.validate_inventory_capacity();

-- ============================================================
-- 10. MARKETPLACE_LISTINGS + TRANSACTIONS
-- ตลาดกลางซื้อขายด้วย token เดียว ผูกกับ season (รีเซ็ตกันเงินเฟ้อ)
-- จำกัด 10 ช่องขายต่อคนต่อ season (เหมือน affiliate_links)
-- ============================================================
create table public.marketplace_listings (
  id uuid primary key default uuid_generate_v4(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  item_id uuid not null references public.game_items(id) on delete cascade,
  slot_number smallint not null check (slot_number between 1 and 10),
  quantity bigint not null check (quantity > 0),
  price_per_unit bigint not null check (price_per_unit > 0),
  status text not null default 'active'
    check (status in ('active', 'sold', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (seller_id, season_id, slot_number)
);

create index idx_marketplace_listings_season on public.marketplace_listings(season_id, status);
create index idx_marketplace_listings_item on public.marketplace_listings(item_id, season_id);

create table public.marketplace_transactions (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  quantity bigint not null check (quantity > 0),
  total_price bigint not null check (total_price > 0),
  transacted_at timestamptz not null default now()
);

comment on table public.marketplace_listings is 'รายการขายไอเทมในตลาดกลาง จำกัด 10 slot ต่อคนต่อ season';
comment on table public.marketplace_transactions is 'ประวัติการซื้อขายจริงในตลาดกลาง ใช้คำนวณเพดานราคาด้วย';

-- ============================================================
-- 10b. ITEM_PRICE_BANDS
-- เพดานราคาต่อไอเทม ต่อ season คำนวณใหม่ทุกๆ 100 ชิ้นที่ขายได้
-- batch_number 1 = ครบ 100 ชิ้นแรก, 2 = ครบ 200 ชิ้น, ...
-- ก่อนมี batch แรก (ยังไม่ครบ 100 ชิ้น) ราคาตั้งได้อิสระ ไม่มีเพดาน
-- ============================================================
create table public.item_price_bands (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid not null references public.game_items(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  batch_number int not null check (batch_number > 0),
  avg_price numeric not null,
  min_price bigint not null,
  max_price bigint not null,
  effective_from timestamptz not null default now(),
  unique (item_id, season_id, batch_number)
);

comment on table public.item_price_bands is 'เพดานราคาต่อไอเทม/season คำนวณจากราคาเฉลี่ยของทุกๆ 100 ชิ้นที่ขายได้ล่าสุด';

-- ============================================================
-- 11. SEASON_REWARDS
-- ถ้วยรางวัลถาวร แสดงในหน้า profile
-- ============================================================
create table public.season_rewards (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  trophy_name text not null,
  trophy_tier text not null check (trophy_tier in ('gold', 'silver', 'bronze', 'participation')),
  rank_in_season int,
  awarded_at timestamptz not null default now()
);

create index idx_season_rewards_user_id on public.season_rewards(user_id);

comment on table public.season_rewards is 'ถ้วยรางวัลถาวร: top 3 currency ได้ gold/silver/bronze คนอื่นได้ participation';

-- ============================================================
-- Trigger: เมื่อมีคน follow ใหม่ -> ตรวจสอบว่า season_id ที่ส่งมา
-- ตรงกับ season ที่ active อยู่จริง (กัน client ส่ง season เก่ามาปั่น token)
-- แล้วแจก +1 token ให้เจ้าของโปรไฟล์ (following_id) ทันที (สูงสุดไม่เกิน
-- 1000 token/season จากช่องทาง follow เท่านั้น เพื่อกัน "follow farm"
-- ปั๊ม token ไม่จำกัด -- ตัว follow row ยังถูกบันทึกและนับยอด follower
-- ตามปกติเสมอ แค่ไม่แจก currency เพิ่มถ้าเกินเพดานแล้ว)
-- ============================================================
create or replace function public.handle_new_follow()
returns trigger as $$
declare
  current_active_season uuid;
begin
  select id into current_active_season
  from public.seasons
  where status = 'active'
  limit 1;

  if current_active_season is null or new.season_id <> current_active_season then
    raise exception 'season_id ไม่ตรงกับ season ที่ active อยู่ในขณะนี้';
  end if;

  insert into public.game_stats (user_id, season_id, currency, follow_tokens_earned)
  values (new.following_id, new.season_id, 1, 1)
  on conflict (user_id, season_id) do update
  set currency = public.game_stats.currency
        + case when public.game_stats.follow_tokens_earned < 1000 then 1 else 0 end,
      follow_tokens_earned = least(public.game_stats.follow_tokens_earned + 1, 1000);

  return new;
end;
$$ language plpgsql security definer;

create trigger on_new_follow
  after insert on public.followers
  for each row execute function public.handle_new_follow();

-- ============================================================
-- Views: สรุปยอด follower สำหรับหน้า Profile
-- security_invoker = true เพื่อให้ RLS ของตาราง followers มีผลตอน query view
-- ============================================================

-- ยอดรวม follower ทุก season บวกกัน ต่อ 1 โปรไฟล์
create view public.follower_totals
with (security_invoker = true) as
select
  following_id as profile_id,
  count(*) as total_followers
from public.followers
group by following_id;

-- ยอด follower แยกรายซีซั่น ต่อ 1 โปรไฟล์ (ใช้แสดงตอนคลิกดูรายละเอียด)
create view public.follower_by_season
with (security_invoker = true) as
select
  f.following_id as profile_id,
  f.season_id,
  s.season_number,
  s.starts_at,
  s.ends_at,
  count(*) as follower_count
from public.followers f
join public.seasons s on s.id = f.season_id
group by f.following_id, f.season_id, s.season_number, s.starts_at, s.ends_at;

comment on view public.follower_totals is 'ยอด follower รวมทุก season ของแต่ละโปรไฟล์';
comment on view public.follower_by_season is 'ยอด follower แยกรายซีซั่น ใช้แสดงตอนกดดูประวัติย้อนหลัง';

-- ============================================================
-- Trigger: ตอนตั้งขาย (insert marketplace_listings) ให้หักไอเทม
-- ออกจาก player_inventory ของผู้ขายทันที (กันเอาไอเทมเดียวไปตั้งขายซ้ำ
-- หลาย listing) ถ้าของไม่พอจะ error
-- ============================================================
create or replace function public.reserve_inventory_on_listing()
returns trigger as $$
begin
  update public.player_inventory
  set quantity = quantity - new.quantity
  where user_id = new.seller_id
    and season_id = new.season_id
    and item_id = new.item_id
    and quantity >= new.quantity;

  if not found then
    raise exception 'ไอเทมในคลังไม่พอสำหรับตั้งขายจำนวนนี้';
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger reserve_inventory_before_listing
  before insert on public.marketplace_listings
  for each row execute function public.reserve_inventory_on_listing();

-- ============================================================
-- Trigger: ถ้าผู้ขายยกเลิก listing (status -> cancelled)
-- ให้คืนไอเทมที่เหลือกลับเข้า player_inventory
-- ============================================================
create or replace function public.return_inventory_on_cancel()
returns trigger as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    insert into public.player_inventory (user_id, season_id, item_id, quantity)
    values (new.seller_id, new.season_id, new.item_id, new.quantity)
    on conflict (user_id, season_id, item_id)
    do update set quantity = public.player_inventory.quantity + new.quantity;
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger return_inventory_after_cancel
  after update on public.marketplace_listings
  for each row execute function public.return_inventory_on_cancel();

-- ============================================================
-- Trigger: ตรวจสอบราคาที่ตั้งขาย ต้องอยู่ในเพดานล่าสุดของไอเทมนั้น
-- (ถ้ายังไม่มี batch ไหนเลย = ยังไม่ครบ 100 ชิ้นแรก ตั้งราคาอิสระได้)
-- ============================================================
create or replace function public.validate_listing_price()
returns trigger as $$
declare
  v_band record;
begin
  select * into v_band
  from public.item_price_bands
  where item_id = new.item_id and season_id = new.season_id
  order by batch_number desc
  limit 1;

  if v_band is not null then
    if new.price_per_unit > v_band.max_price or new.price_per_unit < v_band.min_price then
      raise exception 'ราคาต้องอยู่ระหว่าง % ถึง % token (เพดานปัจจุบันของไอเทมนี้)',
        v_band.min_price, v_band.max_price;
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger validate_listing_price_trigger
  before insert on public.marketplace_listings
  for each row execute function public.validate_listing_price();

-- ============================================================
-- Function: คำนวณเพดานราคาใหม่ ทุกๆ 100 ชิ้นที่ขายได้ต่อไอเทม/season
-- ราคาเฉลี่ยของ 100 ชิ้นล่าสุด -> min = เฉลี่ย x 0.5, max = เฉลี่ย x 2
-- หมายเหตุ: กรณี transaction เดียวคาบเกี่ยว 2 batch (เช่น ซื้อ 15 ชิ้น
-- ตอนเหลืออีก 5 ชิ้นจะครบ 100) ฟังก์ชันนี้จะนับ transaction นั้นเข้า
-- batch ที่ทำให้ครบเป็นหลัก (ประมาณการ ไม่ได้แบ่งเศษ quantity ในทรานแซกชัน)
-- ============================================================
create or replace function public.recalc_price_band(p_item_id uuid, p_season_id uuid)
returns void as $$
declare
  v_total_sold bigint;
  v_current_batch int;
  v_last_recorded_batch int;
  v_batch_start bigint;
  v_batch_end bigint;
  v_avg_price numeric;
begin
  select coalesce(sum(mt.quantity), 0)
  into v_total_sold
  from public.marketplace_transactions mt
  join public.marketplace_listings ml on ml.id = mt.listing_id
  where ml.item_id = p_item_id and ml.season_id = p_season_id;

  v_current_batch := v_total_sold / 100;

  select coalesce(max(batch_number), 0)
  into v_last_recorded_batch
  from public.item_price_bands
  where item_id = p_item_id and season_id = p_season_id;

  if v_current_batch > v_last_recorded_batch then
    v_batch_start := (v_current_batch - 1) * 100 + 1;
    v_batch_end := v_current_batch * 100;

    select sum(total_price)::numeric / nullif(sum(quantity), 0)
    into v_avg_price
    from (
      select
        mt.total_price,
        mt.quantity,
        sum(mt.quantity) over (order by mt.transacted_at) as running_total
      from public.marketplace_transactions mt
      join public.marketplace_listings ml on ml.id = mt.listing_id
      where ml.item_id = p_item_id and ml.season_id = p_season_id
    ) batched
    where running_total > v_batch_start - 1 and running_total <= v_batch_end;

    if v_avg_price is not null then
      insert into public.item_price_bands (item_id, season_id, batch_number, avg_price, min_price, max_price)
      values (
        p_item_id,
        p_season_id,
        v_current_batch,
        v_avg_price,
        greatest(floor(v_avg_price * 0.5), 1),
        floor(v_avg_price * 2)
      )
      on conflict (item_id, season_id, batch_number) do nothing;
    end if;
  end if;
end;
$$ language plpgsql;

-- ============================================================
-- Function: อัตราภาษี marketplace ตาม tier ของผู้ขาย
-- copper/silver/gold = 30%, platinum = 15%, legendary = 10%
-- ============================================================
create or replace function public.get_marketplace_tax_rate(p_tier text)
returns numeric as $$
begin
  return case p_tier
    when 'legendary' then 0.10
    when 'platinum' then 0.15
    else 0.30 -- copper, silver, gold
  end;
end;
$$ language plpgsql immutable;

-- ============================================================
-- Function: ซื้อสินค้าจากตลาดกลาง (atomic, กัน race condition ด้วย
-- "select ... for update" ล็อก row ของ listing ก่อนแก้ไข)
-- หักภาษีตาม tier ผู้ขาย ปัดเศษลง แล้วโอน token ให้ผู้ขาย
-- ============================================================
create or replace function public.purchase_from_listing(
  p_listing_id uuid,
  p_buyer_id uuid,
  p_quantity bigint
) returns void as $$
declare
  v_listing record;
  v_total_price bigint;
  v_tax bigint;
  v_seller_receive bigint;
  v_seller_tier text;
  v_tax_rate numeric;
begin
  select * into v_listing
  from public.marketplace_listings
  where id = p_listing_id
  for update; -- ล็อก row กันคนอื่นซื้อ listing เดียวกันพร้อมกัน

  if v_listing is null or v_listing.status <> 'active' then
    raise exception 'listing นี้ไม่พร้อมขายแล้ว';
  end if;

  -- Freeze check: season ต้อง active จริง (ไม่ใช่ ended/upcoming) ถึงจะ
  -- ซื้อขายได้ กันเคส listing ยัง status='active' ค้างอยู่แต่ season
  -- จบไปแล้ว (เช่น edge case ระหว่างรอ cron ปิด listing)
  if not exists (
    select 1 from public.seasons
    where id = v_listing.season_id and status = 'active'
  ) then
    raise exception 'ซีซั่นนี้ปิดการซื้อขายแล้ว (freeze)';
  end if;

  if v_listing.seller_id = p_buyer_id then
    raise exception 'ไม่สามารถซื้อของจากร้านตัวเองได้';
  end if;

  if p_quantity > v_listing.quantity then
    raise exception 'สินค้าที่เหลือไม่พอ (เหลือ % ชิ้น)', v_listing.quantity;
  end if;

  -- ภาษี marketplace อิงตาม tier ของผู้ขาย ณ ขณะขาย
  -- copper/silver/gold = 30%, platinum = 15%, legendary = 10%
  select tier into v_seller_tier
  from public.game_stats
  where user_id = v_listing.seller_id and season_id = v_listing.season_id;

  v_tax_rate := public.get_marketplace_tax_rate(coalesce(v_seller_tier, 'copper'));

  v_total_price := p_quantity * v_listing.price_per_unit;
  v_tax := floor(v_total_price * v_tax_rate); -- ปัดเศษภาษีลง (floor)
  v_seller_receive := v_total_price - v_tax;

  update public.game_stats
  set currency = currency - v_total_price
  where user_id = p_buyer_id
    and season_id = v_listing.season_id
    and currency >= v_total_price;

  if not found then
    raise exception 'token ไม่พอสำหรับซื้อสินค้านี้';
  end if;

  insert into public.game_stats (user_id, season_id, currency)
  values (v_listing.seller_id, v_listing.season_id, v_seller_receive)
  on conflict (user_id, season_id)
  do update set currency = public.game_stats.currency + v_seller_receive;

  update public.marketplace_listings
  set quantity = quantity - p_quantity,
      status = case when quantity - p_quantity <= 0 then 'sold' else status end
  where id = p_listing_id;

  insert into public.player_inventory (user_id, season_id, item_id, quantity)
  values (p_buyer_id, v_listing.season_id, v_listing.item_id, p_quantity)
  on conflict (user_id, season_id, item_id)
  do update set quantity = public.player_inventory.quantity + p_quantity;

  insert into public.marketplace_transactions (listing_id, buyer_id, quantity, total_price)
  values (p_listing_id, p_buyer_id, p_quantity, v_total_price);

  perform public.recalc_price_band(v_listing.item_id, v_listing.season_id);
end;
$$ language plpgsql security definer;

-- ============================================================
-- Trigger: สร้างแถวใน profiles อัตโนมัติเมื่อมีผู้ใช้ใหม่
-- (รองรับทั้ง Google OAuth และ Magic Link/OTP)
--
-- แก้ปัญหา username ชนกัน: base username จาก email อาจซ้ำกันได้
-- ระหว่าง 2 คน (เช่น john@gmail.com กับ john@hotmail.com ต่างก็ได้
-- "john" เหมือนกัน) ถ้า insert ตรงๆ จะชน unique constraint แล้ว
-- signup พังทั้งที่ไม่ใช่ความผิดผู้ใช้ ต้องวนเช็คแล้วเติมเลขต่อท้าย
-- ให้อัตโนมัติจนกว่าจะไม่ซ้ำ
--
-- ถ้า signup ผ่าน Google OAuth, raw_user_meta_data จะมี full_name/
-- avatar_url ให้ใช้เติม profile ได้ทันที (Magic Link จะไม่มีค่านี้
-- เพราะไม่ได้ผ่าน OAuth provider ใดๆ จะเป็น null ไปก่อน ให้ผู้ใช้
-- มาตั้งเองทีหลังในหน้า edit profile)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_base_username text;
  v_final_username text;
  v_suffix int := 0;
begin
  v_base_username := coalesce(
    nullif(new.raw_user_meta_data ->> 'username', ''),
    split_part(new.email, '@', 1)
  );
  v_final_username := v_base_username;

  while exists (select 1 from public.profiles where username = v_final_username) loop
    v_suffix := v_suffix + 1;
    v_final_username := v_base_username || v_suffix::text;
  end loop;

  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    v_final_username,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- ============================================================
-- SEASON-END AUTOMATION
-- หมายเหตุสำคัญ: "reset season" ส่วนใหญ่ไม่ต้องทำอะไรเลย เพราะ
-- game_stats/player_inventory/marketplace_listings ผูกกับ season_id
-- อยู่แล้วตั้งแต่ต้น พอเริ่ม season ใหม่ (season_id ใหม่) ข้อมูล
-- ของผู้เล่นก็ "เริ่มจาก 0" โดยอัตโนมัติเพราะยังไม่มี row สำหรับ
-- season นั้นเลย -- ข้อมูล season เก่ายังอยู่ครบทุก row ไม่ต้อง
-- archive แยกตาราง แค่ frontend query กรอง season_id = active เท่านั้น
--
-- สิ่งที่ต้องทำจริงตอนจบ season มีแค่ 4 อย่าง:
--   1. auto-cancel marketplace listings ที่ค้าง (คืนของอัตโนมัติ)
--   2. แจกถ้วยรางวัล (top 3 + participation)
--   3. เปลี่ยนสถานะ season เป็น ended (freeze)
--   4. Log แจ้งเตือนล่วงหน้า 3/2/1 วัน
-- ============================================================
-- ============================================================

-- ============================================================
-- SEASON_NOTIFICATIONS_LOG
-- กันส่งแจ้งเตือนซ้ำ (unique ต่อ season+ประเภทแจ้งเตือน)
-- หมายเหตุ: ตารางนี้แค่ "log ว่าควรแจ้งเตือนแล้ว" ส่วนการส่งจริง
-- (อีเมล/push notification) ต้องทำผ่าน Edge Function ที่ Postgres
-- เรียกออกไปด้วย pg_net extension (ดู cron schedule ด้านล่าง)
-- เพราะ Postgres เองส่งอีเมล/push โดยตรงไม่ได้
-- ============================================================
create table public.season_notifications_log (
  id uuid primary key default uuid_generate_v4(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  notice_type text not null check (notice_type in ('3_day', '2_day', '1_day', 'ended')),
  sent_at timestamptz not null default now(),
  unique (season_id, notice_type)
);

comment on table public.season_notifications_log is 'กันแจ้งเตือนซ้ำ ต่อ season/ประเภทการแจ้งเตือน';

-- ============================================================
-- Function: เช็คว่า season ที่ active ใกล้จบไหม (3/2/1 วัน) แล้ว
-- log ไว้ถ้ายังไม่เคยแจ้ง -- ควรตั้งให้ pg_cron เรียกทุกวัน
-- (ดูตัวอย่าง cron schedule ด้านล่างสุดของไฟล์นี้)
-- ============================================================
create or replace function public.check_season_notifications()
returns void as $$
declare
  v_season record;
  v_days_left numeric;
begin
  select * into v_season from public.seasons where status = 'active' limit 1;

  if v_season is null then
    return;
  end if;

  v_days_left := extract(epoch from (v_season.ends_at - now())) / 86400;

  if v_days_left <= 3 and v_days_left > 2 then
    insert into public.season_notifications_log (season_id, notice_type)
    values (v_season.id, '3_day')
    on conflict (season_id, notice_type) do nothing;
  elsif v_days_left <= 2 and v_days_left > 1 then
    insert into public.season_notifications_log (season_id, notice_type)
    values (v_season.id, '2_day')
    on conflict (season_id, notice_type) do nothing;
  elsif v_days_left <= 1 and v_days_left > 0 then
    insert into public.season_notifications_log (season_id, notice_type)
    values (v_season.id, '1_day')
    on conflict (season_id, notice_type) do nothing;
  end if;
end;
$$ language plpgsql security definer;

-- ============================================================
-- Function: แจกถ้วยรางวัลปิดซีซั่น
-- Top 3 currency = gold/silver/bronze, คนอื่นที่มี game_stats
-- row ในซีซั่นนี้ (แปลว่าเคยเล่น/login) = participation ทุกคน
-- ============================================================
create or replace function public.distribute_season_rewards(p_season_id uuid)
returns void as $$
declare
  v_season_number int;
  v_rank int := 0;
  v_player record;
begin
  select season_number into v_season_number from public.seasons where id = p_season_id;

  for v_player in
    select user_id, currency,
           row_number() over (order by currency desc) as rn
    from public.game_stats
    where season_id = p_season_id
  loop
    if v_player.rn = 1 then
      insert into public.season_rewards (user_id, season_id, trophy_name, trophy_tier, rank_in_season)
      values (v_player.user_id, p_season_id, format('Season %s Champion', v_season_number), 'gold', 1);
    elsif v_player.rn = 2 then
      insert into public.season_rewards (user_id, season_id, trophy_name, trophy_tier, rank_in_season)
      values (v_player.user_id, p_season_id, format('Season %s Runner-up', v_season_number), 'silver', 2);
    elsif v_player.rn = 3 then
      insert into public.season_rewards (user_id, season_id, trophy_name, trophy_tier, rank_in_season)
      values (v_player.user_id, p_season_id, format('Season %s Third Place', v_season_number), 'bronze', 3);
    else
      insert into public.season_rewards (user_id, season_id, trophy_name, trophy_tier, rank_in_season)
      values (v_player.user_id, p_season_id, format('Season %s Participant', v_season_number), 'participation', v_player.rn);
    end if;
  end loop;
end;
$$ language plpgsql security definer;

-- ============================================================
-- Function: ปิดซีซั่น (เรียกอัตโนมัติผ่าน pg_cron เมื่อถึง ends_at)
-- ทำ 3 อย่าง: cancel listing ค้าง -> แจกถ้วยรางวัล -> เปลี่ยนสถานะ
-- เป็น ended (freeze) -- season ใหม่ต้องให้ admin กด activate เอง
-- เท่านั้น ไม่มีการเปิด season ใหม่อัตโนมัติ
-- ============================================================
create or replace function public.end_season(p_season_id uuid)
returns void as $$
begin
  -- 1. auto-cancel marketplace listings ที่ค้างอยู่ ทริกเกอร์
  -- return_inventory_on_cancel ที่มีอยู่แล้วจะคืนของเข้า
  -- player_inventory ให้อัตโนมัติทันทีที่ status เปลี่ยนเป็น cancelled
  update public.marketplace_listings
  set status = 'cancelled'
  where season_id = p_season_id and status = 'active';

  -- 2. แจกถ้วยรางวัล
  perform public.distribute_season_rewards(p_season_id);

  -- 3. เปลี่ยนสถานะเป็น ended (freeze) -- season ใหม่ต้องรอ admin
  -- กด activate_season เองเท่านั้น ไม่เปิดอัตโนมัติ
  update public.seasons
  set status = 'ended'
  where id = p_season_id;

  insert into public.season_notifications_log (season_id, notice_type)
  values (p_season_id, 'ended')
  on conflict (season_id, notice_type) do nothing;
end;
$$ language plpgsql security definer;

-- ============================================================
-- Function: กวาดหา season ที่ active แต่เลย ends_at ไปแล้ว แล้วปิดให้
-- เรียกจาก pg_cron เป็นระยะ (เช่นทุก 15-60 นาที) แทนการตั้ง cron
-- แยกทีละ season เพราะแต่ละ season มีวันจบไม่เท่ากัน
-- ============================================================
create or replace function public.auto_end_expired_seasons()
returns void as $$
declare
  v_expired_season uuid;
begin
  select id into v_expired_season
  from public.seasons
  where status = 'active' and ends_at <= now()
  limit 1;

  if v_expired_season is not null then
    perform public.end_season(v_expired_season);
  end if;
end;
$$ language plpgsql security definer;

-- ============================================================
-- Function: admin เปิด season ใหม่ด้วยตัวเอง (กดเมื่อพร้อมเท่านั้น)
-- partial unique index one_active_season_idx จะกันไม่ให้เผลอเปิด
-- 2 season active พร้อมกันโดยอัตโนมัติอยู่แล้ว (จะ error ถ้ามี
-- season อื่น active ค้างอยู่)
-- ============================================================
create or replace function public.activate_season(p_season_id uuid)
returns void as $$
begin
  update public.seasons
  set status = 'active'
  where id = p_season_id and status = 'upcoming';

  if not found then
    raise exception 'season นี้ไม่อยู่ในสถานะ upcoming หรือไม่พบ season';
  end if;
end;
$$ language plpgsql security definer;

-- ============================================================
-- Function: เวลาจริงฝั่ง server เรียกครั้งเดียวตอนโหลดหน้าเกม เพื่อ
-- sync กับนาฬิกาเครื่อง client ก่อนเริ่มนับถอยหลัง (client เก็บ
-- ส่วนต่าง offset ไว้ แล้วบวกเข้ากับนาฬิกาตัวเองตอนคำนวณนับถอยหลัง
-- ทุกวินาทีฝั่งหน้าจอ ไม่ต้องยิง query ซ้ำทุกวินาที)
-- ------------------------------------------------------------
-- ตัวอย่างการใช้ฝั่ง frontend:
--   const { data } = await supabase.rpc('get_server_time');
--   const offsetMs = new Date(data).getTime() - Date.now();
--   // ตอนนับถอยหลัง: new Date(Date.now() + offsetMs)
-- ============================================================
create or replace function public.get_server_time()
returns timestamptz as $$
begin
  return now();
end;
$$ language plpgsql stable;

-- ============================================================
-- ตัวอย่าง pg_cron schedule (รันครั้งเดียวตอน setup โปรเจกต์จริง
-- ไม่ใช่ทุกครั้งที่รัน schema นี้ -- ต้องเปิด extension pg_cron ก่อน
-- ผ่าน Supabase Dashboard > Database > Extensions)
-- ============================================================
-- select cron.schedule('check-season-notifications', '0 9 * * *', $$select public.check_season_notifications()$$);
-- select cron.schedule('auto-end-expired-seasons', '*/15 * * * *', $$select public.auto_end_expired_seasons()$$);

-- ============================================================
-- เปิด Row Level Security ทุกตาราง
-- ============================================================
alter table public.profiles enable row level security;
alter table public.seasons enable row level security;
alter table public.followers enable row level security;
alter table public.affiliate_links enable row level security;
alter table public.profile_views enable row level security;
alter table public.game_stats enable row level security;
alter table public.subscription_codes enable row level security;
alter table public.signup_audit_log enable row level security;
alter table public.fraud_flags enable row level security;
alter table public.subscription_cancellations enable row level security;
alter table public.game_items enable row level security;
alter table public.crafting_recipes enable row level security;
alter table public.crafting_recipe_ingredients enable row level security;
alter table public.player_inventory enable row level security;
alter table public.marketplace_listings enable row level security;
alter table public.marketplace_transactions enable row level security;
alter table public.item_price_bands enable row level security;
alter table public.season_rewards enable row level security;
alter table public.season_notifications_log enable row level security;

-- ============================================================
-- ============================================================
-- RLS POLICIES
-- แบ่ง 2 โซนตามที่ตกลง: "โซนเว็บ" เปิดเผย (public SELECT) กับ
-- "โซนเกม" รัดกุม (SELECT เฉพาะเจ้าของ, แก้ไขผ่าน RPC เท่านั้น)
-- ============================================================
-- ============================================================

-- ------------------------------------------------------------
-- โซนเว็บ: PROFILES
-- ใครก็ดูได้ (public), แก้ไขได้แค่เจ้าของ
-- ------------------------------------------------------------
create policy "profiles_public_select" on public.profiles
  for select using (true);

create policy "profiles_owner_update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ไม่มี insert policy เพราะ trigger handle_new_user (security definer)
-- เป็นคนสร้างแถวให้เท่านั้น ไม่ให้ client insert เองตรงๆ
-- ไม่มี delete policy เพราะลบผ่าน on delete cascade ตอนลบ auth.users เท่านั้น

-- ------------------------------------------------------------
-- โซนเว็บ: AFFILIATE_LINKS
-- ใครก็ดูได้ (ต้องเห็นเพื่อกดลิงก์), แก้ไขได้แค่เจ้าของ
-- (slot cap 10/100 บังคับด้วย trigger validate_affiliate_slot อยู่แล้ว)
-- ------------------------------------------------------------
create policy "affiliate_links_public_select" on public.affiliate_links
  for select using (true);

create policy "affiliate_links_owner_insert" on public.affiliate_links
  for insert with check (auth.uid() = user_id);

create policy "affiliate_links_owner_update" on public.affiliate_links
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "affiliate_links_owner_delete" on public.affiliate_links
  for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- โซนเว็บ: FOLLOWERS
-- ใครก็ดูยอด follower ได้ (public), กด follow ได้เฉพาะตัวเอง
-- ไม่มี update/delete policy เลย เพราะไม่มี unfollow
-- (การแจก token ทำผ่าน trigger handle_new_follow อัตโนมัติอยู่แล้ว)
-- ------------------------------------------------------------
create policy "followers_public_select" on public.followers
  for select using (true);

create policy "followers_self_insert" on public.followers
  for insert with check (auth.uid() = follower_id);

-- ------------------------------------------------------------
-- โซนเว็บ: PROFILE_VIEWS
-- insert ได้เฉพาะตัวเอง (viewer_id) แต่ไม่มี select policy เลย
-- (RLS enabled + ไม่มี policy select = deny ทั้งหมด) แม้แต่เจ้าของ
-- โปรไฟล์ก็ไม่เห็นว่าใครมาดู ตามที่ตกลง — ตารางนี้ใช้แค่
-- dedup กัน bot ปั่นยอด (unique constraint) ไม่ได้ใช้แสดงผลใครๆ เลย
-- ------------------------------------------------------------
create policy "profile_views_self_insert" on public.profile_views
  for insert with check (auth.uid() = viewer_id);

-- ------------------------------------------------------------
-- โซนเว็บ: SEASON_REWARDS
-- ใครก็ดูถ้วยรางวัลได้ (public), ไม่มี insert/update/delete policy
-- เลยเพราะแจกผ่าน season-end function (security definer) เท่านั้น
-- ------------------------------------------------------------
create policy "season_rewards_public_select" on public.season_rewards
  for select using (true);

-- ------------------------------------------------------------
-- โซนเว็บ: SEASONS
-- ใครก็ดู schedule ซีซั่นได้ (public), ไม่มี insert/update policy
-- เลยเพราะจัดการผ่าน admin/scheduled function (service role) เท่านั้น
-- ------------------------------------------------------------
create policy "seasons_public_select" on public.seasons
  for select using (true);

-- ------------------------------------------------------------
-- โซนเว็บ: SEASON_NOTIFICATIONS_LOG
-- ใครก็ดูได้ (public) เพื่อโชว์ banner แจ้งเตือนใกล้จบซีซั่นบนเว็บ
-- ไม่มี insert/update policy เลย เขียนผ่าน check_season_notifications
-- (security definer, เรียกโดย pg_cron) เท่านั้น
-- ------------------------------------------------------------
create policy "season_notifications_log_public_select" on public.season_notifications_log
  for select using (true);

-- ------------------------------------------------------------
-- โซนเกม: GAME_STATS
-- SELECT เฉพาะเจ้าของเท่านั้น (currency ไม่ควร public)
-- ไม่มี insert/update policy เลย ทุกการเปลี่ยนแปลงผ่าน RPC
-- (handle_new_follow, purchase_from_listing, subscribe_player, ฯลฯ)
-- ซึ่งเป็น security definer เท่านั้น
-- ------------------------------------------------------------
create policy "game_stats_owner_select" on public.game_stats
  for select using (auth.uid() = user_id);

-- View แยกสำหรับโชว์ "tier badge" แบบ public บนหน้าโปรไฟล์
-- ใช้ security definer (ไม่ใช่ invoker) เพราะตั้งใจให้ view นี้ bypass
-- RLS ของ game_stats ได้ -- ปลอดภัยเพราะ view expose แค่คอลัมน์ tier
-- เท่านั้น ไม่รวม currency/xp ซึ่งเป็นข้อมูลอ่อนไหวที่ต้องเก็บ private
create view public.public_tier_badge
with (security_invoker = false) as
select user_id, season_id, tier
from public.game_stats;

comment on view public.public_tier_badge is 'Tier badge แบบ public ใช้โชว์หน้าโปรไฟล์ (ผ่าน security definer view) ไม่รวม currency/xp ที่ยังอยู่หลัง RLS owner-only';

grant select on public.public_tier_badge to anon, authenticated;

-- ------------------------------------------------------------
-- โซนเกม: GAME_ITEMS / CRAFTING_RECIPES / CRAFTING_RECIPE_INGREDIENTS
-- master data ต้อง public select (หน้าเกมต้องโชว์ item/สูตรให้ผู้เล่นดู)
-- ไม่มี insert/update/delete policy เลย เพราะจัดการผ่าน admin
-- (service role bypass RLS) เท่านั้น ไม่ให้ client เพิ่ม/แก้ item เอง
-- ------------------------------------------------------------
create policy "game_items_public_select" on public.game_items
  for select using (true);

create policy "crafting_recipes_public_select" on public.crafting_recipes
  for select using (true);

create policy "crafting_recipe_ingredients_public_select" on public.crafting_recipe_ingredients
  for select using (true);

-- ------------------------------------------------------------
-- โซนเกม: PLAYER_INVENTORY
-- SELECT เฉพาะเจ้าของ (ไม่ public เพราะไม่มีเหตุผลให้คนอื่นเห็นคลัง
-- ของเราชัดเจนขนาดนั้น) ไม่มี insert/update/delete policy เลย
-- ทุกการเปลี่ยนแปลงผ่าน RPC/trigger ที่เป็น security definer เท่านั้น
-- ------------------------------------------------------------
create policy "player_inventory_owner_select" on public.player_inventory
  for select using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- โซนเกม (ผสม): MARKETPLACE_LISTINGS
-- SELECT public (ทุกคนต้องเห็นของในตลาดถึงจะกดซื้อได้)
-- INSERT/UPDATE เฉพาะเจ้าของ (trigger reserve_inventory_on_listing,
-- validate_listing_price, return_inventory_on_cancel คุม logic อยู่แล้ว)
-- ไม่มี delete policy เลย ยกเลิกด้วยการ update status = 'cancelled' เท่านั้น
-- ------------------------------------------------------------
create policy "marketplace_listings_public_select" on public.marketplace_listings
  for select using (true);

create policy "marketplace_listings_owner_insert" on public.marketplace_listings
  for insert with check (auth.uid() = seller_id);

create policy "marketplace_listings_owner_update" on public.marketplace_listings
  for update using (auth.uid() = seller_id) with check (auth.uid() = seller_id);

-- ------------------------------------------------------------
-- โซนเกม: MARKETPLACE_TRANSACTIONS
-- SELECT เฉพาะคนที่เกี่ยวข้อง (ผู้ซื้อ หรือ เจ้าของ listing/ผู้ขาย)
-- ไม่มี insert/update/delete policy เลย เพราะสร้างได้ผ่าน
-- purchase_from_listing (security definer) เท่านั้น ห้าม client
-- insert ประวัติซื้อขายปลอมเองเด็ดขาด
-- ------------------------------------------------------------
create policy "marketplace_transactions_participant_select" on public.marketplace_transactions
  for select using (
    auth.uid() = buyer_id
    or auth.uid() in (
      select seller_id from public.marketplace_listings where id = listing_id
    )
  );

-- ------------------------------------------------------------
-- โซนเกม: ITEM_PRICE_BANDS
-- public select (หน้าเกมต้องโชว์เพดานราคาให้ผู้เล่นตั้งราคาถูกต้อง)
-- ไม่มี insert/update policy เลย คำนวณผ่าน recalc_price_band
-- (security definer) เท่านั้น
-- ------------------------------------------------------------
create policy "item_price_bands_public_select" on public.item_price_bands
  for select using (true);

-- ------------------------------------------------------------
-- SUBSCRIPTION_CODES
-- ปิดสนิททุก operation ไม่มี policy ใดๆ เลย (RLS enabled แต่ไม่มี
-- policy = default deny ทุกอย่าง) ห้าม client เห็นรายการโค้ดเด็ดขาด
-- (ไม่งั้นเดารหัสที่ยังไม่ถูกใช้ของคนอื่นได้) ใช้โค้ดผ่าน
-- redeem_subscription_code (security definer) เท่านั้น ซึ่งจะ bypass
-- RLS เพราะรันในสิทธิ์เจ้าของฟังก์ชัน (ปกติคือ postgres/service role)
-- ------------------------------------------------------------
-- (ตั้งใจไม่เขียน policy ใดๆ ให้ตารางนี้)

-- ------------------------------------------------------------
-- SIGNUP_AUDIT_LOG / FRAUD_FLAGS (Anti-fraud)
-- ปิดสนิททุก operation เช่นเดียวกับ subscription_codes ไม่มี policy
-- ใดๆ เลย -- ข้อมูล IP/User-Agent และเคสต้องสงสัยเข้าถึงได้เฉพาะ
-- ผ่าน service role (แผง admin) หรือฟังก์ชัน security definer
-- (record_signup_ip, admin_resolve_fraud_flag) เท่านั้น ไม่ให้ client
-- ธรรมดา select/insert/update เองโดยเด็ดขาด
-- ------------------------------------------------------------
-- (ตั้งใจไม่เขียน policy ใดๆ ให้ทั้ง 2 ตารางนี้)

-- ------------------------------------------------------------
-- SUBSCRIPTION_CANCELLATIONS
-- SELECT ได้เฉพาะเจ้าของประวัติ (ดูว่าตัวเองถูกยกเลิกไปหรือยัง)
-- ไม่มี insert/update policy เลย เพราะสร้างผ่าน
-- admin_cancel_subscription (security definer) เท่านั้น
-- ------------------------------------------------------------
create policy "subscription_cancellations_owner_select" on public.subscription_cancellations
  for select using (auth.uid() = user_id);

-- ============================================================
-- LOGIN PAGE STATS
-- ฟังก์ชัน public ใช้โชว์ตัวเลขสรุปบนหน้า /login (ก่อน login)
-- security definer เพราะต้องข้าม RLS ของ profiles/game_stats/
-- affiliate_links แต่ปลอดภัยเพราะ return แค่ตัวเลขนับรวม
-- ไม่มี PII หรือข้อมูลรายบุคคลใดๆ หลุดออกมาเลย
-- ============================================================
create or replace function public.get_login_stats()
returns table (
  total_users bigint,
  season_users bigint,
  active_affiliate_links bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_active_season uuid;
begin
  select id into v_active_season from public.seasons where status = 'active' limit 1;

  return query
  select
    (select count(*) from public.profiles),
    coalesce(
      (select count(distinct user_id) from public.game_stats
       where season_id = v_active_season),
      0
    ),
    (select count(*) from public.affiliate_links where is_active = true);
end;
$$;

comment on function public.get_login_stats() is 'สรุปตัวเลข public สำหรับหน้า /login: total_users, season_users (คนที่มี game_stats ใน season ที่ active), active_affiliate_links (is_active=true ทั้งแพลตฟอร์ม) ไม่มี PII';

grant execute on function public.get_login_stats() to anon, authenticated;

-- ============================================================
-- ============================================================
-- PORTFOLIO PIVOT: theme, portfolio uploads, brand job board
-- เพิ่มระบบ 3 อย่างสำหรับ pivot ไปทาง self-declared portfolio platform:
--   1. ธีมโปรไฟล์ (สี/ฟอนต์/เพลง/niche tag)
--   2. ผลงานภาพหน้าจอ (อ้างอิงไฟล์ใน Supabase Storage)
--   3. กระดานงานจ้าง (brand/creator โพสต์ deal ให้คนอื่นมาสมัคร)
-- ============================================================
-- ============================================================

-- ------------------------------------------------------------
-- 1a. PROFILE THEME + BRAND INFO (เพิ่ม column ใน profiles เดิม)
--
-- ตั้งใจไม่เปิดให้ใส่ raw custom CSS เพราะเป็นช่องโหว่จริง (CSS
-- attribute-selector สามารถขโมยข้อมูลบางอย่างจากหน้าเว็บได้ หรือใช้
-- ทำ overlay หลอกลวงผู้ใช้ได้) ใช้ theme แบบ structured (สี + ฟอนต์
-- จาก allowlist) แทน ปลอดภัยกว่ามาก ฝั่ง frontend ค่อยแปลงเป็น CSS
-- variable เอง
--
-- music_url เก็บเป็น text ธรรมดา แต่ frontend ต้อง whitelist โดเมนที่
-- ยอมให้ embed (เช่น open.spotify.com, youtube.com เท่านั้น) ก่อนสร้าง
-- iframe เสมอ ห้าม render iframe จาก URL ใดๆ ที่ผู้ใช้กรอกมาตรงๆ
--
-- has_brand/brand_name/brand_website: ข้อมูลแบรนด์ที่ผู้ใช้กรอกเสริม
-- ได้ (ไม่บังคับ) ใช้ตอนเลือกโพสต์งานจ้างในฐานะ "Brand"
-- ------------------------------------------------------------
alter table public.profiles
  add column theme_primary_color text
    check (theme_primary_color ~ '^#[0-9a-fA-F]{6}$'),
  add column theme_secondary_color text
    check (theme_secondary_color ~ '^#[0-9a-fA-F]{6}$'),
  add column theme_font text
    check (theme_font in ('sans', 'serif', 'pixel')),
  add column music_url text,
  add column has_brand boolean not null default false,
  add column brand_name text,
  add column brand_website text;

-- ------------------------------------------------------------
-- 1b. NICHE_TAGS + PROFILE_NICHE_TAGS
-- master data pattern เดียวกับ game_items: niche_tags เป็นรายการกลาง
-- จัดการผ่าน admin เท่านั้น (ไม่มี insert/update/delete policy ให้
-- client) ส่วน profile_niche_tags คือ many-to-many ที่เจ้าของ profile
-- เลือกติด/ถอด tag เองได้
-- ------------------------------------------------------------
create table public.niche_tags (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  label text not null,
  created_at timestamptz not null default now()
);

create table public.profile_niche_tags (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  tag_id uuid not null references public.niche_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, tag_id)
);

comment on table public.niche_tags is 'รายการ niche tag กลาง (master data) จัดการผ่าน admin เท่านั้น';
comment on table public.profile_niche_tags is 'tag ที่แต่ละ profile เลือกติดไว้ (many-to-many)';

-- ------------------------------------------------------------
-- 2. PORTFOLIO_ITEMS
-- เก็บแค่ "อ้างอิง" ไฟล์ใน Supabase Storage (bucket ชื่อ 'portfolio')
-- ไม่เก็บตัวไฟล์จริงในตารางนี้ — ต้องสร้าง path แบบ
-- {user_id}/{filename} เสมอ (ดู storage policy ด้านล่างที่อ้างอิง
-- โฟลเดอร์แรกของ path เป็นเจ้าของไฟล์)
-- ------------------------------------------------------------
create table public.portfolio_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  caption text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_portfolio_items_user_id on public.portfolio_items(user_id, sort_order);

comment on table public.portfolio_items is 'อ้างอิงภาพผลงานใน Supabase Storage bucket "portfolio" (path รูปแบบ {user_id}/{filename})';

-- Storage bucket + policy สำหรับ bucket 'portfolio' (public read, เจ้าของ
-- โฟลเดอร์เท่านั้นที่ upload/ลบได้ — ใช้ชื่อโฟลเดอร์แรกของ path เทียบ
-- กับ auth.uid() ตาม convention {user_id}/{filename})
insert into storage.buckets (id, name, public)
values ('portfolio', 'portfolio', true)
on conflict (id) do nothing;

create policy "portfolio_bucket_public_read" on storage.objects
  for select using (bucket_id = 'portfolio');

create policy "portfolio_bucket_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'portfolio'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "portfolio_bucket_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'portfolio'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ------------------------------------------------------------
-- 3. BRAND_DEALS + DEAL_REPLIES (กระดานงานจ้าง)
--
-- ใครก็โพสต์งานจ้างได้ (ไม่แยก account type) แต่ต้องเลือกว่าโพสต์ใน
-- ฐานะ 'brand' หรือ 'creator' ต่อ 1 โพสต์ (posted_as) ถ้าเลือก 'brand'
-- ต้องเคยกรอก has_brand = true ในโปรไฟล์ไว้ก่อน (บังคับผ่าน trigger)
--
-- 1 deal รับได้หลายคน (slots_total) เจ้าของโพสต์ (posted_by) เป็นคน
-- accept ผู้สมัครทีละคนผ่าน accept_deal_reply จนครบ slots_total
-- และกดปิดงานเองผ่าน complete_deal เมื่อไหร่ก็ได้ (ไม่บังคับว่าต้อง
-- ครบ slots_total ก่อนถึงจะปิดได้) — ก่อนกดปิด ใครก็ยังเข้ามาตอบ
-- กระทู้ (deal_replies) เพิ่มได้เรื่อยๆ
--
-- ทุกการเปลี่ยน status (accept/complete) บังคับผ่าน RPC (security
-- definer) เท่านั้น ไม่มี update policy ให้ client เขียนตรงๆ เพื่อกัน
-- การ bypass เงื่อนไข slots_total/ownership
-- ------------------------------------------------------------
create table public.brand_deals (
  id uuid primary key default uuid_generate_v4(),
  posted_by uuid not null references public.profiles(id) on delete cascade,
  posted_as text not null check (posted_as in ('brand', 'creator')),
  title text not null,
  description text not null,
  external_asset_url text,
  slots_total int not null default 1 check (slots_total > 0),
  status text not null default 'open'
    check (status in ('open', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index idx_brand_deals_status on public.brand_deals(status, created_at desc);

comment on table public.brand_deals is 'กระดานงานจ้าง: brand/creator โพสต์ deal พร้อมลิงก์ asset ภายนอก (Google Drive/Canva) ให้คนอื่นสมัคร';

create table public.deal_replies (
  id uuid primary key default uuid_generate_v4(),
  deal_id uuid not null references public.brand_deals(id) on delete cascade,
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  message text,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);

create index idx_deal_replies_deal_id on public.deal_replies(deal_id, created_at);

comment on table public.deal_replies is 'คนสมัคร/ตอบกระทู้ของแต่ละ deal เจ้าของ deal accept ได้ทีละคนจนครบ slots_total';

-- Trigger: ถ้าเลือกโพสต์ในฐานะ 'brand' ต้องเคยกรอกข้อมูลแบรนด์ไว้ก่อน
create or replace function public.validate_deal_posted_as()
returns trigger as $$
declare
  v_has_brand boolean;
begin
  if new.posted_as = 'brand' then
    select has_brand into v_has_brand
    from public.profiles
    where id = new.posted_by;

    if not coalesce(v_has_brand, false) then
      raise exception 'ต้องกรอกข้อมูลแบรนด์ในโปรไฟล์ก่อน ถึงจะโพสต์ในฐานะ Brand ได้';
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger validate_deal_posted_as_trigger
  before insert on public.brand_deals
  for each row execute function public.validate_deal_posted_as();

-- Function: จำนวนคนที่ accept แล้วของ deal หนึ่งๆ
create or replace function public.count_accepted_replies(p_deal_id uuid)
returns int as $$
  select count(*)::int
  from public.deal_replies
  where deal_id = p_deal_id and status = 'accepted';
$$ language sql stable;

-- Function: เจ้าของ deal accept ผู้สมัครคนหนึ่ง (กันรับเกิน slots_total
-- ด้วย "select ... for update" ล็อกกันสองคน accept ชนกันพร้อมกัน)
create or replace function public.accept_deal_reply(
  p_reply_id uuid,
  p_actor_id uuid
) returns void as $$
declare
  v_reply record;
  v_deal record;
  v_accepted_count int;
begin
  select * into v_reply from public.deal_replies where id = p_reply_id for update;
  if v_reply is null then
    raise exception 'ไม่พบคำตอบนี้';
  end if;

  select * into v_deal from public.brand_deals where id = v_reply.deal_id for update;
  if v_deal.posted_by <> p_actor_id then
    raise exception 'เฉพาะเจ้าของดีลเท่านั้นที่ accept ได้';
  end if;

  if v_deal.status <> 'open' then
    raise exception 'ดีลนี้ปิดรับสมัครแล้ว';
  end if;

  select public.count_accepted_replies(v_deal.id) into v_accepted_count;
  if v_accepted_count >= v_deal.slots_total then
    raise exception 'รับครบจำนวนที่กำหนดแล้ว (% คน)', v_deal.slots_total;
  end if;

  update public.deal_replies set status = 'accepted' where id = p_reply_id;
end;
$$ language plpgsql security definer;

-- Function: เจ้าของ deal ปิดงาน (กดว่าเสร็จสิ้นแล้ว) ไม่บังคับว่าต้อง
-- ครบ slots_total ก่อน — ปิดเมื่อไหร่ก็ได้ตามที่เจ้าของ deal ต้องการ
create or replace function public.complete_deal(
  p_deal_id uuid,
  p_actor_id uuid
) returns void as $$
begin
  update public.brand_deals
  set status = 'completed', completed_at = now()
  where id = p_deal_id and posted_by = p_actor_id and status = 'open';

  if not found then
    raise exception 'ไม่สามารถปิดดีลนี้ได้ (ไม่ใช่เจ้าของ หรือดีลไม่ได้เปิดอยู่)';
  end if;
end;
$$ language plpgsql security definer;

-- ============================================================
-- RLS: PORTFOLIO PIVOT
-- ============================================================
alter table public.niche_tags enable row level security;
alter table public.profile_niche_tags enable row level security;
alter table public.portfolio_items enable row level security;
alter table public.brand_deals enable row level security;
alter table public.deal_replies enable row level security;

-- niche_tags: master data public select เท่านั้น จัดการผ่าน admin
create policy "niche_tags_public_select" on public.niche_tags
  for select using (true);

-- profile_niche_tags: ใครก็ดูได้ (แสดงบนโปรไฟล์) เจ้าของติด/ถอด tag เอง
create policy "profile_niche_tags_public_select" on public.profile_niche_tags
  for select using (true);

create policy "profile_niche_tags_owner_insert" on public.profile_niche_tags
  for insert with check (auth.uid() = profile_id);

create policy "profile_niche_tags_owner_delete" on public.profile_niche_tags
  for delete using (auth.uid() = profile_id);

-- portfolio_items: ใครก็ดูได้ (โชว์ผลงาน) เจ้าของจัดการเองได้เต็มที่
create policy "portfolio_items_public_select" on public.portfolio_items
  for select using (true);

create policy "portfolio_items_owner_insert" on public.portfolio_items
  for insert with check (auth.uid() = user_id);

create policy "portfolio_items_owner_update" on public.portfolio_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "portfolio_items_owner_delete" on public.portfolio_items
  for delete using (auth.uid() = user_id);

-- brand_deals: ใครก็ดูกระดานงานจ้างได้ (public) โพสต์ใหม่ได้เอง แต่
-- ไม่มี update/delete policy เลย — เปลี่ยน status ผ่าน RPC เท่านั้น
create policy "brand_deals_public_select" on public.brand_deals
  for select using (true);

create policy "brand_deals_owner_insert" on public.brand_deals
  for insert with check (auth.uid() = posted_by);

-- deal_replies: ใครก็อ่านกระทู้ได้ (public) ตอบ/สมัครได้เอง แต่ไม่มี
-- update/delete policy เลย — accept ผ่าน accept_deal_reply RPC เท่านั้น
create policy "deal_replies_public_select" on public.deal_replies
  for select using (true);

create policy "deal_replies_self_insert" on public.deal_replies
  for insert with check (auth.uid() = applicant_id);

-- ============================================================
-- PROFILE THEME PRESETS
-- แทนที่ theme_primary_color/theme_secondary_color/theme_font แบบ
-- freeform เดิม (ยังไม่เคยมี UI ใช้งานจริง) ด้วยการเลือกจาก preset
-- สำเร็จรูปเท่านั้น กันสีขัดตากันเอง — รายละเอียดจริงของแต่ละ preset
-- (สี/ฟอนต์/พื้นหลัง) เก็บไว้ในโค้ด frontend (src/lib/theme/presets.ts)
-- ไม่ใช่ใน DB เพื่อแก้ไข/เพิ่ม preset ใหม่ได้โดยไม่ต้อง migrate ตารางอีก
-- ============================================================
alter table public.profiles
  drop column if exists theme_primary_color,
  drop column if exists theme_secondary_color,
  drop column if exists theme_font;

alter table public.profiles
  add column theme_preset text not null default 'royal_gold'
    check (theme_preset in (
      'royal_gold', 'midnight_emerald', 'crimson_noir',
      'sapphire_frost', 'rose_platinum', 'obsidian_neon'
    ));
