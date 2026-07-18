-- ============================================================
-- Brand Verification & Post-Match Contact Reveal
-- รันใน Supabase SQL Editor หลังจาก 0001-0009 ถูก apply แล้ว
--
-- Social links (tiktok_url/facebook_url/instagram_url) ใช้ชุดเดียวกับ
-- Creator ตาม Dual Persona design ไม่มี column ใหม่ส่วนนี้
-- ============================================================

-- ------------------------------------------------------------
-- 1. Verified Brand badge
-- is_official_brand แก้ได้เฉพาะผ่าน service_role (Supabase Studio SQL
-- Editor รันเป็น postgres/superuser bypass RLS+trigger นี้อยู่แล้ว
-- ไม่กระทบ) ถ้า client พยายามส่งค่านี้มาผ่าน .update() ปกติ (แม้จะพ่วง
-- มากับ field อื่นที่ update ถูกต้อง) จะ raise exception บล็อกทั้ง
-- request ทันที ไม่เงียบๆ revert
-- ------------------------------------------------------------
alter table public.profiles
  add column is_official_brand boolean not null default false,
  add constraint official_brand_requires_brand_mode
    check (not is_official_brand or has_brand);

create or replace function public.protect_official_brand_flag()
returns trigger as $$
begin
  if new.is_official_brand is distinct from old.is_official_brand
     and auth.role() <> 'service_role' then
    raise exception 'ไม่สามารถแก้ไขสถานะ Verified Brand ได้ (เฉพาะ admin เท่านั้น)';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger protect_official_brand_flag_trigger
  before update on public.profiles
  for each row execute function public.protect_official_brand_flag();

-- ------------------------------------------------------------
-- 2. PROFILE_CONTACTS
-- แยกตารางต่างหากโดยเจตนา ไม่ฝากไว้ใน profiles เพราะ
-- profiles_public_select เปิด public ทั้งแถว ตารางนี้ปิดสนิท
-- owner-only ไม่มี public select เด็ดขาด — เปิดเผยให้อีกฝ่ายเห็นได้
-- ทางเดียวคือผ่าน get_matched_contact() ด้านล่างเท่านั้น
-- ------------------------------------------------------------
create table public.profile_contacts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  contact_email text,
  contact_line_id text,
  contact_facebook text,
  updated_at timestamptz not null default now()
);

comment on table public.profile_contacts is 'ข้อมูลติดต่อส่วนตัว owner-only เปิดเผยให้คู่ดีลที่ accepted แล้วเท่านั้นผ่าน get_matched_contact()';

alter table public.profile_contacts enable row level security;

create policy "profile_contacts_owner_select" on public.profile_contacts
  for select using (auth.uid() = user_id);

create policy "profile_contacts_owner_insert" on public.profile_contacts
  for insert with check (auth.uid() = user_id);

create policy "profile_contacts_owner_update" on public.profile_contacts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 3. Function: เปิดเผย contact ให้เฉพาะคู่ดีลที่ accepted แล้ว
--
-- เจ้าของดีล -> เห็น contact ของ "ทุกคน" ที่ accepted ในดีลนี้ (set,
-- รองรับ slots_total > 1)
-- ผู้สมัครที่ accepted -> เห็น contact ของเจ้าของดีลแค่คนเดียว
-- ยังไม่ matched (ไม่ใช่เจ้าของ และไม่มี reply accepted) -> คืนค่าว่าง
-- ไม่ error แค่ยังไม่ปลดล็อก
-- ------------------------------------------------------------
create or replace function public.get_matched_contact(p_deal_id uuid)
returns table (
  counterpart_user_id uuid,
  contact_email text,
  contact_line_id text,
  contact_facebook text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deal record;
begin
  select * into v_deal from public.brand_deals where id = p_deal_id;
  if v_deal is null then
    return;
  end if;

  if v_deal.posted_by = auth.uid() then
    return query
      select dr.applicant_id, pc.contact_email, pc.contact_line_id, pc.contact_facebook
      from public.deal_replies dr
      join public.profile_contacts pc on pc.user_id = dr.applicant_id
      where dr.deal_id = p_deal_id and dr.status = 'accepted';
  else
    return query
      select v_deal.posted_by, pc.contact_email, pc.contact_line_id, pc.contact_facebook
      from public.profile_contacts pc
      where pc.user_id = v_deal.posted_by
        and exists (
          select 1 from public.deal_replies dr
          where dr.deal_id = p_deal_id
            and dr.applicant_id = auth.uid()
            and dr.status = 'accepted'
        );
  end if;
end;
$$;
