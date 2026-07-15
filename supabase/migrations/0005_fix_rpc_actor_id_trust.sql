-- ============================================================
-- Security fix: RPCs trusting a client-passed user/actor id
-- รันใน Supabase SQL Editor หลังจาก 0001-0004 ถูก apply แล้ว
--
-- record_daily_login, subscribe_player, redeem_subscription_code,
-- purchase_from_listing เดิมรับ user id เป็น parameter แล้วเชื่อ
-- ตรงๆ โดยไม่เช็คกับ auth.uid() เลย — client (หรือใครก็ตามที่ยิง
-- Supabase RPC endpoint ตรงๆ ด้วย JWT ของตัวเอง) ใส่ user id ของ
-- คนอื่นแทนได้ทั้งหมด ที่ร้ายแรงสุดคือ purchase_from_listing ที่
-- เปิดช่องให้ตั้ง listing ขายของแล้วบังคับหักเงินจากบัญชีคนอื่นมา
-- เข้าบัญชีตัวเองได้ตรงๆ (ขโมย token) แก้โดยตัด parameter user id
-- ทิ้งทั้งหมด ใช้ auth.uid() ข้างในฟังก์ชันแทนเสมอ
--
-- Call site เดียวที่ต้องอัพเดตฝั่งเว็บคือ record_daily_login ใน
-- src/app/game/page.tsx — อีก 3 ฟังก์ชันยังไม่มี UI เรียกใช้เลย
-- ============================================================

drop function if exists public.record_daily_login(uuid, uuid);
drop function if exists public.subscribe_player(uuid, uuid);
drop function if exists public.redeem_subscription_code(text, uuid, uuid);
drop function if exists public.purchase_from_listing(uuid, uuid, bigint);

create or replace function public.record_daily_login(p_season_id uuid)
returns void as $$
begin
  insert into public.game_stats (user_id, season_id, total_login_days, last_login_date)
  values (auth.uid(), p_season_id, 1, current_date)
  on conflict (user_id, season_id) do update
  set total_login_days = public.game_stats.total_login_days + 1,
      last_login_date = current_date
  where public.game_stats.last_login_date is distinct from current_date;
end;
$$ language plpgsql security definer;

create or replace function public.subscribe_player(p_season_id uuid)
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
  values (auth.uid(), p_season_id, true, now(), v_season_ends_at)
  on conflict (user_id, season_id) do update
  set is_subscribed = true,
      subscription_started_at = now(),
      subscription_expires_at = v_season_ends_at;
end;
$$ language plpgsql security definer;

create or replace function public.redeem_subscription_code(
  p_code text,
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
  set is_used = true, used_by = auth.uid(), used_at = now()
  where id = v_code.id;

  perform public.subscribe_player(p_season_id);
end;
$$ language plpgsql security definer;

create or replace function public.purchase_from_listing(
  p_listing_id uuid,
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

  if v_listing.seller_id = auth.uid() then
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
  where user_id = auth.uid()
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
  values (auth.uid(), v_listing.season_id, v_listing.item_id, p_quantity)
  on conflict (user_id, season_id, item_id)
  do update set quantity = public.player_inventory.quantity + p_quantity;

  insert into public.marketplace_transactions (listing_id, buyer_id, quantity, total_price)
  values (p_listing_id, auth.uid(), p_quantity, v_total_price);

  perform public.recalc_price_band(v_listing.item_id, v_listing.season_id);
end;
$$ language plpgsql security definer;
