-- ============================================================
-- Job Board Lifecycle Gaps: brand toggle, reject applicant, cancel deal
-- รันใน Supabase SQL Editor หลังจาก 0001-0008 ถูก apply แล้ว
--
-- has_brand เป็น free toggle ไม่ใช่ account type แยก — ทุกคนเล่นเกม/
-- Academy/สลับมาโพสต์งานแบบ Brand ได้เหมือนกันหมด RLS เดิมของ profiles
-- (profiles_owner_update) อนุญาตให้เจ้าของแก้ has_brand ตรงๆ อยู่แล้ว
-- toggle_brand_status() จึงเป็นแค่ convenience layer (atomic flip, กัน
-- client ใช้ค่าเก่าค้าง) ไม่ใช่ security fix
--
-- reject_deal_reply / cancel_brand_deal จำเป็นต้องเป็น RPC จริง เพราะ
-- deal_replies/brand_deals ไม่มี update policy ให้ client เลย (ตั้งใจ
-- ตั้งแต่ 0004 ให้เปลี่ยน status ผ่าน RPC security definer เท่านั้น)
-- ============================================================

-- ------------------------------------------------------------
-- 1. Brand toggle: สลับ has_brand ของตัวเองแบบ atomic
-- ------------------------------------------------------------
create or replace function public.toggle_brand_status()
returns boolean as $$
declare
  v_new_status boolean;
begin
  if auth.uid() is null then
    raise exception 'ต้อง login ก่อน';
  end if;

  update public.profiles
  set has_brand = not has_brand
  where id = auth.uid()
  returning has_brand into v_new_status;

  if not found then
    raise exception 'ไม่พบโปรไฟล์ผู้ใช้นี้';
  end if;

  return v_new_status;
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------
-- 2. Reject applicant: เจ้าของดีล reject ได้เฉพาะ reply ที่ยัง
-- 'pending' เท่านั้น (ไม่ให้ "ถอนการ accept" ทีหลัง — คนละ flow กัน
-- ต้องคืน slot ด้วยถ้าจะทำ ยังไม่รองรับตอนนี้) ไม่กระทบ slots_total
-- เพราะ pending ไม่เคยกินโควตาอยู่แล้ว
-- ------------------------------------------------------------
create or replace function public.reject_deal_reply(
  p_reply_id uuid
) returns void as $$
declare
  v_reply record;
  v_deal record;
begin
  select * into v_reply from public.deal_replies where id = p_reply_id for update;
  if v_reply is null then
    raise exception 'ไม่พบคำตอบนี้';
  end if;

  select * into v_deal from public.brand_deals where id = v_reply.deal_id;
  if v_deal.posted_by <> auth.uid() then
    raise exception 'เฉพาะเจ้าของดีลเท่านั้นที่ reject ได้';
  end if;

  if v_reply.status <> 'pending' then
    raise exception 'คำตอบนี้ถูกดำเนินการไปแล้ว ไม่สามารถ reject ได้';
  end if;

  update public.deal_replies set status = 'rejected' where id = p_reply_id;
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------
-- 3. Cancel deal: เจ้าของดีลยกเลิกโพสต์ที่ยัง 'open' อยู่ (mirror
-- complete_deal เป๊ะ ต่างแค่ status ปลายทาง) reply ที่ค้างเป็น
-- 'pending' ไม่ auto-reject ให้ — ปล่อยค้างสถานะเดิม เพราะ UI จะซ่อน
-- ปุ่ม accept/reject เองอยู่แล้วเมื่อ deal.status <> 'open'
-- ------------------------------------------------------------
create or replace function public.cancel_brand_deal(
  p_deal_id uuid
) returns void as $$
begin
  update public.brand_deals
  set status = 'cancelled'
  where id = p_deal_id and posted_by = auth.uid() and status = 'open';

  if not found then
    raise exception 'ไม่สามารถยกเลิกดีลนี้ได้ (ไม่ใช่เจ้าของ หรือดีลไม่ได้เปิดอยู่)';
  end if;
end;
$$ language plpgsql security definer;
