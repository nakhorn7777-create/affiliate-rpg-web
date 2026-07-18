-- ============================================================
-- Rate Limiting: กัน spam การโพสต์งานจ้าง/สมัครงาน
-- รันใน Supabase SQL Editor หลังจาก 0001-0012 ถูก apply แล้ว
--
-- Scope แคบตั้งใจ: เฉพาะ brand_deals insert กับ deal_replies insert
-- เท่านั้น เพราะ 2 จุดนี้ไม่มี cap ธรรมชาติมาก่อนเลย (ต่างจาก
-- marketplace_listings/affiliate_links ที่มี slot cap กันสแปมในตัว
-- อยู่แล้ว) RPC อื่นๆ (accept/reject/complete/cancel) ยังไม่ทำตอนนี้
--
-- กลไก: ใช้ BEFORE INSERT trigger แทน RPC เพราะ brand_deals/deal_replies
-- เขียนผ่าน .insert() ตรงจาก client (RLS-gated) มาตั้งแต่แรก ไม่มี RPC
-- ให้ฝัง logic — วิธีนี้ไม่ต้องแก้โค้ด frontend เลยสักบรรทัด
--
-- Next.js middleware ทำแบบนี้ไม่ได้เลย เพราะ client เรายิง
-- supabase.rpc()/.from() ตรงไปที่ Supabase API ไม่ผ่าน server เราก่อน
-- ============================================================

-- ------------------------------------------------------------
-- 1. RATE_LIMIT_HITS
-- ปิดสนิท ไม่มี select/insert/update/delete policy ให้ client เลย
-- เขียนได้ผ่าน enforce_rate_limit() (security definer) เท่านั้น
-- ------------------------------------------------------------
create table public.rate_limit_hits (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (action in ('post_deal', 'post_reply')),
  created_at timestamptz not null default now()
);

create index idx_rate_limit_hits_lookup on public.rate_limit_hits(user_id, action, created_at);

comment on table public.rate_limit_hits is 'บันทึกทุกครั้งที่ผ่าน rate limit check สำเร็จ ใช้คำนวณจำนวนครั้งในช่วงเวลาย้อนหลัง ปิดสนิทไม่มี policy ให้ client เลย';

alter table public.rate_limit_hits enable row level security;
-- ตั้งใจไม่เขียน policy ใดๆ เลย (RLS enabled + ไม่มี policy = deny ทั้งหมด)

-- ------------------------------------------------------------
-- 2. Function: เช็ค + บันทึกการทำรายการในคำเดียว (atomic เพราะ trigger
-- ที่เรียกมันรันอยู่ใน transaction เดียวกับ insert จริง — ถ้า insert
-- จริงพังทีหลังด้วยเหตุอื่น แถวที่บันทึกไว้ตรงนี้จะ rollback ไปด้วย
-- อัตโนมัติ ไม่มีทาง "ค้าง" นับผิดเพี้ยน)
-- ------------------------------------------------------------
create or replace function public.enforce_rate_limit(
  p_action text,
  p_max_count int,
  p_window interval
) returns void as $$
declare
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'ต้อง login ก่อน';
  end if;

  select count(*) into v_count
  from public.rate_limit_hits
  where user_id = auth.uid()
    and action = p_action
    and created_at > now() - p_window;

  if v_count >= p_max_count then
    raise exception 'ทำรายการบ่อยเกินไป กรุณาลองใหม่ภายหลัง';
  end if;

  insert into public.rate_limit_hits (user_id, action) values (auth.uid(), p_action);
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------
-- 3. brand_deals: จำกัด 5 โพสต์/ชั่วโมง/user
-- ------------------------------------------------------------
create or replace function public.rate_limit_brand_deals()
returns trigger as $$
begin
  perform public.enforce_rate_limit('post_deal', 5, interval '1 hour');
  return new;
end;
$$ language plpgsql security definer;

create trigger rate_limit_brand_deals_trigger
  before insert on public.brand_deals
  for each row execute function public.rate_limit_brand_deals();

-- ------------------------------------------------------------
-- 4. deal_replies: จำกัด 20 ครั้ง/ชั่วโมง/user
-- ------------------------------------------------------------
create or replace function public.rate_limit_deal_replies()
returns trigger as $$
begin
  perform public.enforce_rate_limit('post_reply', 20, interval '1 hour');
  return new;
end;
$$ language plpgsql security definer;

create trigger rate_limit_deal_replies_trigger
  before insert on public.deal_replies
  for each row execute function public.rate_limit_deal_replies();
