-- ============================================================
-- Novice Academy Quest System
-- รันใน Supabase SQL Editor หลังจาก 0001-0007 ถูก apply แล้ว
--
-- ออกแบบให้ผูกกับ economy เดิมทั้งหมด ไม่สร้างระบบคู่ขนาน:
--   - reward เป็น game_stats.currency ตัวเดียวกับ follow/marketplace
--   - reward item ผ่าน player_inventory ตัวเดียวกับ marketplace
--   - ความคืบหน้าเควส "ถาวร" (ไม่ผูก season_id) ตามที่ตกลง — ทำครั้ง
--     เดียวตลอดชีพ ไม่ต้องทำซ้ำทุกซีซั่น
--   - แต่ currency/item ที่ได้ต้องฝากเข้า season ที่ active ตอน claim
--     เท่านั้น (เพราะ game_stats/player_inventory ผูก season_id โดย
--     ธรรมชาติของระบบเดิม) — ถ้าไม่มี season active ตอนนั้น จะยังไม่
--     แจก claim จะยังค้างรอจนกว่าจะมี season active แล้วเรียกใหม่
--   - Job Board ไม่ถูก gate ด้วย Academy (v1 = optional/parallel)
-- ============================================================

-- ------------------------------------------------------------
-- Seed: starter game_items สำหรับ item-reward ของเควสระดับ advanced
-- ใช้ deterministic uuid เพื่อให้ reference จาก academy_quests ได้แน่นอน
-- ------------------------------------------------------------
insert into public.game_items (id, item_key, name, description, item_type, is_tradeable)
values
  (
    '00000000-0000-0000-0000-000000000101',
    'novice_toolkit',
    'Novice Toolkit',
    'ของขวัญเริ่มต้นจาก Academy สำหรับคนที่ตั้งขายของในตลาดกลางครั้งแรก',
    'resource',
    true
  ),
  (
    '00000000-0000-0000-0000-000000000102',
    'first_deal_badge',
    'First Deal Badge',
    'ของขวัญเริ่มต้นจาก Academy สำหรับคนที่ตอบกระทู้งานจ้างครั้งแรก',
    'resource',
    true
  )
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- ACADEMY_QUESTS
-- master data แบบ fixed curated list จัดการผ่าน admin เท่านั้น (เหมือน
-- game_items/niche_tags) เงื่อนไขความสำเร็จของแต่ละเควส hardcode ไว้
-- ใน check_and_claim_academy_quests() ตาม quest_key ด้านล่าง
-- ------------------------------------------------------------
create table public.academy_quests (
  id uuid primary key default uuid_generate_v4(),
  quest_key text unique not null,
  title text not null,
  description text not null,
  sort_order int not null default 0,
  reward_currency bigint not null default 0 check (reward_currency >= 0),
  reward_item_id uuid references public.game_items(id),
  reward_item_quantity int not null default 0 check (reward_item_quantity >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.academy_quests is 'รายการเควส Novice Academy แบบ fixed curated list จัดการผ่าน admin เท่านั้น เงื่อนไขความสำเร็จ hardcode ไว้ใน check_and_claim_academy_quests() ตาม quest_key';

-- ------------------------------------------------------------
-- ACADEMY_QUEST_PROGRESS
-- ถาวร ไม่ผูก season_id ตามที่ตกลง — เขียนได้ผ่าน RPC เท่านั้น
-- ------------------------------------------------------------
create table public.academy_quest_progress (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  quest_id uuid not null references public.academy_quests(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (user_id, quest_id)
);

create index idx_academy_quest_progress_user on public.academy_quest_progress(user_id);

comment on table public.academy_quest_progress is 'ความคืบหน้า Academy แบบถาวร ไม่รีเซ็ตตาม season เขียนได้ผ่าน check_and_claim_academy_quests() เท่านั้น';

-- ------------------------------------------------------------
-- Seed: 7 เควสเริ่มต้น (ตัวเลข reward เป็น placeholder ปรับทีหลังได้
-- อิสระผ่าน update ตรงๆ บน academy_quests โดยไม่ต้องแก้โค้ด)
-- ------------------------------------------------------------
insert into public.academy_quests (quest_key, title, description, sort_order, reward_currency, reward_item_id, reward_item_quantity)
values
  ('login_3_days', 'เข้าเว็บให้ครบ 3 วัน', 'ล็อกอินสะสมให้ครบ 3 วันในซีซั่นนี้', 1, 10, null, 0),
  ('first_affiliate_link', 'เพิ่มลิงก์แรก', 'เพิ่มลิงก์ affiliate อย่างน้อย 1 ช่อง', 2, 10, null, 0),
  ('profile_theme_set', 'แต่งโปรไฟล์', 'ตั้งสีธีมและฟอนต์ของโปรไฟล์', 3, 10, null, 0),
  ('first_niche_tag', 'เลือก niche', 'ติด niche tag อย่างน้อย 1 อัน', 4, 10, null, 0),
  ('first_portfolio_item', 'อัปผลงานแรก', 'อัปโหลดภาพผลงานอย่างน้อย 1 ชิ้น', 5, 10, null, 0),
  ('first_marketplace_listing', 'ตั้งขายครั้งแรก', 'ตั้งขายไอเทมในตลาดกลางครั้งแรก', 6, 15, '00000000-0000-0000-0000-000000000101', 1),
  ('first_job_reply', 'สมัครงานแรก', 'ตอบกระทู้งานจ้างในกระดานงานจ้างครั้งแรก', 7, 15, '00000000-0000-0000-0000-000000000102', 1)
on conflict (quest_key) do nothing;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.academy_quests enable row level security;
alter table public.academy_quest_progress enable row level security;

create policy "academy_quests_public_select" on public.academy_quests
  for select using (true);
-- ไม่มี insert/update/delete policy — จัดการผ่าน admin (service role) เท่านั้น

create policy "academy_quest_progress_owner_select" on public.academy_quest_progress
  for select using (auth.uid() = user_id);
-- ไม่มี insert/update/delete policy — เขียนผ่าน RPC (security definer) เท่านั้น

-- ------------------------------------------------------------
-- Function: เช็คเงื่อนไขของทุกเควสที่ยังไม่ผ่าน แล้ว claim ให้อัตโนมัติ
-- เรียกจาก frontend ตอนโหลดหน้า (idempotent เรียกซ้ำได้ปลอดภัย)
--
-- หมายเหตุเรื่อง scope ของเงื่อนไข:
--   - login_3_days ต้องเช็คกับ total_login_days ของ season ที่ active
--     อยู่ตอนนี้เท่านั้น เพราะค่านี้เก็บแบบ per-season ในตัว game_stats
--     เอง (unique key คือ user_id+season_id) ไม่มีคอลัมน์ lifetime รวม
--     ให้เช็คได้ตรงๆ — สำหรับผู้เล่นใหม่ (กลุ่มเป้าหมายของ Academy)
--     season ปัจจุบันคือ season เดียวที่มีอยู่แล้วจึงไม่ต่างจาก lifetime
--   - เควสที่เหลือ (affiliate_links, niche_tags, portfolio_items,
--     marketplace_listings, deal_replies) เช็คแบบ lifetime ข้ามทุก
--     season ตามที่ยืนยัน (ไม่ filter season_id)
--
-- ถ้าไม่มี season active -> return ว่าง (no-op) เพราะไม่มีที่ฝาก currency
-- item reward: wrap ด้วย begin/exception เป็น sub-transaction แยก
-- ต่างหาก ถ้าเจอ validate_inventory_capacity_trigger ปัดตกเพราะคลังเต็ม
-- (หรือ error อื่นใดก็ตาม) จะ "ข้ามแบบเงียบ" เฉพาะ insert item นั้น
-- โดยไม่กระทบ currency ที่ให้ไปแล้วและ progress ที่ claim ไปแล้ว —
-- เป็นของขวัญเริ่มต้นครั้งเดียว ยอมข้าม cap ตรงนี้ได้ตามที่ตกลง
-- ------------------------------------------------------------
create or replace function public.check_and_claim_academy_quests()
returns table (
  quest_key text,
  title text,
  reward_currency bigint,
  reward_item_id uuid,
  reward_item_quantity int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_active_season uuid;
  v_quest record;
  v_satisfied boolean;
begin
  if v_user is null then
    raise exception 'ต้อง login ก่อน';
  end if;

  select id into v_active_season from public.seasons where status = 'active' limit 1;
  if v_active_season is null then
    return;
  end if;

  for v_quest in
    select q.*
    from public.academy_quests q
    where q.is_active
      and not exists (
        select 1 from public.academy_quest_progress p
        where p.user_id = v_user and p.quest_id = q.id
      )
    order by q.sort_order
  loop
    v_satisfied := case v_quest.quest_key
      when 'login_3_days' then exists (
        select 1 from public.game_stats gs
        where gs.user_id = v_user and gs.season_id = v_active_season
          and gs.total_login_days >= 3
      )
      when 'first_affiliate_link' then exists (
        select 1 from public.affiliate_links where user_id = v_user
      )
      when 'profile_theme_set' then exists (
        select 1 from public.profiles
        where id = v_user
          and theme_primary_color is not null
          and theme_font is not null
      )
      when 'first_niche_tag' then exists (
        select 1 from public.profile_niche_tags where profile_id = v_user
      )
      when 'first_portfolio_item' then exists (
        select 1 from public.portfolio_items where user_id = v_user
      )
      when 'first_marketplace_listing' then exists (
        select 1 from public.marketplace_listings where seller_id = v_user
      )
      when 'first_job_reply' then exists (
        select 1 from public.deal_replies where applicant_id = v_user
      )
      else false
    end;

    if v_satisfied then
      insert into public.academy_quest_progress (user_id, quest_id)
      values (v_user, v_quest.id);

      if v_quest.reward_currency > 0 then
        insert into public.game_stats (user_id, season_id, currency)
        values (v_user, v_active_season, v_quest.reward_currency)
        on conflict (user_id, season_id) do update
        set currency = public.game_stats.currency + v_quest.reward_currency;
      end if;

      if v_quest.reward_item_id is not null and v_quest.reward_item_quantity > 0 then
        begin
          insert into public.player_inventory (user_id, season_id, item_id, quantity)
          values (v_user, v_active_season, v_quest.reward_item_id, v_quest.reward_item_quantity)
          on conflict (user_id, season_id, item_id) do update
          set quantity = public.player_inventory.quantity + v_quest.reward_item_quantity;
        exception
          when others then
            -- คลังเต็ม (หรือเหตุอื่น) ไม่ให้กระทบ currency/progress ที่
            -- ให้ไปแล้วข้างบน แค่ของขวัญ item ไม่เข้าคลังรอบนี้เท่านั้น
            null;
        end;
      end if;

      quest_key := v_quest.quest_key;
      title := v_quest.title;
      reward_currency := v_quest.reward_currency;
      reward_item_id := v_quest.reward_item_id;
      reward_item_quantity := v_quest.reward_item_quantity;
      return next;
    end if;
  end loop;
end;
$$;

grant execute on function public.check_and_claim_academy_quests() to authenticated;
