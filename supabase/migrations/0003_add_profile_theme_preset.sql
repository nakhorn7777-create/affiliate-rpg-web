-- ============================================================
-- PROFILE THEME PRESETS
-- รันใน Supabase SQL Editor หลังจาก schema_v2.sql ถูก apply แล้ว
--
-- แทนที่ theme_primary_color/theme_secondary_color/theme_font แบบ
-- freeform เดิม (ยังไม่เคยมี UI ใช้งานจริง) ด้วยการเลือกจาก preset
-- สำเร็จรูปเท่านั้น กันสีขัดตากันเอง — รายละเอียดจริงของแต่ละ preset
-- (สี/ฟอนต์/พื้นหลัง) เก็บไว้ในโค้ด frontend (src/lib/theme/presets.ts)
-- ไม่ใช่ใน DB เพื่อแก้ไข/เพิ่ม preset ใหม่ได้โดยไม่ต้อง migrate ตารางอีก
-- ============================================================
alter table public.profiles
  drop column if exists theme_primary_color,
  drop column if exists theme_secondary_color,
  drop column if exists theme_font;

alter table public.profiles
  add column theme_preset text not null default 'royal_gold'
    check (theme_preset in (
      'royal_gold', 'midnight_emerald', 'crimson_noir',
      'sapphire_frost', 'rose_platinum', 'obsidian_neon'
    ));
