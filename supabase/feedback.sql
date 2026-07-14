-- ============================================================
-- Feedback: in-app tester feedback (web + game)
-- รันใน Supabase SQL Editor หลังจาก schema_v2.sql ถูก apply แล้ว
-- ============================================================

create table public.feedback (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('web', 'game')),
  page_path text not null,
  message text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);

comment on table public.feedback is 'คอมเมนต์/บั๊กจาก tester ต้องล็อกอินก่อนถึงจะส่งได้ ไม่มี select policy ให้ client — เจ้าของเว็บอ่านผ่าน Supabase Studio (service role) เท่านั้น';

alter table public.feedback enable row level security;

create policy "feedback_owner_insert" on public.feedback
  for insert
  with check (auth.uid() = user_id);

-- ไม่มี select policy โดยเจตนา — ป้องกันไม่ให้ user คนอื่นอ่าน feedback กันเองได้
