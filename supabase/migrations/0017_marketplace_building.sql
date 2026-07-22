-- ============================================================
-- 0017: Marketplace Building (Phase 1 Priority 1) + Rescope 5A to
-- Hero Equipment (Priority 2, part 1) + adaptive_ratio_bands schema
-- (Priority 2, part 2 — schema only)
--
-- ⚠️ DRAFT — ยังไม่เคยรันกับ Supabase ที่ไหนเลย (เหมือน 0016)
-- Dependency: รันหลัง 0000-0016 ถูก apply แล้วเท่านั้น
--
-- ขอบเขตที่ตั้งใจ "ยังไม่ทำ" ในไฟล์นี้:
--   - ไม่มี RPC เทรด/dispatch merchant cart จริง (5B) เลย — รอคำตอบ
--     ว่า Resource Marketplace เป็น order-book (ตั้ง offer สาธารณะ
--     ใครก็มา fulfill ได้) หรือ point-to-point (เลือกเป้าหมายผู้เล่น
--     แล้วส่ง cart ไปหาโดยตรง) ก่อน — สองแบบนี้ schema ต่างกันจริง
--     ไม่อยากเดา ใส่แค่ตาราง adaptive_ratio_bands (โครงเพดานอัตรา)
--     ไว้ก่อน ยังไม่มี recalc function หรือ trade RPC
--   - ไม่มี RPC คราฟต์ (T1→T2) เลย — Marketplace Building level 4+
--     ต้องใช้ Processed Lumber/Bricks (T2) แต่ crafting_recipes ยังเป็น
--     master data เปล่าๆ มาตั้งแต่ schema เดิม ไม่เคยมี craft_item()
--     RPC จริง ผู้เล่นจะไปต่อไม่ได้เกิน level 3 จนกว่าจะมีระบบนี้
--     (ไม่บล็อกไฟล์นี้ แต่ต้องอยู่ใน roadmap ถัดไป)
-- ============================================================

-- ================================================================
-- SECTION 1: game_items — เพิ่ม T1 base resources + T2 building
-- material 2 ชนิด (ยังไม่เคยมี game_items row จริงในระบบเลยจนถึงตอนนี้
-- ทุก migration ก่อนหน้านี้นิยามแค่โครงตาราง master data ไม่เคย seed)
-- ================================================================

insert into public.game_items (item_key, name, item_type, tier, is_tradeable) values
  ('wood', 'ไม้', 'resource', 1, true),
  ('stone', 'หิน', 'resource', 1, true),
  ('clay', 'ดิน', 'resource', 1, true),
  ('water', 'น้ำ', 'resource', 1, true),
  ('provisions', 'เสบียง', 'resource', 1, true)
on conflict (item_key) do nothing;

alter table public.game_items
  add column market_category text
    check (market_category is null or market_category in ('hero_equipment', 'building_material'));

comment on column public.game_items.market_category is
  'แยก T2 crafted goods ตาม blueprint 2026-07-22: hero_equipment เทรดผ่าน 5A (token, instant), building_material เทรดผ่าน 5B (barter, merchant cart) — null สำหรับ T1 raw resource (ไปทาง sell_to_npc หรือ 5B เท่านั้น ไม่ผ่าน 5A)';

insert into public.game_items (item_key, name, item_type, tier, market_category, is_tradeable) values
  ('processed_lumber', 'ไม้แปรรูป', 'crafted', 2, 'building_material', true),
  ('bricks', 'อิฐ', 'crafted', 2, 'building_material', true)
on conflict (item_key) do nothing;

-- ----------------------------------------------------------------
-- บังคับ rescope 5A ที่ DB level ไม่ใช่แค่ comment/convention — ห้าม
-- list อะไรใน marketplace_listings (5A) ยกเว้น item ที่
-- market_category = 'hero_equipment' เท่านั้น
-- ----------------------------------------------------------------
create or replace function public.validate_hero_equipment_listing()
returns trigger as $$
declare
  v_category text;
begin
  select market_category into v_category from public.game_items where id = new.item_id;

  if v_category is distinct from 'hero_equipment' then
    raise exception 'Hero Equipment Marketplace (5A) รับเฉพาะไอเทมหมวด hero_equipment เท่านั้น';
  end if;

  return new;
end;
$$ language plpgsql;

create trigger validate_hero_equipment_listing_trigger
  before insert on public.marketplace_listings
  for each row execute function public.validate_hero_equipment_listing();


-- ================================================================
-- SECTION 2: Marketplace Building — Priority 1 (ตัวเลขล็อกแล้ว
-- 2026-07-22, 10 levels, max merchant capacity ตรวจแล้วว่า
-- merchant_count × capacity_per_cart ตรงกับที่ยืนยันมาทุก level)
-- ================================================================

create table public.marketplace_building_level_stats (
  level smallint primary key check (level between 1 and 10),
  merchant_count int not null check (merchant_count > 0),
  capacity_per_cart bigint not null check (capacity_per_cart > 0)
);

comment on table public.marketplace_building_level_stats is
  'จำนวน merchant cart + ความจุต่อคันของแต่ละ level (master data) — max_total_capacity = merchant_count * capacity_per_cart คำนวณตอน query ไม่เก็บซ้ำ';

insert into public.marketplace_building_level_stats (level, merchant_count, capacity_per_cart) values
  (1, 1, 500),
  (2, 2, 750),
  (3, 3, 1000),
  (4, 4, 1250),
  (5, 5, 1500),
  (6, 7, 2000),
  (7, 9, 2500),
  (8, 12, 3000),
  (9, 15, 4000),
  (10, 20, 5000)
on conflict (level) do nothing;

-- ----------------------------------------------------------------
-- ต้นทุนอัพเกรดแต่ละ level (junction table แบบเดียวกับ
-- crafting_recipe_ingredients) — level 1 คือต้นทุนสร้างครั้งแรก
-- (level 0 -> 1) ไม่ใช่ของฟรี
-- ----------------------------------------------------------------
create table public.marketplace_building_level_costs (
  level smallint not null check (level between 1 and 10),
  item_id uuid not null references public.game_items(id) on delete restrict,
  quantity bigint not null check (quantity > 0),
  primary key (level, item_id)
);

comment on table public.marketplace_building_level_costs is
  'ต้นทุนอัพเกรด Marketplace Building ต่อ level (master data, admin/migration seed เท่านั้น)';

insert into public.marketplace_building_level_costs (level, item_id, quantity)
select 1, id, 200 from public.game_items where item_key = 'wood'
union all select 1, id, 200 from public.game_items where item_key = 'stone'
union all select 1, id, 200 from public.game_items where item_key = 'clay'
union all select 1, id, 100 from public.game_items where item_key = 'provisions'
union all select 2, id, 400 from public.game_items where item_key = 'wood'
union all select 2, id, 400 from public.game_items where item_key = 'stone'
union all select 2, id, 400 from public.game_items where item_key = 'clay'
union all select 2, id, 200 from public.game_items where item_key = 'provisions'
union all select 3, id, 800 from public.game_items where item_key = 'wood'
union all select 3, id, 800 from public.game_items where item_key = 'stone'
union all select 3, id, 800 from public.game_items where item_key = 'clay'
union all select 3, id, 400 from public.game_items where item_key = 'provisions'
union all select 4, id, 100 from public.game_items where item_key = 'processed_lumber'
union all select 4, id, 100 from public.game_items where item_key = 'bricks'
union all select 4, id, 800 from public.game_items where item_key = 'provisions'
union all select 5, id, 250 from public.game_items where item_key = 'processed_lumber'
union all select 5, id, 250 from public.game_items where item_key = 'bricks'
union all select 5, id, 1500 from public.game_items where item_key = 'provisions'
union all select 6, id, 500 from public.game_items where item_key = 'processed_lumber'
union all select 6, id, 500 from public.game_items where item_key = 'bricks'
union all select 6, id, 3000 from public.game_items where item_key = 'provisions'
union all select 7, id, 1000 from public.game_items where item_key = 'processed_lumber'
union all select 7, id, 1000 from public.game_items where item_key = 'bricks'
union all select 7, id, 6000 from public.game_items where item_key = 'provisions'
union all select 8, id, 2000 from public.game_items where item_key = 'processed_lumber'
union all select 8, id, 2000 from public.game_items where item_key = 'bricks'
union all select 8, id, 12000 from public.game_items where item_key = 'provisions'
union all select 9, id, 4000 from public.game_items where item_key = 'processed_lumber'
union all select 9, id, 4000 from public.game_items where item_key = 'bricks'
union all select 9, id, 25000 from public.game_items where item_key = 'provisions'
union all select 10, id, 8000 from public.game_items where item_key = 'processed_lumber'
union all select 10, id, 8000 from public.game_items where item_key = 'bricks'
union all select 10, id, 50000 from public.game_items where item_key = 'provisions'
on conflict (level, item_id) do nothing;

-- ----------------------------------------------------------------
-- ระดับ Marketplace Building ของผู้เล่น (singleton ต่อคน/season —
-- ไม่มีแถว = level 0 / ยังไม่สร้าง ต่างจาก Vault/Cranny ในอนาคตที่
-- สร้างซ้ำได้หลายหลัง จึงไม่ใช้ตารางร่วมกัน)
-- ----------------------------------------------------------------
create table public.player_marketplace_building (
  user_id uuid not null references public.profiles(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  level smallint not null default 0 check (level between 0 and 10),
  upgraded_at timestamptz not null default now(),
  primary key (user_id, season_id)
);

comment on table public.player_marketplace_building is
  'ระดับ Marketplace Building ต่อผู้เล่น/season — ไม่มีแถว = level 0 (ยังไม่สร้าง), เขียนได้ผ่าน upgrade_marketplace_building() เท่านั้น';

-- ----------------------------------------------------------------
-- Function: upgrade_marketplace_building() — auth.uid() ภายในเท่านั้น
-- เช็ควัตถุดิบครบทุกชนิดก่อนหักจริง (all-or-nothing) ล็อกแถวกัน
-- อัพเกรดซ้อนพร้อมกัน
-- ----------------------------------------------------------------
create or replace function public.upgrade_marketplace_building()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season_id uuid;
  v_current_level int;
  v_next_level int;
  v_cost record;
  v_missing boolean := false;
begin
  if auth.uid() is null then
    raise exception 'ต้อง login ก่อน';
  end if;

  select id into v_season_id from public.seasons where status = 'active' limit 1;
  if v_season_id is null then
    raise exception 'ไม่มี season ที่ active อยู่ตอนนี้';
  end if;

  select level into v_current_level
  from public.player_marketplace_building
  where user_id = auth.uid() and season_id = v_season_id
  for update;

  v_current_level := coalesce(v_current_level, 0);
  v_next_level := v_current_level + 1;

  if v_next_level > 10 then
    raise exception 'Marketplace Building อยู่ระดับสูงสุดแล้ว (level 10)';
  end if;

  for v_cost in
    select item_id, quantity from public.marketplace_building_level_costs
    where level = v_next_level
  loop
    if not exists (
      select 1 from public.player_inventory
      where user_id = auth.uid() and season_id = v_season_id
        and item_id = v_cost.item_id and quantity >= v_cost.quantity
    ) then
      v_missing := true;
      exit;
    end if;
  end loop;

  if v_missing then
    raise exception 'วัตถุดิบไม่พอสำหรับอัพเกรด Marketplace Building เป็น level %', v_next_level;
  end if;

  for v_cost in
    select item_id, quantity from public.marketplace_building_level_costs
    where level = v_next_level
  loop
    update public.player_inventory
    set quantity = quantity - v_cost.quantity
    where user_id = auth.uid() and season_id = v_season_id and item_id = v_cost.item_id;
  end loop;

  insert into public.player_marketplace_building (user_id, season_id, level, upgraded_at)
  values (auth.uid(), v_season_id, v_next_level, now())
  on conflict (user_id, season_id) do update
  set level = v_next_level, upgraded_at = now();

  return v_next_level;
end;
$$;

grant execute on function public.upgrade_marketplace_building() to authenticated;

create or replace function public.get_marketplace_building_status()
returns table (level int, merchant_count int, capacity_per_cart bigint, max_total_capacity bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_season_id uuid;
  v_level int;
begin
  select id into v_season_id from public.seasons where status = 'active' limit 1;
  if v_season_id is null or auth.uid() is null then
    return;
  end if;

  select coalesce(pmb.level, 0) into v_level
  from public.player_marketplace_building pmb
  where pmb.user_id = auth.uid() and pmb.season_id = v_season_id;

  v_level := coalesce(v_level, 0);

  if v_level = 0 then
    return query select 0, 0, 0::bigint, 0::bigint;
    return;
  end if;

  return query
  select v_level, s.merchant_count, s.capacity_per_cart, (s.merchant_count::bigint * s.capacity_per_cart)
  from public.marketplace_building_level_stats s
  where s.level = v_level;
end;
$$;

grant execute on function public.get_marketplace_building_status() to authenticated;


-- ================================================================
-- SECTION 3: Global constants — ค่าคงที่ที่ยืนยันแล้วแต่ยังไม่มี RPC
-- ใช้จริงในไฟล์นี้ (รอ barter trade RPC ในรอบถัดไป) เก็บไว้เป็น
-- key-value เพื่อปรับ balance ทีหลังได้โดยไม่ต้องออก migration ใหม่
-- ================================================================

create table public.game_constants (
  key text primary key,
  value numeric not null,
  updated_at timestamptz not null default now()
);

comment on table public.game_constants is
  'ค่าคงที่ระดับเกมที่ปรับ balance ได้โดยไม่ต้อง migration ใหม่ (เช่น merchant speed) — เขียนได้ผ่าน admin/service role เท่านั้น';

insert into public.game_constants (key, value) values
  ('merchant_base_speed_tiles_per_hour', 12)
on conflict (key) do nothing;


-- ================================================================
-- SECTION 4: adaptive_ratio_bands — โครงตารางสำหรับ 5B (Resource
-- Barter Marketplace) เท่านั้น ยังไม่มี recalc function หรือ trade
-- RPC เพราะรอคำตอบเรื่อง order-book vs point-to-point ก่อน (ดู
-- คอมเมนต์หัวไฟล์)
-- ================================================================

create table public.adaptive_ratio_bands (
  id uuid primary key default uuid_generate_v4(),
  item_a_id uuid not null references public.game_items(id) on delete cascade,
  item_b_id uuid not null references public.game_items(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  window_end timestamptz not null default now(),
  units_traded_a bigint not null default 0,
  units_traded_b bigint not null default 0,
  min_ratio numeric not null check (min_ratio > 0),
  max_ratio numeric not null check (max_ratio > 0),
  circuit_breaker_triggered boolean not null default false,
  constraint distinct_items check (item_a_id <> item_b_id),
  unique (item_a_id, item_b_id, season_id, window_end)
);

comment on table public.adaptive_ratio_bands is
  'เพดานอัตราแลกเปลี่ยนของ 5B ต่อคู่ไอเทม/season (โครงตารางเท่านั้น ยังไม่มี recalc function/trade RPC — เพดานที่ยืนยันแล้วคือ 1:3 ถึง 3:1)';

alter table public.adaptive_ratio_bands enable row level security;
-- ตั้งใจไม่เขียน policy ใดๆ เลย (RLS enabled + ไม่มี policy = deny ทั้งหมด) เหมือน adaptive_price_bands เดิม


-- ================================================================
-- SECTION 5: RLS สำหรับตารางใหม่ทั้งหมด
-- ================================================================

alter table public.marketplace_building_level_stats enable row level security;
create policy "marketplace_building_level_stats_public_select" on public.marketplace_building_level_stats
  for select using (true);

alter table public.marketplace_building_level_costs enable row level security;
create policy "marketplace_building_level_costs_public_select" on public.marketplace_building_level_costs
  for select using (true);

alter table public.player_marketplace_building enable row level security;
create policy "player_marketplace_building_owner_select" on public.player_marketplace_building
  for select using (auth.uid() = user_id);

alter table public.game_constants enable row level security;
create policy "game_constants_public_select" on public.game_constants
  for select using (true);
