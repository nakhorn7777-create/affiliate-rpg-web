-- ============================================================
-- Add category to brand_deals
-- รันใน Supabase SQL Editor หลังจาก 0001-0006 ถูก apply แล้ว
--
-- หมวดหมู่ตายตัว (ไม่ใช่พิมพ์อิสระ) เพื่อกรอง/แสดงผลบนตารางกระดาน
-- งานจ้างได้แม่นยำ ใช้ CHECK constraint ธรรมดาแบบเดียวกับ
-- theme_preset เพราะเป็น list คงที่ ไม่ต้องมี master table แยก
-- ============================================================
alter table public.brand_deals
  add column category text not null default 'other'
    check (category in (
      'beauty', 'fashion', 'food', 'health', 'tech',
      'home', 'baby', 'gaming', 'travel', 'other'
    ));
