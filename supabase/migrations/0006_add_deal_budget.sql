-- ============================================================
-- Add budget_amount to brand_deals
-- รันใน Supabase SQL Editor หลังจาก 0001-0005 ถูก apply แล้ว
--
-- ตัวเลขเดียว nullable — null หมายถึง "เจรจาต่อรอง/ไม่ระบุ"
-- ไม่ทำเป็นช่วง min-max เพื่อความง่าย ตรงกับที่ Fastwork โชว์ราคา
-- เดียวต่อโพสต์
-- ============================================================
alter table public.brand_deals
  add column budget_amount numeric(12, 2) check (budget_amount >= 0);
