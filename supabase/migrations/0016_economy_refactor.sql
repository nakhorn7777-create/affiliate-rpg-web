-- ============================================================
-- 0016: Economy Refactor — Engagement Minting, Adaptive Market,
-- Energy Gating, Merchant/Warmonger Factions, Warmonger Raids,
-- 3-Tier Seasonal Trophy
--
-- ⚠️ DRAFT — ยังไม่เคยรันกับ Supabase ที่ไหนเลย (ไม่ใช่ test project,
-- ไม่ใช่ production) ห้าม push เข้า PR ที่จะ trigger CI job
-- `integration-tests` (มันรัน `supabase db push` ใส่ test project จริง)
-- จนกว่าจะรีวิวและได้รับคำสั่งให้รันจริง
--
-- Dependency: รันหลัง 0000-0015 ถูก apply แล้วเท่านั้น, ต้องเปิด
-- extension pg_cron ผ่าน Supabase Dashboard ไว้ก่อนแล้ว (ตามที่ 0014
-- ต้องการอยู่แล้ว)
--
-- ขอบเขตที่ "ยังไม่มีในเกมจริง" ต้องรู้ก่อนอ่านไฟล์นี้:
--   - ไม่มี world map / พิกัด X,Y ในสคีมาเลย (Travian-style ผังเมือง
--     ยังไม่ถูกออกแบบ) -> launch_expedition() รับ p_travel_minutes ตรงๆ
--     จาก client เป็นการชั่วคราว มี floor 15 นาทีกันค่า 0/ติดลบ แต่ยัง
--     ไม่พอเพราะไม่มีระยะทางจริงให้ตรวจสอบ -- จึง revoke execute จาก
--     client ไว้ก่อนทั้งฟังก์ชัน (ดู SECTION 5) จนกว่าจะมี
--     server-authoritative distance calculation จริง
--   - ไม่มีระบบ hero/troop stat หรือ combat power ใดๆ -> resolve_expeditions()
--     คำนวณ loot ด้วยสูตรง่ายๆ (เปอร์เซ็นต์คงที่) ไม่ใช่ระบบต่อสู้จริง
--   - ไม่มี RPC เก็บเกี่ยว/คราฟต์อยู่เลยตอนนี้ (crafting_recipes มีแค่
--     master data) -> energy gating ที่ทำในนี้เป็นแค่ "โครงบัญชี
--     พลังงาน" (schema + consume/regen) รอ RPC เก็บเกี่ยวในอนาคตมาเรียกใช้
--   - "12-hour Post-Raid Cooldown Shield" ที่คุยไว้กับอีกเซสชัน **ยังไม่มี
--     ใน SQL ไฟล์นี้** (ตรวจแล้วไม่มี logic นี้อยู่จริง) ยังไม่มีสเปกพอจะ
--     implement เอง (shield กันทุกคนหรือกันเฉพาะ attacker เดิม, ฝั่งไหน
--     เห็นผล) รอรายละเอียดเพิ่มก่อนใส่
--
-- การตัดสินใจที่ต่างจากสเปกต้นฉบับ 1 จุด (ตั้งใจ ไม่ใช่พลาด):
--   doc ต้นฉบับบอกให้ "drop legacy season_rewards" แต่เช็คโค้ดแล้วพบว่า
--   src/app/page.tsx อ่าน season_rewards ตรงๆ สำหรับหน้า Landing hall-of-fame
--   อยู่ตอนนี้ (ยังไม่มี PR แก้ frontend คู่กัน) — ไฟล์นี้เลยทำ
--   season_trophies เป็นตารางใหม่แบบ "เพิ่มเข้าไป" ควบคู่กับของเดิม
--   ไม่ใช่แทนที่ ป้องกันหน้า Landing พังทันทีที่ apply migration
--
-- แก้ไขจากดราฟท์รอบก่อน (รอบรีวิวนี้) 3 จุด:
--   1. purchase_from_listing เคยรับ p_buyer_id จาก client ตรงๆ (regression
--      กลับไปช่องโหว่ที่ 0005_fix_rpc_actor_id_trust.sql เคยแก้แล้ว) —
--      ตัด parameter ทิ้ง ใช้ auth.uid() ภายในเท่านั้น
--   2. launch_expedition เพิ่ม floor 15 นาที + revoke execute จาก client
--      ไว้ก่อนทั้งฟังก์ชัน (ดูเหตุผลด้านบน)
--   3. recalc_adaptive_price_bands loop เดิมสแกนเฉพาะ item ที่มี listing
--      ใหม่ใน 24 ชม. ทำให้ item ที่ตลาดค้างสนิท (ไม่มีใครกล้าตั้งขายเลย)
--      ไม่มีวันเข้า circuit breaker ได้ — เปลี่ยนเป็น UNION ระหว่าง item
--      ที่มี band อยู่แล้ว (revive ตลาดค้าง) กับ item ที่เพิ่งมี listing
--      ใหม่แต่ยังไม่มี band (seed band แรก) ครอบคลุมทั้งสองเคส
-- ============================================================


-- ================================================================
-- SECTION 1: เลิกใช้ real-time follow-minting เดิม
-- แทนที่ด้วย server-authoritative high-water-mark delta minting
-- (รวม verified followers + unique profile views เข้าด้วยกัน)
-- ================================================================

drop trigger if exists on_new_follow on public.followers;
drop function if exists public.handle_new_follow();

comment on column public.game_stats.follow_tokens_earned is
  'DEPRECATED ตั้งแต่ 0016 — ค้างไว้เพื่อประวัติ season เก่าเท่านั้น เพดาน mint ใหม่ดูที่ engagement_mint_ledger.tokens_minted แทน';

-- ----------------------------------------------------------------
-- ENGAGEMENT_MINT_LEDGER: high-water-mark ต่อ user/season
-- ปิดสนิท ไม่มี policy ให้ client เลย เขียนได้ผ่าน mint_engagement_tokens()
-- (security definer) เท่านั้น
-- ----------------------------------------------------------------
create table public.engagement_mint_ledger (
  user_id uuid not null references public.profiles(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  last_minted_followers bigint not null default 0,
  last_minted_views bigint not null default 0,
  tokens_minted bigint not null default 0
    check (tokens_minted >= 0 and tokens_minted <= 1000),
  updated_at timestamptz not null default now(),
  primary key (user_id, season_id)
);

comment on table public.engagement_mint_ledger is
  'High-water-mark ของ engagement minting ต่อ user/season กันการ mint ซ้ำจากค่าที่นับไปแล้ว เพดาน 1000 token/season (jumpstart bonus เท่านั้น ไม่ใช่ตัวขับเศรษฐกิจหลัก)';

alter table public.engagement_mint_ledger enable row level security;
-- ตั้งใจไม่เขียน policy ใดๆ เลย (RLS enabled + ไม่มี policy = deny ทั้งหมด)

-- ----------------------------------------------------------------
-- Function: mint_engagement_tokens()
-- เรียกจาก client ตอนเปิดหน้าเกม (auth.uid() ภายในเท่านั้น ไม่รับ
-- p_user_id จาก client ตามข้อบังคับ RPC convention ใหม่)
--
-- สูตร: ΔTokens = (ΔVerified Followers × 10) + (ΔUnique Views × 0.5)
-- "verified" = follower/viewer ต้องไม่มีแถวใน fraud_flags เลย (กัน
-- bot farm ปั่นยอด) "unique views" ในดราฟท์นี้ = unique
-- authenticated-viewer-ต่อ-วัน ตามที่ profile_views บังคับ unique
-- อยู่แล้ว ไม่ใช่ unique-by-IP จริง (schema profile_views ไม่เก็บ IP
-- โดยตั้งใจ ตาม PDPA comment ใน signup_audit_log)
-- ----------------------------------------------------------------
create or replace function public.mint_engagement_tokens()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_season record;
  v_verified_followers bigint;
  v_verified_views bigint;
  v_ledger record;
  v_delta_followers bigint;
  v_delta_views bigint;
  v_raw_delta bigint;
  v_room_left bigint;
  v_actual_mint bigint;
begin
  if auth.uid() is null then
    raise exception 'ต้อง login ก่อน';
  end if;

  select * into v_active_season from public.seasons where status = 'active' limit 1;
  if v_active_season is null then
    return 0;
  end if;

  select count(*) into v_verified_followers
  from public.followers f
  where f.following_id = auth.uid()
    and f.season_id = v_active_season.id
    and not exists (select 1 from public.fraud_flags ff where ff.user_id = f.follower_id);

  select count(*) into v_verified_views
  from public.profile_views pv
  where pv.profile_id = auth.uid()
    and pv.viewed_at between v_active_season.starts_at and least(v_active_season.ends_at, now())
    and not exists (select 1 from public.fraud_flags ff where ff.user_id = pv.viewer_id);

  insert into public.engagement_mint_ledger (user_id, season_id)
  values (auth.uid(), v_active_season.id)
  on conflict (user_id, season_id) do nothing;

  select * into v_ledger
  from public.engagement_mint_ledger
  where user_id = auth.uid() and season_id = v_active_season.id
  for update;

  v_delta_followers := greatest(v_verified_followers - v_ledger.last_minted_followers, 0);
  v_delta_views := greatest(v_verified_views - v_ledger.last_minted_views, 0);
  v_raw_delta := floor(v_delta_followers * 10 + v_delta_views * 0.5)::bigint;
  v_room_left := 1000 - v_ledger.tokens_minted;
  v_actual_mint := least(v_raw_delta, greatest(v_room_left, 0));

  update public.engagement_mint_ledger
  set last_minted_followers = v_verified_followers,
      last_minted_views = v_verified_views,
      tokens_minted = tokens_minted + v_actual_mint,
      updated_at = now()
  where user_id = auth.uid() and season_id = v_active_season.id;

  if v_actual_mint > 0 then
    insert into public.game_stats (user_id, season_id, currency, season_joined_at)
    values (auth.uid(), v_active_season.id, v_actual_mint, now())
    on conflict (user_id, season_id) do update
    set currency = public.game_stats.currency + v_actual_mint;
  end if;

  return v_actual_mint;
end;
$$;

grant execute on function public.mint_engagement_tokens() to authenticated;


-- ================================================================
-- SECTION 2: Marketplace — Adaptive Price Bands + Circuit Breaker,
-- NPC Floor-Buyer, Item-Tier Taxation
-- ================================================================

-- เก็บของเก่าไว้เป็นประวัติ ไม่ลบทิ้ง (ไม่มี frontend อ่านตารางนี้
-- ตรงๆ ตอนนี้ ปลอดภัยที่จะเปลี่ยนชื่อ) หยุดเขียนเพิ่มตั้งแต่นี้ไป
alter table public.item_price_bands rename to item_price_bands_legacy;
comment on table public.item_price_bands_legacy is
  'DEPRECATED ตั้งแต่ 0016 — ระบบ batch-100-ชิ้นเดิม แทนที่ด้วย adaptive_price_bands เก็บไว้อ่านประวัติเท่านั้น ไม่มีการเขียนเพิ่ม';

drop function if exists public.recalc_price_band(uuid, uuid);

-- ----------------------------------------------------------------
-- ADAPTIVE_PRICE_BANDS: เพดานราคาคำนวณจาก sell-through rate ของ
-- หน้าต่างเวลาย้อนหลัง (ไม่ใช่นับทีละ 100 ชิ้นเหมือนเดิม)
-- ----------------------------------------------------------------
create table public.adaptive_price_bands (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid not null references public.game_items(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  window_end timestamptz not null default now(),
  units_sold bigint not null default 0,
  units_listed bigint not null default 0,
  sell_through_rate numeric not null default 0,
  min_price bigint not null,
  max_price bigint not null,
  circuit_breaker_triggered boolean not null default false,
  unique (item_id, season_id, window_end)
);

create index idx_adaptive_price_bands_lookup
  on public.adaptive_price_bands(item_id, season_id, window_end desc);

comment on table public.adaptive_price_bands is
  'เพดานราคาต่อไอเทม/season คำนวณใหม่ทุก 6 ชม. จาก sell-through rate ของหน้าต่าง 24 ชม.ล่าสุด มี circuit breaker +15% เมื่อขายไม่ออกเลย กันตลาดตายสนิท ปิดสนิทไม่มี policy ให้ client อ่านตรงๆ (ต้องผ่าน RPC ในอนาคตตอนสร้าง marketplace UI จริง)';

alter table public.adaptive_price_bands enable row level security;
-- ตั้งใจไม่เขียน policy ใดๆ เลย (RLS enabled + ไม่มี policy = deny ทั้งหมด)
-- TODO: เมื่อสร้าง marketplace UI จริง ต้องเพิ่ม get_price_band(item_id)
-- RPC สำหรับให้ผู้ขายเห็นเพดานปัจจุบันก่อนตั้งราคา

-- ----------------------------------------------------------------
-- Function: recalc_adaptive_price_bands() — cron ทุก 6 ชม.
-- Loop มาจาก UNION ของ 2 แหล่ง (แก้จากดราฟท์รอบก่อนที่สแกนแค่แหล่งเดียว
-- แล้วทำให้ item ที่ตลาดค้างสนิทไม่มีวันเข้า circuit breaker):
--   - item ที่มี adaptive_price_bands อยู่แล้ว (ครอบคลุมเคสตลาดค้าง —
--     ไม่มีใครกล้าตั้งขายเลยในช่วงนี้ แต่ยังต้อง revive เพดานเก่าได้)
--   - item ที่เพิ่งมี listing ใหม่ใน 24 ชม.แต่ยังไม่เคยมี band (seed
--     เพดานแรกให้)
--
-- สำหรับแต่ละคู่ (item, season ที่ active): คำนวณ sell-through = ขายได้
-- / ตั้งขาย (โดยประมาณจาก quantity ตอนตั้ง ไม่ได้หักลบ partial fill
-- แบบละเอียด)
--   - sell_through = 0 (และมีเพดานเก่าอยู่แล้ว) -> circuit breaker:
--     ขยายทั้งเพดานบนล่าง +15%
--   - sell_through สูง (>= 0.5) -> ขยับฐานราคาขึ้นตามราคาขายเฉลี่ยจริง
--   - ปกติ -> ยึดราคาขายเฉลี่ยจริง ช่วง 0.5x-2x (สัดส่วนเดียวกับของเดิม)
-- ----------------------------------------------------------------
create or replace function public.recalc_adaptive_price_bands()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_season uuid;
  v_item record;
  v_units_sold bigint;
  v_units_listed bigint;
  v_sell_through numeric;
  v_avg_price numeric;
  v_prev_min bigint;
  v_prev_max bigint;
  v_new_min bigint;
  v_new_max bigint;
  v_circuit_breaker boolean;
begin
  select id into v_active_season from public.seasons where status = 'active' limit 1;
  if v_active_season is null then
    return;
  end if;

  for v_item in
    select item_id from public.adaptive_price_bands where season_id = v_active_season
    union
    select distinct item_id from public.marketplace_listings
    where season_id = v_active_season and created_at > now() - interval '24 hours'
  loop
    select coalesce(sum(mt.quantity), 0), coalesce(avg(mt.total_price::numeric / mt.quantity), null)
    into v_units_sold, v_avg_price
    from public.marketplace_transactions mt
    join public.marketplace_listings ml on ml.id = mt.listing_id
    where ml.item_id = v_item.item_id
      and ml.season_id = v_active_season
      and mt.transacted_at > now() - interval '24 hours';

    select coalesce(sum(quantity), 0) into v_units_listed
    from public.marketplace_listings
    where item_id = v_item.item_id
      and season_id = v_active_season
      and created_at > now() - interval '24 hours';

    v_sell_through := v_units_sold::numeric / greatest(v_units_listed, 1);
    v_circuit_breaker := false;

    select min_price, max_price into v_prev_min, v_prev_max
    from public.adaptive_price_bands
    where item_id = v_item.item_id and season_id = v_active_season
    order by window_end desc
    limit 1;

    if v_units_sold = 0 and v_prev_min is not null then
      -- circuit breaker: ตลาดค้าง ไม่มีใครขายได้เลยในหน้าต่างนี้ (ครอบคลุม
      -- ทั้งเคส "ตั้งขายแต่ไม่มีคนซื้อ" และ "ไม่มีใครกล้าตั้งขายเลย" เพราะ
      -- loop source ด้านบนดึง item ที่มี band อยู่แล้วมาด้วยเสมอ)
      v_circuit_breaker := true;
      v_new_min := greatest(floor(v_prev_min * 0.85), 1);
      v_new_max := ceil(v_prev_max * 1.15);
    elsif v_avg_price is not null and v_sell_through >= 0.5 then
      -- ดีมานด์สูง: ขยับฐานราคาขึ้นตามราคาขายจริง ช่วงแคบกว่าปกติ
      v_new_min := greatest(floor(v_avg_price * 0.7), 1);
      v_new_max := ceil(v_avg_price * 1.5);
    elsif v_avg_price is not null then
      -- ปกติ: ยึดราคาขายเฉลี่ยจริง ช่วง 0.5x-2x เหมือนของเดิม
      v_new_min := greatest(floor(v_avg_price * 0.5), 1);
      v_new_max := ceil(v_avg_price * 2);
    else
      -- ไม่มีข้อมูลขายเลยและไม่มีเพดานเก่า -> ยังไม่ตั้งเพดาน (ราคาอิสระ)
      continue;
    end if;

    insert into public.adaptive_price_bands
      (item_id, season_id, units_sold, units_listed, sell_through_rate, min_price, max_price, circuit_breaker_triggered)
    values
      (v_item.item_id, v_active_season, v_units_sold, v_units_listed, v_sell_through, v_new_min, v_new_max, v_circuit_breaker)
    on conflict (item_id, season_id, window_end) do nothing;
  end loop;
end;
$$;

revoke execute on function public.recalc_adaptive_price_bands() from public, anon, authenticated;

-- ----------------------------------------------------------------
-- Trigger: validate_listing_price ต้องอ่านจาก adaptive_price_bands แทน
-- ----------------------------------------------------------------
create or replace function public.validate_listing_price()
returns trigger as $$
declare
  v_band record;
begin
  select * into v_band
  from public.adaptive_price_bands
  where item_id = new.item_id and season_id = new.season_id
  order by window_end desc
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
-- trigger validate_listing_price_trigger เดิมชี้มาที่ function นี้อยู่แล้ว
-- ไม่ต้อง create trigger ใหม่ (create or replace function พอ)

-- ----------------------------------------------------------------
-- Item-tier taxation: base rate ตาม item_type (T1 resource ถูกกว่า
-- T2 crafted) คูณด้วยส่วนลดตาม subscription tier
-- ----------------------------------------------------------------
drop function if exists public.get_marketplace_tax_rate(text);

create or replace function public.get_marketplace_tax_rate(p_seller_tier text, p_item_type text)
returns numeric as $$
declare
  v_base_rate numeric;
  v_tier_discount numeric;
begin
  v_base_rate := case p_item_type
    when 'crafted' then 0.30 -- T2: ของแปรรูป แรงเสียดทานสูงกว่า
    else 0.15                 -- T1 (resource) และอื่นๆ: วัตถุดิบดิบ ภาษีต่ำกว่า
  end;

  v_tier_discount := case p_seller_tier
    when 'legendary' then 0.5
    when 'platinum' then 0.7
    else 1.0
  end;

  return round(v_base_rate * v_tier_discount, 4);
end;
$$ language plpgsql immutable;

-- ----------------------------------------------------------------
-- purchase_from_listing: rewrite ทั้งฟังก์ชัน
--
-- [CRITICAL SECURITY FIX รอบนี้] ดราฟท์ก่อนหน้ารับ p_buyer_id เป็น
-- parameter จาก client ตรงๆ ซึ่งเป็น regression กลับไปช่องโหว่ที่
-- 0005_fix_rpc_actor_id_trust.sql เคยแก้ไปแล้ว (client ยิง RPC พร้อม
-- ใส่ user id คนอื่นแทนตัวเอง บังคับให้บัญชีคนอื่นควักเงินซื้อของโดย
-- ไม่ยินยอมได้) — ตัด parameter ทิ้งทั้งหมด ใช้ auth.uid() ภายใน
-- ฟังก์ชันเท่านั้น ต้อง drop signature เดิม (3 parameter) ก่อน ไม่งั้น
-- create or replace จะสร้าง overload ใหม่ควบคู่ ทำให้ signature เดิมที่
-- มีช่องโหว่ยังเรียกได้อยู่
-- ----------------------------------------------------------------
drop function if exists public.purchase_from_listing(uuid, uuid, bigint);

create or replace function public.purchase_from_listing(
  p_listing_id uuid,
  p_quantity bigint
) returns void as $$
declare
  v_buyer_id uuid;
  v_listing record;
  v_total_price bigint;
  v_tax bigint;
  v_seller_receive bigint;
  v_seller_tier text;
  v_item_type text;
  v_tax_rate numeric;
begin
  if auth.uid() is null then
    raise exception 'ต้อง login ก่อน';
  end if;
  v_buyer_id := auth.uid();

  select * into v_listing
  from public.marketplace_listings
  where id = p_listing_id
  for update;

  if v_listing is null or v_listing.status <> 'active' then
    raise exception 'listing นี้ไม่พร้อมขายแล้ว';
  end if;

  if not exists (
    select 1 from public.seasons
    where id = v_listing.season_id and status = 'active'
  ) then
    raise exception 'ซีซั่นนี้ปิดการซื้อขายแล้ว (freeze)';
  end if;

  if v_listing.seller_id = v_buyer_id then
    raise exception 'ไม่สามารถซื้อของจากร้านตัวเองได้';
  end if;

  if p_quantity > v_listing.quantity then
    raise exception 'สินค้าที่เหลือไม่พอ (เหลือ % ชิ้น)', v_listing.quantity;
  end if;

  select tier into v_seller_tier
  from public.game_stats
  where user_id = v_listing.seller_id and season_id = v_listing.season_id;

  select item_type into v_item_type
  from public.game_items
  where id = v_listing.item_id;

  v_tax_rate := public.get_marketplace_tax_rate(coalesce(v_seller_tier, 'copper'), v_item_type);

  v_total_price := p_quantity * v_listing.price_per_unit;
  v_tax := floor(v_total_price * v_tax_rate);
  v_seller_receive := v_total_price - v_tax;

  update public.game_stats
  set currency = currency - v_total_price
  where user_id = v_buyer_id
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
  values (v_buyer_id, v_listing.season_id, v_listing.item_id, p_quantity)
  on conflict (user_id, season_id, item_id)
  do update set quantity = public.player_inventory.quantity + p_quantity;

  insert into public.marketplace_transactions (listing_id, buyer_id, quantity, total_price)
  values (p_listing_id, v_buyer_id, p_quantity, v_total_price);
  -- หมายเหตุ: ไม่เรียก recalc price band ทันทีต่อธุรกรรมแล้ว
  -- (adaptive band คำนวณเป็นรอบทุก 6 ชม.ผ่าน cron แทน)
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.purchase_from_listing(uuid, bigint) to authenticated;

-- ----------------------------------------------------------------
-- NPC Floor-Buyer: รับซื้อวัตถุดิบ T1 (resource) เท่านั้น ที่ราคา
-- floor คงที่ (admin ตั้งต่อไอเทมใน game_items.npc_floor_price)
-- ประกันรายได้พื้นฐานให้มือใหม่ ไม่มีภาษี ไม่ผูกกับ adaptive band
-- ----------------------------------------------------------------
alter table public.game_items add column npc_floor_price bigint check (npc_floor_price > 0);
comment on column public.game_items.npc_floor_price is
  'ราคา floor ที่ NPC รับซื้อ (เฉพาะ item_type=resource เท่านั้น) null = NPC ไม่รับซื้อไอเทมนี้ ตั้งค่าโดย admin เอง';

create or replace function public.sell_to_npc(p_item_id uuid, p_quantity bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_season uuid;
  v_item record;
  v_total bigint;
begin
  if auth.uid() is null then
    raise exception 'ต้อง login ก่อน';
  end if;

  if p_quantity <= 0 then
    raise exception 'จำนวนต้องมากกว่า 0';
  end if;

  select id into v_active_season from public.seasons where status = 'active' limit 1;
  if v_active_season is null then
    raise exception 'ไม่มี season ที่ active อยู่ตอนนี้';
  end if;

  select * into v_item from public.game_items where id = p_item_id;
  if v_item is null or v_item.item_type <> 'resource' or v_item.npc_floor_price is null then
    raise exception 'ไอเทมนี้ NPC ไม่รับซื้อ';
  end if;

  update public.player_inventory
  set quantity = quantity - p_quantity
  where user_id = auth.uid()
    and season_id = v_active_season
    and item_id = p_item_id
    and quantity >= p_quantity;

  if not found then
    raise exception 'ไอเทมในคลังไม่พอ';
  end if;

  v_total := v_item.npc_floor_price * p_quantity;

  insert into public.game_stats (user_id, season_id, currency)
  values (auth.uid(), v_active_season, v_total)
  on conflict (user_id, season_id)
  do update set currency = public.game_stats.currency + v_total;

  return v_total;
end;
$$;

grant execute on function public.sell_to_npc(uuid, bigint) to authenticated;


-- ================================================================
-- SECTION 3: Energy Gating — โครงบัญชีพลังงาน (schema เท่านั้น รอ
-- RPC เก็บเกี่ยว/คราฟต์ในอนาคตมาเรียกใช้ consume_energy)
-- ================================================================

alter table public.game_stats
  add column energy_remaining int not null default 240 check (energy_remaining between 0 and 240),
  add column energy_reset_date date not null default current_date,
  add column season_joined_at timestamptz not null default now();

comment on column public.game_stats.energy_remaining is
  '1 แต้ม = 1 นาที auto-farm สูงสุด 240/วัน (4 ชม.) รีเซ็ตเต็มทุกวันปฏิทิน ไม่ใช่ regen แบบค่อยเป็นค่อยไป';
comment on column public.game_stats.season_joined_at is
  'เวลาที่ผู้เล่นเริ่ม season นี้จริง (insert ครั้งแรกของ season) ใช้เป็นจุดอ้างอิง 7-วัน novice protection shield';

-- ----------------------------------------------------------------
-- Function: consume_energy(p_minutes) — auth.uid() ภายใน รีเซ็ต
-- อัตโนมัติถ้าข้ามวันปฏิทินแล้ว คืนค่า is_depleted เพื่อให้ RPC เก็บ
-- เกี่ยว/คราฟต์ในอนาคต (ยังไม่มีในโค้ดตอนนี้) เอาไปหักอัตรา drop เอง
-- ----------------------------------------------------------------
create or replace function public.consume_energy(p_minutes int)
returns table (energy_remaining int, is_depleted boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_season uuid;
  v_stats record;
begin
  if auth.uid() is null then
    raise exception 'ต้อง login ก่อน';
  end if;

  select id into v_active_season from public.seasons where status = 'active' limit 1;
  if v_active_season is null then
    raise exception 'ไม่มี season ที่ active อยู่ตอนนี้';
  end if;

  select * into v_stats from public.game_stats
  where user_id = auth.uid() and season_id = v_active_season
  for update;

  if v_stats is null or v_stats.energy_reset_date < current_date then
    insert into public.game_stats (user_id, season_id, energy_remaining, energy_reset_date)
    values (auth.uid(), v_active_season, 240, current_date)
    on conflict (user_id, season_id) do update
    set energy_remaining = 240, energy_reset_date = current_date;
  end if;

  update public.game_stats
  set energy_remaining = greatest(energy_remaining - p_minutes, 0)
  where user_id = auth.uid() and season_id = v_active_season;

  return query
  select gs.energy_remaining, gs.energy_remaining <= 0
  from public.game_stats gs
  where gs.user_id = auth.uid() and gs.season_id = v_active_season;
end;
$$;

grant execute on function public.consume_energy(int) to authenticated;

create or replace function public.get_energy_status()
returns table (energy_remaining int, is_depleted boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_active_season uuid;
begin
  select id into v_active_season from public.seasons where status = 'active' limit 1;
  if v_active_season is null or auth.uid() is null then
    return;
  end if;

  return query
  select
    case when gs.energy_reset_date < current_date then 240 else gs.energy_remaining end,
    case when gs.energy_reset_date < current_date then false else gs.energy_remaining <= 0 end
  from public.game_stats gs
  where gs.user_id = auth.uid() and gs.season_id = v_active_season;
end;
$$;

grant execute on function public.get_energy_status() to authenticated;


-- ================================================================
-- SECTION 4: Merchant vs Warmonger Faction System
-- 7-day novice shield -> เลือกสาย -> สลับสายมี cooldown 3 วัน (delayed
-- effect ไม่ใช่ delayed permission) + weekly balance snapshot พร้อม
-- dampening ±10%/สัปดาห์ (ตามที่คุยกันแล้วว่าไม่เอา real-time ป้องกัน
-- oscillation)
-- ================================================================

alter table public.game_stats
  add column faction text check (faction in ('merchant', 'warmonger')),
  add column faction_selected_at timestamptz,
  add column pending_faction text check (pending_faction in ('merchant', 'warmonger')),
  add column faction_effective_at timestamptz,
  add column vault_capacity_pct numeric not null default 0.20 check (vault_capacity_pct between 0 and 1);

comment on column public.game_stats.vault_capacity_pct is
  'สัดส่วนทรัพยากรที่ปล้นไม่ได้เด็ดขาด ค่า default 0.20 เป็นตัวเลขตั้งต้นชั่วคราว รอ balance จริงจากการทดสอบ';

-- ----------------------------------------------------------------
-- Function: select_faction(p_faction) — auth.uid() ภายใน
-- เลือกครั้งแรก: ต้องผ่าน 7 วัน novice shield ก่อน (นับจาก
-- season_joined_at) — เป็นการตีความตรงตามสเปกที่ล็อกไว้ ("after the
-- shield, players must choose") จุดนี้ค่อนข้างพิเศษ (เลือกสายไม่ได้
-- เลยในสัปดาห์แรก) แนะนำให้ทวนกับทีมออกแบบเกมอีกทีว่าตั้งใจแบบนี้จริง
-- ก่อน apply เพราะกระทบ onboarding UX โดยตรง
--
-- สลับสายภายหลัง: ไม่เปลี่ยนทันที เก็บเป็น pending_faction +
-- faction_effective_at = now()+3วัน แล้วให้ cron
-- apply_pending_faction_switches() ไปเปลี่ยนให้ตอนถึงเวลา (สายเดิม
-- ยังมีผลอยู่ระหว่างรอ กันเคส "โจมตีแล้วรีบสลับมาเป็น merchant หนี")
-- ----------------------------------------------------------------
create or replace function public.select_faction(p_faction text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_season uuid;
  v_stats record;
begin
  if auth.uid() is null then
    raise exception 'ต้อง login ก่อน';
  end if;

  if p_faction not in ('merchant', 'warmonger') then
    raise exception 'invalid faction: %', p_faction;
  end if;

  select id into v_active_season from public.seasons where status = 'active' limit 1;
  if v_active_season is null then
    raise exception 'ไม่มี season ที่ active อยู่ตอนนี้';
  end if;

  select * into v_stats from public.game_stats
  where user_id = auth.uid() and season_id = v_active_season
  for update;

  if v_stats is null then
    raise exception 'ยังไม่มีข้อมูลผู้เล่นใน season นี้ (login ก่อน)';
  end if;

  if v_stats.faction is null then
    if now() < v_stats.season_joined_at + interval '7 days' then
      raise exception 'ยังอยู่ในช่วง novice protection shield 7 วันแรก เลือกสายไม่ได้จนกว่าจะพ้นช่วงนี้';
    end if;

    update public.game_stats
    set faction = p_faction, faction_selected_at = now()
    where user_id = auth.uid() and season_id = v_active_season;
  else
    if v_stats.faction = p_faction then
      raise exception 'อยู่สายนี้อยู่แล้ว';
    end if;
    if v_stats.pending_faction is not null then
      raise exception 'มีคำขอเปลี่ยนสายที่รอดำเนินการอยู่แล้ว (มีผลใน %)', v_stats.faction_effective_at;
    end if;

    update public.game_stats
    set pending_faction = p_faction, faction_effective_at = now() + interval '3 days'
    where user_id = auth.uid() and season_id = v_active_season;
  end if;
end;
$$;

grant execute on function public.select_faction(text) to authenticated;

create or replace function public.apply_pending_faction_switches()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.game_stats
  set faction = pending_faction,
      faction_selected_at = now(),
      pending_faction = null,
      faction_effective_at = null
  where pending_faction is not null and faction_effective_at <= now();
end;
$$;

revoke execute on function public.apply_pending_faction_switches() from public, anon, authenticated;

-- ----------------------------------------------------------------
-- FACTION_BALANCE_STATE: 1 แถวต่อ season เก็บ multiplier ปัจจุบัน
-- อ่านได้สาธารณะ (ให้ผู้เล่นเห็นบัฟปัจจุบันของแต่ละสายได้)
-- ----------------------------------------------------------------
create table public.faction_balance_state (
  season_id uuid primary key references public.seasons(id) on delete cascade,
  merchant_ratio numeric not null default 0.5,
  merchant_multiplier numeric not null default 1.0,
  warmonger_multiplier numeric not null default 1.0,
  updated_at timestamptz not null default now()
);

comment on table public.faction_balance_state is
  'บัฟ multiplier ปัจจุบันของแต่ละสาย คำนวณใหม่ทุกสัปดาห์ผ่าน recalc_faction_balance() เปลี่ยนได้ครั้งละไม่เกิน ±10% กัน oscillation';

alter table public.faction_balance_state enable row level security;
create policy "faction_balance_state_public_select" on public.faction_balance_state
  for select using (true);

-- ----------------------------------------------------------------
-- Function: recalc_faction_balance() — cron รายสัปดาห์ (จันทร์ 00:00 UTC)
-- ฝั่งที่เป็นชนกลุ่มน้อยได้ multiplier สูงขึ้น (1.0-2.0) ฝั่งข้างมาก
-- คงที่ 1.0 เสมอ เปลี่ยนแปลงจำกัดไม่เกิน ±10%/สัปดาห์ (dampening กัน
-- ระบบแกว่งไปมา ตามที่ตกลงกันไว้แทนการคำนวณ real-time)
--
-- สูตร target multiplier เป็นเส้นตรงแบบง่าย (first-pass ยังไม่ผ่านการ
-- ทดสอบ balance จริง): ยิ่งห่างจาก 50/50 มาก ยิ่งได้บัฟเยอะ คลิปที่
-- 1.0-2.0
-- ----------------------------------------------------------------
create or replace function public.recalc_faction_balance()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_season uuid;
  v_merchant_count int;
  v_warmonger_count int;
  v_total int;
  v_merchant_ratio numeric;
  v_target_merchant_mult numeric;
  v_target_warmonger_mult numeric;
  v_current record;
  v_new_merchant_mult numeric;
  v_new_warmonger_mult numeric;
begin
  select id into v_active_season from public.seasons where status = 'active' limit 1;
  if v_active_season is null then
    return;
  end if;

  select count(*) filter (where faction = 'merchant'), count(*) filter (where faction = 'warmonger')
  into v_merchant_count, v_warmonger_count
  from public.game_stats
  where season_id = v_active_season;

  v_total := v_merchant_count + v_warmonger_count;
  if v_total = 0 then
    return;
  end if;

  v_merchant_ratio := v_merchant_count::numeric / v_total;

  v_target_merchant_mult := case
    when v_merchant_ratio < 0.5 then least(2.0, 1.0 + (0.5 - v_merchant_ratio) * 2)
    else 1.0
  end;
  v_target_warmonger_mult := case
    when v_merchant_ratio > 0.5 then least(2.0, 1.0 + (v_merchant_ratio - 0.5) * 2)
    else 1.0
  end;

  insert into public.faction_balance_state (season_id, merchant_ratio, merchant_multiplier, warmonger_multiplier)
  values (v_active_season, v_merchant_ratio, 1.0, 1.0)
  on conflict (season_id) do nothing;

  select * into v_current from public.faction_balance_state where season_id = v_active_season for update;

  -- dampening: เปลี่ยนได้ไม่เกิน ±10% ต่อรอบ (รอบละ 1 สัปดาห์)
  v_new_merchant_mult := v_current.merchant_multiplier
    + greatest(least(v_target_merchant_mult - v_current.merchant_multiplier, 0.10), -0.10);
  v_new_warmonger_mult := v_current.warmonger_multiplier
    + greatest(least(v_target_warmonger_mult - v_current.warmonger_multiplier, 0.10), -0.10);

  update public.faction_balance_state
  set merchant_ratio = v_merchant_ratio,
      merchant_multiplier = v_new_merchant_mult,
      warmonger_multiplier = v_new_warmonger_mult,
      updated_at = now()
  where season_id = v_active_season;
end;
$$;

revoke execute on function public.recalc_faction_balance() from public, anon, authenticated;

create or replace function public.get_faction_multiplier(p_faction text)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_active_season uuid;
  v_mult numeric;
begin
  select id into v_active_season from public.seasons where status = 'active' limit 1;
  if v_active_season is null then
    return 1.0;
  end if;

  select case p_faction when 'merchant' then merchant_multiplier when 'warmonger' then warmonger_multiplier else 1.0 end
  into v_mult
  from public.faction_balance_state
  where season_id = v_active_season;

  return coalesce(v_mult, 1.0);
end;
$$;

grant execute on function public.get_faction_multiplier(text) to authenticated;


-- ================================================================
-- SECTION 5: Warmonger Raids — Async Expedition Queue + Vault Protection
-- ⚠️ ไม่มีระบบ combat power/troop stat ใดๆ ในสคีมาตอนนี้ loot
-- คำนวณด้วยสูตร placeholder ง่ายๆ ไม่ใช่ระบบต่อสู้จริง รอออกแบบเพิ่ม
-- ================================================================

create table public.expeditions (
  id uuid primary key default uuid_generate_v4(),
  attacker_id uuid not null references public.profiles(id) on delete cascade,
  defender_id uuid not null references public.profiles(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  status text not null default 'traveling' check (status in ('traveling', 'resolved', 'cancelled')),
  departed_at timestamptz not null default now(),
  arrival_time timestamptz not null,
  resolved_at timestamptz,
  loot_amount bigint,
  constraint no_self_raid check (attacker_id <> defender_id)
);

create index idx_expeditions_pending on public.expeditions(status, arrival_time) where status = 'traveling';
create index idx_expeditions_attacker on public.expeditions(attacker_id);
create index idx_expeditions_defender on public.expeditions(defender_id);

comment on table public.expeditions is
  'คิวการโจมตีแบบ async — server เป็นคนตัดสิน (resolve_expeditions cron) ไม่มี real-time combat UI ผู้โจมตีเห็นคิวตัวเองได้เสมอ ผู้ถูกโจมตีเห็นได้เฉพาะหลัง resolved แล้ว (กัน scouting/fog-of-war)';

alter table public.expeditions enable row level security;

create policy "expeditions_attacker_select" on public.expeditions
  for select using (attacker_id = auth.uid());

create policy "expeditions_defender_select_resolved" on public.expeditions
  for select using (defender_id = auth.uid() and status = 'resolved');

-- ----------------------------------------------------------------
-- Function: launch_expedition(p_defender_id, p_travel_minutes)
-- auth.uid() = attacker เสมอ ตรวจ faction ทั้งสองฝ่าย + novice shield
-- ทั้งสองฝ่าย ก่อนอนุญาต
--
-- [EXPEDITION SECURITY FIX รอบนี้] เพิ่ม floor 15 นาที (greatest)
-- กันค่า 0/ติดลบจาก client ตรงๆ -- แต่ floor เพียงอย่างเดียวยังไม่พอ
-- เพราะยังไม่มี world map/พิกัดให้คำนวณระยะทางจริงฝั่ง server เลย
-- (ทุกค่า >= 15 ยังโกหกได้อยู่ดี ไม่มีอะไรเทียบ) จึง revoke execute
-- จาก client ไว้ทั้งฟังก์ชันด้านล่าง จนกว่าจะมี server-authoritative
-- distance calculation จริง — โค้ดพร้อมใช้ทันทีที่ re-grant ทีหลัง
-- ----------------------------------------------------------------
create or replace function public.launch_expedition(p_defender_id uuid, p_travel_minutes int)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_season uuid;
  v_attacker record;
  v_defender record;
  v_expedition_id uuid;
  v_travel_minutes int;
begin
  if auth.uid() is null then
    raise exception 'ต้อง login ก่อน';
  end if;

  v_travel_minutes := greatest(coalesce(p_travel_minutes, 15), 15);

  select id into v_active_season from public.seasons where status = 'active' limit 1;
  if v_active_season is null then
    raise exception 'ไม่มี season ที่ active อยู่ตอนนี้';
  end if;

  select * into v_attacker from public.game_stats
  where user_id = auth.uid() and season_id = v_active_season;

  select * into v_defender from public.game_stats
  where user_id = p_defender_id and season_id = v_active_season;

  if v_attacker is null or v_attacker.faction <> 'warmonger' then
    raise exception 'ต้องเป็นสาย warmonger ถึงจะโจมตีได้';
  end if;

  if now() < v_attacker.season_joined_at + interval '7 days' then
    raise exception 'ยังอยู่ในช่วง novice protection shield โจมตีไม่ได้';
  end if;

  if v_defender is null then
    raise exception 'ไม่พบผู้เล่นเป้าหมายใน season นี้';
  end if;

  if v_defender.faction = 'merchant' then
    raise exception 'สาย merchant ป้องกันจากการโจมตี โจมตีไม่ได้';
  end if;

  if now() < v_defender.season_joined_at + interval '7 days' then
    raise exception 'เป้าหมายยังอยู่ในช่วง novice protection shield';
  end if;

  insert into public.expeditions (attacker_id, defender_id, season_id, arrival_time)
  values (auth.uid(), p_defender_id, v_active_season, now() + (v_travel_minutes || ' minutes')::interval)
  returning id into v_expedition_id;

  return v_expedition_id;
end;
$$;

-- ⚠️ ปิดการเรียกจาก client ไว้ก่อน (ดูเหตุผลในคอมเมนต์เหนือฟังก์ชัน)
-- เปิดใช้อีกครั้งด้วย `grant execute on function public.launch_expedition(uuid, int) to authenticated;`
-- เมื่อมี server-authoritative distance calculation จริงแล้วเท่านั้น
revoke execute on function public.launch_expedition(uuid, int) from public, anon, authenticated;

-- ----------------------------------------------------------------
-- Function: resolve_expeditions() — cron ทุก 5 นาที ตัดสินคิวที่
-- arrival_time ถึงแล้ว loot = currency ผู้ถูกโจมตีที่ "ปล้นได้"
-- (หลังหัก vault_capacity_pct ที่ปกป้องไว้) × 10% แบบ placeholder
-- (ยังไม่มี troop/hero power มาคูณ ตามที่ตกลงไว้ว่ายังไม่ออกแบบ
-- combat resolution จริงในดราฟท์นี้)
-- ----------------------------------------------------------------
create or replace function public.resolve_expeditions()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exp record;
  v_defender_stats record;
  v_raidable bigint;
  v_loot bigint;
begin
  for v_exp in
    select * from public.expeditions
    where status = 'traveling' and arrival_time <= now()
    for update
  loop
    select * into v_defender_stats from public.game_stats
    where user_id = v_exp.defender_id and season_id = v_exp.season_id
    for update;

    if v_defender_stats is null then
      update public.expeditions set status = 'cancelled', resolved_at = now() where id = v_exp.id;
      continue;
    end if;

    v_raidable := floor(v_defender_stats.currency * (1 - v_defender_stats.vault_capacity_pct));
    v_loot := floor(v_raidable * 0.10); -- placeholder: 10% ของส่วนที่ปล้นได้ ไม่มี combat power คูณ

    update public.game_stats
    set currency = currency - v_loot
    where user_id = v_exp.defender_id and season_id = v_exp.season_id;

    insert into public.game_stats (user_id, season_id, currency)
    values (v_exp.attacker_id, v_exp.season_id, v_loot)
    on conflict (user_id, season_id) do update
    set currency = public.game_stats.currency + v_loot;

    update public.expeditions
    set status = 'resolved', resolved_at = now(), loot_amount = v_loot
    where id = v_exp.id;
  end loop;
end;
$$;

revoke execute on function public.resolve_expeditions() from public, anon, authenticated;


-- ================================================================
-- SECTION 6: Seasonal Trophy — 3-Tier (เพิ่มเข้าไปควบคู่กับ
-- season_rewards เดิม ไม่ใช่แทนที่ ตามเหตุผลที่อธิบายไว้ที่หัวไฟล์)
-- ================================================================

create table public.season_trophies (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  trophy_tier text not null
    check (trophy_tier in ('grand_champion', 'first_runner_up', 'second_runner_up', 'elite', 'participation')),
  rank_in_season int,
  currency_at_finalize bigint not null,
  awarded_at timestamptz not null default now(),
  unique (user_id, season_id)
);

create index idx_season_trophies_user on public.season_trophies(user_id);

comment on table public.season_trophies is
  '3-tier trophy ใหม่: grand_champion/1st/2nd runner-up (top3), elite (top 5% floor 50 ceiling 200 คน), participation (level>=10 และ login>=7วัน) เขียนได้ทางเดียวผ่าน finalize_season_trophies() เท่านั้น (immutable ประวัติ)';

alter table public.season_trophies enable row level security;
create policy "season_trophies_public_select" on public.season_trophies
  for select using (true);
-- ตั้งใจไม่มี insert/update/delete policy ให้ client เลย เขียนได้ผ่าน
-- finalize_season_trophies() (security definer, revoke execute จาก client) เท่านั้น

-- ----------------------------------------------------------------
-- Function: finalize_season_trophies(p_season_id) — เรียกจาก
-- end_season() เท่านั้น (revoke execute จาก client)
-- Tie-break: currency DESC, updated_at ASC (มาถึงก่อนชนะ)
-- ----------------------------------------------------------------
create or replace function public.finalize_season_trophies(p_season_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_players int;
  v_elite_ceiling int;
  v_player record;
begin
  select count(*) into v_total_players
  from public.game_stats
  where season_id = p_season_id;

  if v_total_players = 0 then
    return;
  end if;

  -- top 5% ของผู้เล่นทั้งหมด คลิปที่ floor 50 / ceiling 200 คน แต่ไม่
  -- เกินจำนวนผู้เล่นจริงในซีซั่นนั้น
  v_elite_ceiling := least(greatest(ceil(v_total_players * 0.05)::int, 50), 200, v_total_players);

  for v_player in
    select user_id, currency, level, total_login_days,
           row_number() over (order by currency desc, updated_at asc) as rn
    from public.game_stats
    where season_id = p_season_id
  loop
    if v_player.rn = 1 then
      insert into public.season_trophies (user_id, season_id, trophy_tier, rank_in_season, currency_at_finalize)
      values (v_player.user_id, p_season_id, 'grand_champion', v_player.rn, v_player.currency)
      on conflict (user_id, season_id) do nothing;
    elsif v_player.rn = 2 then
      insert into public.season_trophies (user_id, season_id, trophy_tier, rank_in_season, currency_at_finalize)
      values (v_player.user_id, p_season_id, 'first_runner_up', v_player.rn, v_player.currency)
      on conflict (user_id, season_id) do nothing;
    elsif v_player.rn = 3 then
      insert into public.season_trophies (user_id, season_id, trophy_tier, rank_in_season, currency_at_finalize)
      values (v_player.user_id, p_season_id, 'second_runner_up', v_player.rn, v_player.currency)
      on conflict (user_id, season_id) do nothing;
    elsif v_player.rn <= v_elite_ceiling then
      insert into public.season_trophies (user_id, season_id, trophy_tier, rank_in_season, currency_at_finalize)
      values (v_player.user_id, p_season_id, 'elite', v_player.rn, v_player.currency)
      on conflict (user_id, season_id) do nothing;
    elsif v_player.level >= 10 and v_player.total_login_days >= 7 then
      insert into public.season_trophies (user_id, season_id, trophy_tier, rank_in_season, currency_at_finalize)
      values (v_player.user_id, p_season_id, 'participation', v_player.rn, v_player.currency)
      on conflict (user_id, season_id) do nothing;
    end if;
  end loop;
end;
$$;

revoke execute on function public.finalize_season_trophies(uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------
-- end_season(): เพิ่มการเรียก finalize_season_trophies ควบคู่กับ
-- distribute_season_rewards เดิม (ของเดิมยังอยู่ครบ ไม่แตะ)
-- ----------------------------------------------------------------
create or replace function public.end_season(p_season_id uuid)
returns void as $$
begin
  update public.marketplace_listings
  set status = 'cancelled'
  where season_id = p_season_id and status = 'active';

  perform public.distribute_season_rewards(p_season_id);
  perform public.finalize_season_trophies(p_season_id);

  update public.seasons
  set status = 'ended'
  where id = p_season_id;

  insert into public.season_notifications_log (season_id, notice_type)
  values (p_season_id, 'ended')
  on conflict (season_id, notice_type) do nothing;
end;
$$ language plpgsql security definer;


-- ================================================================
-- SECTION 7: Cron Schedule
-- ⚠️ ต้องเปิด extension pg_cron ผ่าน Supabase Dashboard ก่อนรันส่วนนี้
-- (เหมือนที่ 0014 ต้องการ) แยกกันทั้ง test project และ production
-- ================================================================

select cron.schedule(
  'recalc-adaptive-price-bands',
  '0 */6 * * *',
  $$select public.recalc_adaptive_price_bands()$$
);

select cron.schedule(
  'resolve-expeditions',
  '*/5 * * * *',
  $$select public.resolve_expeditions()$$
);

select cron.schedule(
  'apply-pending-faction-switches',
  '0 * * * *',
  $$select public.apply_pending_faction_switches()$$
);

select cron.schedule(
  'recalc-faction-balance',
  '0 0 * * 1', -- ทุกวันจันทร์ 00:00 UTC
  $$select public.recalc_faction_balance()$$
);
