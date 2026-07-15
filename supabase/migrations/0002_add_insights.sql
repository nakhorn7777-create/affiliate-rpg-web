-- ============================================================
-- Insights: self-reported daily platform performance (เฟส 1 = กรอกมือ)
-- รันใน Supabase SQL Editor หลังจาก schema_v2.sql ถูก apply แล้ว
-- แยกจากระบบเกมโดยเจตนา — ไม่มี trigger/RPC ใดผูกกับ game_stats.currency
-- หรือ season ranking เลย เพื่อกันการกรอกเลขมั่วเพื่อไต่อันดับในเกม
-- ============================================================

create table public.platform_content_stats (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('facebook', 'tiktok')),
  stat_date date not null,
  reach int check (reach >= 0),
  clicks int check (clicks >= 0),
  engagement int check (engagement >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, platform, stat_date)
);

comment on table public.platform_content_stats is 'สถิติ Facebook/TikTok รายวันที่ user กรอกเอง (เฟส 1) 1 แถวต่อคนต่อแพลตฟอร์มต่อวัน';

create table public.platform_commerce_stats (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('shopee', 'lazada')),
  stat_date date not null,
  clicks int check (clicks >= 0),
  orders int check (orders >= 0),
  revenue numeric(12, 2) check (revenue >= 0),
  commission numeric(12, 2) check (commission >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, platform, stat_date)
);

comment on table public.platform_commerce_stats is 'สถิติ Shopee/Lazada รายวันที่ user กรอกเอง (เฟส 1) 1 แถวต่อคนต่อแพลตฟอร์มต่อวัน';

alter table public.platform_content_stats enable row level security;
alter table public.platform_commerce_stats enable row level security;

-- ข้อมูลส่วนตัวจริง (ยอดขาย/สถิติ) — owner-only ทั้ง select/insert/update/delete
-- ไม่มี public select policy เลย ต่างจากตารางส่วนใหญ่ในระบบที่เปิดสาธารณะ

create policy "platform_content_stats_owner_select" on public.platform_content_stats
  for select using (auth.uid() = user_id);
create policy "platform_content_stats_owner_insert" on public.platform_content_stats
  for insert with check (auth.uid() = user_id);
create policy "platform_content_stats_owner_update" on public.platform_content_stats
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "platform_content_stats_owner_delete" on public.platform_content_stats
  for delete using (auth.uid() = user_id);

create policy "platform_commerce_stats_owner_select" on public.platform_commerce_stats
  for select using (auth.uid() = user_id);
create policy "platform_commerce_stats_owner_insert" on public.platform_commerce_stats
  for insert with check (auth.uid() = user_id);
create policy "platform_commerce_stats_owner_update" on public.platform_commerce_stats
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "platform_commerce_stats_owner_delete" on public.platform_commerce_stats
  for delete using (auth.uid() = user_id);
