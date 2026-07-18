-- ============================================================
-- Brand Verification Lifecycle: admin flag, brand_status, และ
-- hard-enforced column revocation สำหรับ brand identity fields
-- รันใน Supabase SQL Editor หลังจาก 0001-0010 ถูก apply แล้ว
-- ============================================================

-- ------------------------------------------------------------
-- 1. is_admin — ป้องกันแบบเดียวกับ is_official_brand เป๊ะ
-- ขยาย trigger เดิมให้ครอบคลุมทั้ง 2 column, rename ให้สื่อความหมาย
-- ------------------------------------------------------------
alter table public.profiles
  add column is_admin boolean not null default false;

drop trigger if exists protect_official_brand_flag_trigger on public.profiles;
drop function if exists public.protect_official_brand_flag();

create or replace function public.protect_privileged_profile_flags()
returns trigger as $$
begin
  if (new.is_official_brand is distinct from old.is_official_brand
      or new.is_admin is distinct from old.is_admin)
     and auth.role() <> 'service_role' then
    raise exception 'ไม่สามารถแก้ไขสถานะสิทธิ์พิเศษนี้ได้ (เฉพาะ admin ผ่าน service_role เท่านั้น)';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger protect_privileged_profile_flags_trigger
  before update on public.profiles
  for each row execute function public.protect_privileged_profile_flags();

-- ------------------------------------------------------------
-- 2. brand_status
-- ------------------------------------------------------------
alter table public.profiles
  add column brand_status text not null default 'pending'
    check (brand_status in ('pending', 'processing', 'rejected'));

-- ------------------------------------------------------------
-- 3. Hard revoke: brand_status/brand_name/brand_website แก้ได้
-- เฉพาะผ่าน RPC security definer เท่านั้น (Postgres เช็ค column
-- privilege ก่อน RLS จะทำงานเสียอีก — SECURITY DEFINER function ที่
-- เจ้าของคือ postgres จะ bypass การ revoke นี้ได้เองอัตโนมัติ)
-- ------------------------------------------------------------
revoke update (brand_status, brand_name, brand_website)
  on public.profiles from authenticated, anon;

-- ------------------------------------------------------------
-- 4. Admin RPCs — เช็ค is_admin ทุกครั้ง เป็นด่านป้องกันจริง
-- (ไม่แตะ is_official_brand เด็ดขาด ตามที่ตกลง)
-- ------------------------------------------------------------
create or replace function public.admin_mark_brand_processing(p_profile_id uuid)
returns void as $$
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and is_admin
  ) then
    raise exception 'เฉพาะ admin เท่านั้นที่ทำรายการนี้ได้';
  end if;

  update public.profiles set brand_status = 'processing' where id = p_profile_id;
end;
$$ language plpgsql security definer;

create or replace function public.admin_reject_brand(p_profile_id uuid)
returns void as $$
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and is_admin
  ) then
    raise exception 'เฉพาะ admin เท่านั้นที่ทำรายการนี้ได้';
  end if;

  update public.profiles
  set brand_status = 'rejected', brand_name = null, brand_website = null
  where id = p_profile_id;
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------
-- 5. Resubmit — ทางเดียวที่ user แก้ brand_name/brand_website เองได้
-- reset brand_status กลับเป็น pending เสมอทุกครั้งที่บันทึก
-- ------------------------------------------------------------
create or replace function public.resubmit_brand_info(
  p_brand_name text,
  p_brand_website text
) returns void as $$
begin
  if auth.uid() is null then
    raise exception 'ต้อง login ก่อน';
  end if;

  update public.profiles
  set brand_name = p_brand_name,
      brand_website = p_brand_website,
      brand_status = 'pending'
  where id = auth.uid();
end;
$$ language plpgsql security definer;
