-- ============================================================
-- Admin Audit Trail: log every admin brand-review action
-- รันใน Supabase SQL Editor หลังจาก 0001-0011 ถูก apply แล้ว
--
-- Scope แคบตั้งใจ: เฉพาะ admin_mark_brand_processing/admin_reject_brand
-- เท่านั้น (ไม่รวม deal accept/reject ที่เป็น action ของ user ทั่วไป
-- นั่นเป็นระบบ business event log คนละอันที่ยังไม่ได้ทำ)
--
-- ข้อจำกัดที่ยอมรับ: จับได้เฉพาะการเปลี่ยนแปลงที่มี auth context จริง
-- (ผ่าน RPC) ถ้า admin แก้ brand_status ตรงๆ ผ่าน Supabase Studio SQL
-- Editor auth.uid() จะเป็น null และจะไม่ถูกบันทึก — trust boundary
-- เดียวกับที่ is_official_brand/is_admin ใช้อยู่แล้ว
-- ============================================================

create table public.admin_audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid not null references public.profiles(id),
  target_profile_id uuid not null references public.profiles(id),
  action text not null check (action in ('mark_processing', 'reject')),
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);

comment on table public.admin_audit_logs is 'บันทึก action ของ admin ต่อสถานะแบรนด์ (mark_processing/reject) เท่านั้น immutable ไม่มี update/delete policy ให้ใครเลย เขียนผ่าน trigger security definer เท่านั้น';

create index idx_admin_audit_logs_target on public.admin_audit_logs(target_profile_id, created_at desc);

alter table public.admin_audit_logs enable row level security;

create policy "admin_audit_logs_admin_select" on public.admin_audit_logs
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );
-- ไม่มี insert/update/delete policy เลย — เขียนผ่าน trigger เท่านั้น
-- และ trigger เองก็ไม่มี update/delete ให้แถวที่เขียนไปแล้วเช่นกัน (immutable)

-- ------------------------------------------------------------
-- Trigger: บันทึกทุกครั้งที่ brand_status เปลี่ยนเป็น 'processing'
-- หรือ 'rejected' เท่านั้น (after update สำเร็จ) — ตั้งใจไม่บันทึกตอน
-- เปลี่ยนเป็น 'pending' เพราะสถานะนั้นเกิดจาก resubmit_brand_info()
-- ซึ่งเป็น action ของ user เจ้าของโปรไฟล์เอง ไม่ใช่ admin (นอก scope)
--
-- auth.uid() ยังคืนค่า actor เดิมถูกต้องแม้รันอยู่ข้างใน RPC security
-- definer (admin_mark_brand_processing/admin_reject_brand) เพราะอ่าน
-- จาก JWT ของ request เดิม ไม่ใช่เจ้าของฟังก์ชันที่กำลังรัน
--
-- column brand_status ถูก revoke update จาก authenticated/anon ไปแล้ว
-- ใน 0011 (แก้ได้แค่ผ่าน security definer function เท่านั้น) ดังนั้น
-- trigger นี้ครอบคลุมทุกทางที่ column นี้เปลี่ยนได้จริงในระบบครบแล้ว
-- ------------------------------------------------------------
create or replace function public.log_brand_status_change()
returns trigger as $$
declare
  v_action text;
begin
  if new.brand_status is distinct from old.brand_status and auth.uid() is not null then
    v_action := case new.brand_status
      when 'processing' then 'mark_processing'
      when 'rejected' then 'reject'
      else null
    end;

    if v_action is not null then
      insert into public.admin_audit_logs (actor_id, target_profile_id, action, old_value, new_value)
      values (auth.uid(), new.id, v_action, old.brand_status, new.brand_status);
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger log_brand_status_change_trigger
  after update on public.profiles
  for each row execute function public.log_brand_status_change();
