-- ============================================================
-- 0018: Crafting Engine (async, category-based single-slot queue)
-- + Resource Barter Marketplace (5B, order-book with dynamic
-- coordinate fulfillment)
--
-- ⚠️ DRAFT — ยังไม่เคยรันกับ Supabase ที่ไหนเลย (เหมือน 0016/0017)
-- Dependency: รันหลัง 0000-0017 ถูก apply แล้วเท่านั้น
--
-- ขอบเขตที่เพิ่มนอกเหนือจากที่คุยกันไว้ (จำเป็นต่อ 5B ให้ทำงานได้จริง
-- แต่ยังไม่เคยมีการล็อกอัลกอริทึมละเอียด): ตำแหน่งพิกัดเมือง
-- (`player_town_location`) — 5B ต้องใช้ระยะทางจริงระหว่าง 2 เมือง
-- แต่ระบบยังไม่มีพิกัดผู้เล่นเลยสักตาราง จึงเพิ่ม assignment แบบสุ่ม
-- ง่ายๆ (random X,Y ในกรอบ -100..99 กันชนกันด้วย unique constraint)
-- ไว้ก่อน — เป็นรายละเอียดทาง engineering ไม่ใช่การตัดสินใจเชิง
-- เศรษฐกิจ/บาลานซ์ เปลี่ยนอัลกอริทึมทีหลังได้ง่ายไม่กระทบ schema อื่น
-- ============================================================

-- ================================================================
-- SECTION 1: Crafting Engine — async, category-based single-slot
-- (1 active order ต่อ category ต่อผู้เล่น, ข้าม category ทำคู่ขนานได้)
-- ================================================================

alter table public.crafting_recipes
  add column category text,
  add column craft_minutes_per_unit int check (craft_minutes_per_unit > 0);

comment on column public.crafting_recipes.category is
  'กลุ่มอาคารที่ใช้คราฟต์ (เช่น lumber_mill, brick_kiln) — 1 active order ต่อ category ต่อผู้เล่น บังคับผ่าน partial unique index บน crafting_orders';

insert into public.crafting_recipes (result_item_id, result_quantity, category, craft_minutes_per_unit, description)
select id, 1, 'lumber_mill', 2, 'แปรรูปไม้ดิบเป็นไม้แปรรูปสำหรับอัพเกรดอาคาร'
from public.game_items where item_key = 'processed_lumber'
on conflict do nothing;

insert into public.crafting_recipes (result_item_id, result_quantity, category, craft_minutes_per_unit, description)
select id, 1, 'brick_kiln', 2, 'เผาดินเป็นอิฐสำหรับอัพเกรดอาคาร'
from public.game_items where item_key = 'bricks'
on conflict do nothing;

insert into public.crafting_recipe_ingredients (recipe_id, item_id, quantity)
select r.id, i.id, 5
from public.crafting_recipes r, public.game_items i
where r.category = 'lumber_mill' and i.item_key = 'wood'
on conflict do nothing;

insert into public.crafting_recipe_ingredients (recipe_id, item_id, quantity)
select r.id, i.id, 1
from public.crafting_recipes r, public.game_items i
where r.category = 'lumber_mill' and i.item_key = 'provisions'
on conflict do nothing;

insert into public.crafting_recipe_ingredients (recipe_id, item_id, quantity)
select r.id, i.id, 5
from public.crafting_recipes r, public.game_items i
where r.category = 'brick_kiln' and i.item_key = 'clay'
on conflict do nothing;

insert into public.crafting_recipe_ingredients (recipe_id, item_id, quantity)
select r.id, i.id, 2
from public.crafting_recipes r, public.game_items i
where r.category = 'brick_kiln' and i.item_key = 'water'
on conflict do nothing;

insert into public.crafting_recipe_ingredients (recipe_id, item_id, quantity)
select r.id, i.id, 1
from public.crafting_recipes r, public.game_items i
where r.category = 'brick_kiln' and i.item_key = 'provisions'
on conflict do nothing;

-- ----------------------------------------------------------------
-- CRAFTING_ORDERS — คิว async ต่อผู้เล่น, บังคับ 1 active order ต่อ
-- category ด้วย partial unique index (pattern เดียวกับ
-- one_active_season_idx ใน baseline schema)
-- ----------------------------------------------------------------
create table public.crafting_orders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  recipe_id uuid not null references public.crafting_recipes(id) on delete cascade,
  category text not null,
  quantity bigint not null check (quantity > 0),
  started_at timestamptz not null default now(),
  ready_at timestamptz not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'collected')),
  collected_at timestamptz
);

create unique index one_active_order_per_category_idx
  on public.crafting_orders (user_id, season_id, category)
  where status = 'in_progress';

create index idx_crafting_orders_pending
  on public.crafting_orders (status, ready_at) where status = 'in_progress';

comment on table public.crafting_orders is
  'คิว craft async ต่อผู้เล่น — 1 active order ต่อ category (ล็อกด้วย one_active_order_per_category_idx) resolve ผ่าน resolve_crafting() (cron) เท่านั้น ไม่ต้องกด collect เอง';

-- ----------------------------------------------------------------
-- Function: craft_item(p_recipe_id, p_quantity) — auth.uid() ภายใน
-- เช็ค 1) ไม่มี active order ค้างใน category เดียวกัน 2) วัตถุดิบครบ
-- ทุกชนิด (all-or-nothing) ก่อนหักจริง แล้วหักคูณ p_quantity
-- ----------------------------------------------------------------
create or replace function public.craft_item(p_recipe_id uuid, p_quantity bigint)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season_id uuid;
  v_recipe record;
  v_ingredient record;
  v_missing boolean := false;
  v_order_id uuid;
begin
  if auth.uid() is null then
    raise exception 'ต้อง login ก่อน';
  end if;

  if p_quantity <= 0 then
    raise exception 'จำนวนต้องมากกว่า 0';
  end if;

  select id into v_season_id from public.seasons where status = 'active' limit 1;
  if v_season_id is null then
    raise exception 'ไม่มี season ที่ active อยู่ตอนนี้';
  end if;

  select * into v_recipe from public.crafting_recipes where id = p_recipe_id;
  if v_recipe is null or v_recipe.category is null then
    raise exception 'ไม่พบสูตรที่ระบุ';
  end if;

  if exists (
    select 1 from public.crafting_orders
    where user_id = auth.uid() and season_id = v_season_id
      and category = v_recipe.category and status = 'in_progress'
  ) then
    raise exception 'มี order ค้างอยู่แล้วในหมวด % ต้องรอให้เสร็จก่อน', v_recipe.category;
  end if;

  for v_ingredient in
    select item_id, quantity from public.crafting_recipe_ingredients where recipe_id = p_recipe_id
  loop
    if not exists (
      select 1 from public.player_inventory
      where user_id = auth.uid() and season_id = v_season_id
        and item_id = v_ingredient.item_id and quantity >= v_ingredient.quantity * p_quantity
    ) then
      v_missing := true;
      exit;
    end if;
  end loop;

  if v_missing then
    raise exception 'วัตถุดิบไม่พอสำหรับคราฟต์ % หน่วย', p_quantity;
  end if;

  for v_ingredient in
    select item_id, quantity from public.crafting_recipe_ingredients where recipe_id = p_recipe_id
  loop
    update public.player_inventory
    set quantity = quantity - (v_ingredient.quantity * p_quantity)
    where user_id = auth.uid() and season_id = v_season_id and item_id = v_ingredient.item_id;
  end loop;

  insert into public.crafting_orders (user_id, season_id, recipe_id, category, quantity, ready_at)
  values (
    auth.uid(), v_season_id, p_recipe_id, v_recipe.category, p_quantity,
    now() + (p_quantity * v_recipe.craft_minutes_per_unit || ' minutes')::interval
  )
  returning id into v_order_id;

  return v_order_id;
end;
$$;

grant execute on function public.craft_item(uuid, bigint) to authenticated;

-- ----------------------------------------------------------------
-- Function: resolve_crafting() — cron ทุก 1 นาที (craft time สั้นสุด
-- 2 นาที/หน่วย ต้องเช็คถี่พอสมควร) เครดิตผลลัพธ์เข้า player_inventory
-- อัตโนมัติ ไม่ต้องมี RPC "collect" แยก (ตาม pattern resolve_expeditions)
-- ----------------------------------------------------------------
create or replace function public.resolve_crafting()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_recipe record;
begin
  for v_order in
    select * from public.crafting_orders
    where status = 'in_progress' and ready_at <= now()
    for update
  loop
    select * into v_recipe from public.crafting_recipes where id = v_order.recipe_id;

    insert into public.player_inventory (user_id, season_id, item_id, quantity)
    values (v_order.user_id, v_order.season_id, v_recipe.result_item_id, v_recipe.result_quantity * v_order.quantity)
    on conflict (user_id, season_id, item_id)
    do update set quantity = public.player_inventory.quantity + (v_recipe.result_quantity * v_order.quantity);

    update public.crafting_orders
    set status = 'collected', collected_at = now()
    where id = v_order.id;
  end loop;
end;
$$;

revoke execute on function public.resolve_crafting() from public, anon, authenticated;


-- ================================================================
-- SECTION 2: Player Town Location — พิกัดโลกที่ 5B ต้องใช้คำนวณ
-- ระยะทางจริง (ยังไม่เคยมีตารางนี้มาก่อน จำเป็นสำหรับ 5B โดยตรง)
-- ================================================================

create table public.player_town_location (
  user_id uuid not null references public.profiles(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  x int not null,
  y int not null,
  assigned_at timestamptz not null default now(),
  primary key (user_id, season_id),
  unique (season_id, x, y)
);

comment on table public.player_town_location is
  'พิกัดเมืองต่อผู้เล่น/season สุ่มตอนแรกที่ต้องใช้ (ensure_town_location) ในกรอบ -100..99 กันชนกันด้วย unique(season_id,x,y) — เป็น placeholder algorithm ปรับได้ทีหลังไม่กระทบ schema';

create or replace function public.ensure_town_location()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season_id uuid;
  v_x int;
  v_y int;
  v_attempts int := 0;
begin
  if auth.uid() is null then
    return;
  end if;

  select id into v_season_id from public.seasons where status = 'active' limit 1;
  if v_season_id is null then
    return;
  end if;

  if exists (
    select 1 from public.player_town_location where user_id = auth.uid() and season_id = v_season_id
  ) then
    return;
  end if;

  loop
    v_x := floor(random() * 200 - 100)::int;
    v_y := floor(random() * 200 - 100)::int;
    begin
      insert into public.player_town_location (user_id, season_id, x, y)
      values (auth.uid(), v_season_id, v_x, v_y);
      return;
    exception when unique_violation then
      v_attempts := v_attempts + 1;
      if v_attempts > 20 then
        raise exception 'ไม่สามารถหาพิกัดเมืองว่างได้ ลองใหม่อีกครั้ง';
      end if;
    end;
  end loop;
end;
$$;

grant execute on function public.ensure_town_location() to authenticated;


-- ================================================================
-- SECTION 3: Resource Barter Marketplace (5B) — Public Order-Book
-- with Dynamic Coordinate Fulfillment (ยืนยันแล้ว 2026-07-22)
-- ================================================================

create table public.barter_offers (
  id uuid primary key default uuid_generate_v4(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  offered_item_id uuid not null references public.game_items(id) on delete cascade,
  offered_quantity bigint not null check (offered_quantity > 0),
  requested_item_id uuid not null references public.game_items(id) on delete cascade,
  requested_quantity bigint not null check (requested_quantity > 0),
  status text not null default 'active' check (status in ('active', 'fulfilled', 'cancelled')),
  created_at timestamptz not null default now(),
  constraint distinct_barter_items check (offered_item_id <> requested_item_id)
);

create index idx_barter_offers_active on public.barter_offers(season_id, status) where status = 'active';

comment on table public.barter_offers is
  '5B order-book: offer สาธารณะ commodity-for-commodity ล้วน ไม่มี token เกี่ยวข้อง — offered_quantity/requested_quantity ลดลงเรื่อยๆ ตอน accept แบบ partial ได้ (เหมือน marketplace_listings.quantity)';

-- ----------------------------------------------------------------
-- Trigger: ตรวจ ratio ตอนตั้ง offer เทียบ adaptive_ratio_bands (ยังไม่
-- มี recalc function จริงใน 0017 — ถ้ายังไม่มี band แถวไหนเลย ยึด
-- default 1:3 ถึง 3:1 ที่ยืนยันไว้ตรงๆ) + reserve offered_quantity
-- ออกจาก player_inventory ทันที (เหมือน reserve_inventory_on_listing)
-- ----------------------------------------------------------------
create or replace function public.validate_and_reserve_barter_offer()
returns trigger as $$
declare
  v_band record;
  v_ratio numeric;
begin
  v_ratio := new.requested_quantity::numeric / new.offered_quantity;

  select * into v_band
  from public.adaptive_ratio_bands
  where item_a_id = new.offered_item_id and item_b_id = new.requested_item_id
    and season_id = new.season_id
  order by window_end desc
  limit 1;

  if v_band is not null then
    if v_ratio < v_band.min_ratio or v_ratio > v_band.max_ratio then
      raise exception 'อัตราแลกเปลี่ยนต้องอยู่ในเพดานปัจจุบัน (% ถึง %)', v_band.min_ratio, v_band.max_ratio;
    end if;
  else
    if v_ratio < (1.0 / 3.0) or v_ratio > 3.0 then
      raise exception 'อัตราแลกเปลี่ยนต้องอยู่ระหว่าง 1:3 ถึง 3:1';
    end if;
  end if;

  update public.player_inventory
  set quantity = quantity - new.offered_quantity
  where user_id = new.seller_id
    and season_id = new.season_id
    and item_id = new.offered_item_id
    and quantity >= new.offered_quantity;

  if not found then
    raise exception 'ไอเทมในคลังไม่พอสำหรับตั้ง offer นี้';
  end if;

  return new;
end;
$$ language plpgsql;

create trigger validate_and_reserve_barter_offer_trigger
  before insert on public.barter_offers
  for each row execute function public.validate_and_reserve_barter_offer();

-- ----------------------------------------------------------------
-- Function: create_barter_offer — auth.uid() = seller เสมอ
-- ----------------------------------------------------------------
create or replace function public.create_barter_offer(
  p_offered_item_id uuid,
  p_offered_quantity bigint,
  p_requested_item_id uuid,
  p_requested_quantity bigint
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season_id uuid;
  v_offer_id uuid;
begin
  if auth.uid() is null then
    raise exception 'ต้อง login ก่อน';
  end if;

  perform public.ensure_town_location();

  select id into v_season_id from public.seasons where status = 'active' limit 1;
  if v_season_id is null then
    raise exception 'ไม่มี season ที่ active อยู่ตอนนี้';
  end if;

  insert into public.barter_offers (seller_id, season_id, offered_item_id, offered_quantity, requested_item_id, requested_quantity)
  values (auth.uid(), v_season_id, p_offered_item_id, p_offered_quantity, p_requested_item_id, p_requested_quantity)
  returning id into v_offer_id;

  return v_offer_id;
end;
$$;

grant execute on function public.create_barter_offer(uuid, bigint, uuid, bigint) to authenticated;

create or replace function public.cancel_barter_offer(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer record;
begin
  if auth.uid() is null then
    raise exception 'ต้อง login ก่อน';
  end if;

  select * into v_offer from public.barter_offers where id = p_offer_id for update;

  if v_offer is null or v_offer.seller_id <> auth.uid() then
    raise exception 'ไม่พบ offer หรือไม่ใช่เจ้าของ';
  end if;

  if v_offer.status <> 'active' then
    raise exception 'offer นี้ไม่ active แล้ว';
  end if;

  update public.barter_offers set status = 'cancelled' where id = p_offer_id;

  insert into public.player_inventory (user_id, season_id, item_id, quantity)
  values (v_offer.seller_id, v_offer.season_id, v_offer.offered_item_id, v_offer.offered_quantity)
  on conflict (user_id, season_id, item_id)
  do update set quantity = public.player_inventory.quantity + v_offer.offered_quantity;
end;
$$;

grant execute on function public.cancel_barter_offer(uuid) to authenticated;

-- ----------------------------------------------------------------
-- BARTER_DISPATCHES — merchant cart ระหว่างทาง (accepter เป็นคนส่ง
-- cart เสมอตามที่ยืนยัน 2026-07-22) capacity_used = MAX(offered,
-- requested) ของ dispatch นี้ ผูกกับ merchant capacity ที่ "ใช้ไปแล้ว"
-- ของ accepter (SUM ของ dispatch สถานะ traveling ทั้งหมด)
-- ----------------------------------------------------------------
create table public.barter_dispatches (
  id uuid primary key default uuid_generate_v4(),
  offer_id uuid not null references public.barter_offers(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  accepter_id uuid not null references public.profiles(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  offered_item_id uuid not null references public.game_items(id),
  offered_quantity bigint not null check (offered_quantity > 0),
  requested_item_id uuid not null references public.game_items(id),
  requested_quantity bigint not null check (requested_quantity > 0),
  capacity_used bigint not null check (capacity_used > 0),
  departed_at timestamptz not null default now(),
  arrival_time timestamptz not null,
  resolved_at timestamptz,
  status text not null default 'traveling' check (status in ('traveling', 'resolved'))
);

create index idx_barter_dispatches_pending on public.barter_dispatches(status, arrival_time) where status = 'traveling';
create index idx_barter_dispatches_accepter_busy on public.barter_dispatches(accepter_id, status) where status = 'traveling';

comment on table public.barter_dispatches is
  'merchant cart ที่กำลังเดินทาง (accepter ส่งไปหา seller เสมอ) resolve อัตโนมัติผ่าน resolve_barter_dispatches() (cron) เมื่อถึง arrival_time';

-- ----------------------------------------------------------------
-- Function: accept_barter_offer — auth.uid() = accepter เสมอ
-- คำนวณ partial fulfillment แบบสัดส่วน (ceil ฝั่งที่ accepter ต้อง
-- จ่าย กัน rounding เอาเปรียบ seller สะสมจาก accept หลายครั้งย่อยๆ)
-- เช็ค merchant capacity ที่เหลือจริง (เพดานรวม - ที่ใช้ไปแล้ว)
-- คำนวณระยะทางจริงจาก player_town_location ทั้งสองฝ่าย
-- ----------------------------------------------------------------
create or replace function public.accept_barter_offer(p_offer_id uuid, p_accept_offered_quantity bigint)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer record;
  v_requested_amount bigint;
  v_capacity_needed bigint;
  v_max_capacity bigint;
  v_busy_capacity bigint;
  v_seller_loc record;
  v_accepter_loc record;
  v_distance numeric;
  v_speed numeric;
  v_travel_hours numeric;
  v_dispatch_id uuid;
begin
  if auth.uid() is null then
    raise exception 'ต้อง login ก่อน';
  end if;

  if p_accept_offered_quantity <= 0 then
    raise exception 'จำนวนต้องมากกว่า 0';
  end if;

  perform public.ensure_town_location();

  select * into v_offer from public.barter_offers where id = p_offer_id for update;

  if v_offer is null or v_offer.status <> 'active' then
    raise exception 'offer นี้ไม่พร้อมรับแล้ว';
  end if;

  if v_offer.seller_id = auth.uid() then
    raise exception 'ไม่สามารถ accept offer ของตัวเองได้';
  end if;

  if p_accept_offered_quantity > v_offer.offered_quantity then
    raise exception 'offer เหลือไม่พอ (เหลือ % หน่วย)', v_offer.offered_quantity;
  end if;

  -- ปัดขึ้นเสมอฝั่งที่ accepter ต้องจ่าย กัน dust-attack ปัดเศษเอาเปรียบ
  -- seller สะสมจากการ accept ทีละก้อนเล็กๆ ซ้ำหลายรอบ
  v_requested_amount := ceil(p_accept_offered_quantity::numeric * v_offer.requested_quantity / v_offer.offered_quantity);
  v_capacity_needed := greatest(p_accept_offered_quantity, v_requested_amount);

  select max_total_capacity into v_max_capacity from public.get_marketplace_building_status();
  v_max_capacity := coalesce(v_max_capacity, 0);

  select coalesce(sum(capacity_used), 0) into v_busy_capacity
  from public.barter_dispatches
  where accepter_id = auth.uid() and status = 'traveling';

  if v_max_capacity - v_busy_capacity < v_capacity_needed then
    raise exception 'merchant ไม่พอ (ใช้ไปแล้ว % จากทั้งหมด % ความจุ ต้องการ %)',
      v_busy_capacity, v_max_capacity, v_capacity_needed;
  end if;

  update public.player_inventory
  set quantity = quantity - v_requested_amount
  where user_id = auth.uid()
    and season_id = v_offer.season_id
    and item_id = v_offer.requested_item_id
    and quantity >= v_requested_amount;

  if not found then
    raise exception 'ไอเทมที่ต้องจ่ายไม่พอ (ต้องการ % หน่วย)', v_requested_amount;
  end if;

  select x, y into v_seller_loc from public.player_town_location
  where user_id = v_offer.seller_id and season_id = v_offer.season_id;
  select x, y into v_accepter_loc from public.player_town_location
  where user_id = auth.uid() and season_id = v_offer.season_id;

  v_distance := sqrt(power(v_seller_loc.x - v_accepter_loc.x, 2) + power(v_seller_loc.y - v_accepter_loc.y, 2));

  select value into v_speed from public.game_constants where key = 'merchant_base_speed_tiles_per_hour';
  v_travel_hours := v_distance / v_speed;

  insert into public.barter_dispatches (
    offer_id, seller_id, accepter_id, season_id,
    offered_item_id, offered_quantity, requested_item_id, requested_quantity,
    capacity_used, arrival_time
  ) values (
    p_offer_id, v_offer.seller_id, auth.uid(), v_offer.season_id,
    v_offer.offered_item_id, p_accept_offered_quantity, v_offer.requested_item_id, v_requested_amount,
    v_capacity_needed, now() + (v_travel_hours || ' hours')::interval
  )
  returning id into v_dispatch_id;

  update public.barter_offers
  set offered_quantity = offered_quantity - p_accept_offered_quantity,
      requested_quantity = requested_quantity - v_requested_amount,
      status = case when offered_quantity - p_accept_offered_quantity <= 0 then 'fulfilled' else status end
  where id = p_offer_id;

  return v_dispatch_id;
end;
$$;

grant execute on function public.accept_barter_offer(uuid, bigint) to authenticated;

-- ----------------------------------------------------------------
-- Function: resolve_barter_dispatches() — cron ทุก 5 นาที ส่งของถึง
-- ปลายทางจริง: accepter ได้ offered_item (ของที่มาส่งถึงบ้าน),
-- seller ได้ requested_item (เงิน/ของที่ accepter จ่ายมา)
-- ----------------------------------------------------------------
create or replace function public.resolve_barter_dispatches()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dispatch record;
begin
  for v_dispatch in
    select * from public.barter_dispatches
    where status = 'traveling' and arrival_time <= now()
    for update
  loop
    insert into public.player_inventory (user_id, season_id, item_id, quantity)
    values (v_dispatch.accepter_id, v_dispatch.season_id, v_dispatch.offered_item_id, v_dispatch.offered_quantity)
    on conflict (user_id, season_id, item_id)
    do update set quantity = public.player_inventory.quantity + v_dispatch.offered_quantity;

    insert into public.player_inventory (user_id, season_id, item_id, quantity)
    values (v_dispatch.seller_id, v_dispatch.season_id, v_dispatch.requested_item_id, v_dispatch.requested_quantity)
    on conflict (user_id, season_id, item_id)
    do update set quantity = public.player_inventory.quantity + v_dispatch.requested_quantity;

    update public.barter_dispatches
    set status = 'resolved', resolved_at = now()
    where id = v_dispatch.id;
  end loop;
end;
$$;

revoke execute on function public.resolve_barter_dispatches() from public, anon, authenticated;


-- ================================================================
-- SECTION 4: RLS
-- ================================================================

alter table public.crafting_orders enable row level security;
create policy "crafting_orders_owner_select" on public.crafting_orders
  for select using (auth.uid() = user_id);

alter table public.player_town_location enable row level security;
create policy "player_town_location_public_select" on public.player_town_location
  for select using (true);
-- public select ตั้งใจ: ต้องเห็นพิกัดเมืองคนอื่นถึงจะโพสต์/accept barter offer ข้ามเมืองได้

alter table public.barter_offers enable row level security;
create policy "barter_offers_public_select" on public.barter_offers
  for select using (true);
-- ไม่มี insert/update/delete policy ให้ client เลย เขียนผ่าน
-- create_barter_offer/cancel_barter_offer/accept_barter_offer (security definer) เท่านั้น

alter table public.barter_dispatches enable row level security;
create policy "barter_dispatches_participant_select" on public.barter_dispatches
  for select using (auth.uid() = seller_id or auth.uid() = accepter_id);


-- ================================================================
-- SECTION 5: Cron Schedule
-- ================================================================

select cron.schedule(
  'resolve-crafting',
  '* * * * *',
  $$select public.resolve_crafting()$$
);

select cron.schedule(
  'resolve-barter-dispatches',
  '*/5 * * * *',
  $$select public.resolve_barter_dispatches()$$
);
