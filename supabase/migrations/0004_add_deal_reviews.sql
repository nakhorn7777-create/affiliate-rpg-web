-- ============================================================
-- Deal reviews (eBay-style, per-transaction feedback) + fix for
-- deal_replies allowing replies after a deal has closed.
-- รันใน Supabase SQL Editor หลังจาก schema_v2.sql และ
-- 0001-0003 ถูก apply แล้ว
-- ============================================================

-- ------------------------------------------------------------
-- FIX: deal_replies ต้องรับได้เฉพาะตอนกระทู้ยัง 'open' เท่านั้น
-- เดิม insert policy เช็คแค่ auth.uid() = applicant_id ไม่ได้เช็ค
-- สถานะกระทู้เลย ทำให้ตอบกระทู้ที่ปิด/success ไปแล้วได้อยู่
-- ------------------------------------------------------------
drop policy if exists "deal_replies_self_insert" on public.deal_replies;

create policy "deal_replies_self_insert" on public.deal_replies
  for insert
  with check (
    auth.uid() = applicant_id
    and exists (
      select 1 from public.brand_deals
      where brand_deals.id = deal_replies.deal_id
        and brand_deals.status = 'open'
    )
  );

-- ------------------------------------------------------------
-- SECURITY FIX: accept_deal_reply / complete_deal เดิมรับ
-- p_actor_id เป็น parameter แล้วเชื่อตรงๆ โดยไม่เช็คกับ auth.uid()
-- เลย — client สามารถส่ง user id ของคนอื่นมาแอบอ้างเป็นเจ้าของ
-- ดีลได้ (IDOR) แก้โดยตัด parameter นี้ทิ้ง ใช้ auth.uid() ข้างใน
-- ฟังก์ชันแทนเสมอ (ยังไม่มีโค้ดฝั่งเว็บเรียกสองฟังก์ชันนี้เลย
-- ตอนนี้ เปลี่ยน signature ได้อย่างปลอดภัย ไม่กระทบอะไร)
-- ------------------------------------------------------------
drop function if exists public.accept_deal_reply(uuid, uuid);
drop function if exists public.complete_deal(uuid, uuid);

create or replace function public.accept_deal_reply(
  p_reply_id uuid
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
  if v_deal.posted_by <> auth.uid() then
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

create or replace function public.complete_deal(
  p_deal_id uuid
) returns void as $$
begin
  update public.brand_deals
  set status = 'completed', completed_at = now()
  where id = p_deal_id and posted_by = auth.uid() and status = 'open';

  if not found then
    raise exception 'ไม่สามารถปิดดีลนี้ได้ (ไม่ใช่เจ้าของ หรือดีลไม่ได้เปิดอยู่)';
  end if;
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------
-- DEAL_REVIEWS
-- รีวิวแบบ eBay: 1 สิทธิ์รีวิวต่อ (deal_id, reviewee_id) — ถ้ากระทู้
-- เดียวรับหลายคน (slots_total > 1) แต่ละคนที่ได้งานมีสิทธิ์รีวิว
-- แยกกัน ให้ดาว 1-2 ต้องใส่ comment บังคับ (ป้องกันกดแกล้งลอยๆ)
-- ทางเดียวเท่านั้น (เจ้าของกระทู้ → คนทำงาน) ในเฟสนี้
-- ------------------------------------------------------------
create table public.deal_reviews (
  id uuid primary key default uuid_generate_v4(),
  deal_id uuid not null references public.brand_deals(id) on delete cascade,
  reviewee_id uuid not null references public.profiles(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (deal_id, reviewee_id),
  check (rating >= 3 or (comment is not null and length(trim(comment)) > 0))
);

create index idx_deal_reviews_reviewee on public.deal_reviews(reviewee_id);

comment on table public.deal_reviews is 'รีวิวแบบ eBay ต่อดีล/ต่อคน เจ้าของกระทู้ให้คะแนนคนทำงานหลังปิดงานแล้ว insert ได้ผ่าน submit_deal_review() เท่านั้น';

alter table public.deal_reviews enable row level security;

-- ใครก็เห็นรีวิวบนโปรไฟล์คนอื่นได้ (public) — ไม่มี insert/update/delete
-- policy ให้ client เลย ทุกการเขียนผ่าน submit_deal_review() security
-- definer เท่านั้น และรีวิวแก้ไข/ลบไม่ได้หลังโพสต์ (immutable แบบ eBay)
create policy "deal_reviews_public_select" on public.deal_reviews
  for select using (true);

-- ------------------------------------------------------------
-- Function: เจ้าของกระทู้ส่งรีวิวให้คนที่ accept ไปแล้ว
-- เช็คครบ: เป็นเจ้าของกระทู้จริง, กระทู้ completed แล้ว, คนที่ถูก
-- รีวิวเคยถูก accept ในกระทู้นี้จริง, ดาว 1-2 ต้องมี comment
-- ------------------------------------------------------------
create or replace function public.submit_deal_review(
  p_deal_id uuid,
  p_reviewee_id uuid,
  p_rating smallint,
  p_comment text default null
) returns void as $$
declare
  v_deal record;
  v_has_accepted boolean;
begin
  if p_rating < 1 or p_rating > 5 then
    raise exception 'คะแนนต้องอยู่ระหว่าง 1-5 ดาว';
  end if;

  if p_rating <= 2 and (p_comment is null or length(trim(p_comment)) = 0) then
    raise exception 'กรุณาระบุเหตุผลเมื่อให้คะแนนต่ำกว่า 3 ดาว';
  end if;

  select * into v_deal from public.brand_deals where id = p_deal_id;
  if v_deal is null then
    raise exception 'ไม่พบกระทู้นี้';
  end if;

  if v_deal.posted_by <> auth.uid() then
    raise exception 'เฉพาะเจ้าของกระทู้เท่านั้นที่รีวิวได้';
  end if;

  if v_deal.status <> 'completed' then
    raise exception 'รีวิวได้หลังจากกระทู้ปิดงาน (completed) แล้วเท่านั้น';
  end if;

  select exists (
    select 1 from public.deal_replies
    where deal_id = p_deal_id
      and applicant_id = p_reviewee_id
      and status = 'accepted'
  ) into v_has_accepted;

  if not v_has_accepted then
    raise exception 'รีวิวได้เฉพาะคนที่ได้รับการ accept ในกระทู้นี้เท่านั้น';
  end if;

  insert into public.deal_reviews (deal_id, reviewee_id, reviewer_id, rating, comment)
  values (p_deal_id, p_reviewee_id, auth.uid(), p_rating, p_comment);
exception
  when unique_violation then
    raise exception 'คุณรีวิวคนนี้สำหรับกระทู้นี้ไปแล้ว';
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------
-- VIEW: สรุปคะแนนรีวิวต่อโปรไฟล์ สำหรับโชว์บนหน้าโปรไฟล์สาธารณะ
-- (avg rating, จำนวนรีวิว, % ดาว 4 ขึ้นไปแบบ "Positive Feedback")
-- deal_reviews เปิด public select อยู่แล้ว เลยไม่ต้อง security
-- definer เหมือน public_tier_badge
-- ------------------------------------------------------------
create view public.profile_review_summary as
select
  reviewee_id as profile_id,
  count(*)::int as review_count,
  round(avg(rating)::numeric, 2) as average_rating,
  round(100.0 * count(*) filter (where rating >= 4) / count(*), 1) as positive_pct
from public.deal_reviews
group by reviewee_id;

comment on view public.profile_review_summary is 'สรุปคะแนนรีวิวต่อโปรไฟล์ (avg/count/% positive) สำหรับโชว์บนหน้าโปรไฟล์สาธารณะ';
