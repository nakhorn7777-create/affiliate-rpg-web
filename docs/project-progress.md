# AffiliateRPG — Project Progress Log

อัปเดตล่าสุด: 2026-07-20 (Day 9 นับจาก commit แรก) — สร้างจาก `git log` จริง + [project_status memory](../CLAUDE.md) ไม่มีส่วนไหนเดา

---

## Day 1 — 2026-07-12: Scaffold + Profile พื้นฐาน
- `Initial scaffold`: Next.js App Router + Supabase Auth
- `Step 3`: profile dashboard, affiliate link manager, public profile + follow

## Day 2 — 2026-07-13: Theme + Landing Page + Game Placeholder
- รีธีมเต็มรูปแบบเป็น dark navy/gold, หน้า landing แบบ storytelling 6 ส่วน, เช็ค Phaser 2D grid เบื้องต้น (จุดเริ่มของ `/game`)
- เพิ่ม sprite-slicer tool สำหรับตัด pixel-art sprite sheet

## Day 3 — 2026-07-14: Portfolio Schema + Global Nav
- เพิ่ม schema "portfolio pivot" (profile themes, portfolio uploads, brand job board) — **ตอนนั้นทำแค่ schema ยังไม่มี frontend** (ยังเป็นสถานะนี้อยู่จนถึงวันนี้)
- Global nav, avatar Game hub, รองรับ TH/EN สำหรับหน้าหลัง login

## Day 4 — 2026-07-15: Security Hardening รอบแรก + Insights
- Route protection แน่นขึ้น, feedback widget, marketing insights dashboard
- Profile theme customization + รวม settings form
- Insights ปรับเป็น omni-channel dashboard (sidebar + charts)
- จัดระเบียบ SQL เป็น numbered migrations ใน `supabase/migrations/`
- Schema ความปลอดภัยสำหรับ eBay-style Brand Deal Reviews + Pantip-style Job Board
- **Security fix**: หยุดเชื่อ client-passed user id ใน game economy RPCs (IDOR fix รอบแรกของโปรเจกต์)

## Day 5 — 2026-07-16: Job Board Core
- หน้า public job board list + create-post
- Job board budget/tabs/detail page, accept-complete flow, eBay-style reviews

## Day 6 — 2026-07-17: Job Board Polish + Novice Academy
- Refactor job board UI เป็น fastwork-style table (responsive sticky columns, product categories)
- Novice Academy: schema quest ถาวร + secured check RPC, หน้า quest board, entry ใน avatar nav
- **หมายเหตุ**: Novice Academy shipped เป็นหน้าเว็บ `/academy` แยกต่างหาก ไม่ได้ฝังอยู่ในโลกเกม — เป็นการตัดสินใจ scope ตั้งแต่ตอนนั้น ไม่ใช่ของค้าง

## Day 7 — 2026-07-18: Marathon Session (Brand Mode + Engineering Hardening)
วันที่หนักที่สุดของโปรเจกต์ (15 commits):
- **Brand Mode เต็มรูปแบบ**: toggle, info form, verification lifecycle (pending/processing/rejected/verified), admin review dashboard + audit trail
- **Job Board lifecycle ครบ**: reject applicant, cancel deal (ของที่ขาดไปก่อนหน้านี้)
- **Post-Match Contact Reveal**: ฟอร์ม contact สากล + RPC เปิดเผยข้อมูลติดต่อหลัง match
- Migrate `/dashboard` → `/settings` เป็น tabbed sidebar layout
- Security fix: ปรับ brand status precedence ให้ rejected ชนะ verified เสมอ (kill-switch ที่เชื่อถือได้)
- **Engineering hardening**: CI pipeline (`build` + `integration-tests` jobs), strict Supabase-generated TypeScript types, Vitest unit tests, DB/RPC integration tests กับ Supabase test project แยก, schema baseline formalize เป็น migration `0000`
- Rate limiting บน `brand_deals`/`deal_replies` inserts

## Day 8 — 2026-07-19: Season Leaderboard
- เอกสาร architecture hardening review (`docs/architecture-hardening-review.md`)
- Season leaderboard แบบ snapshot-based (daily/weekly/monthly rankings)
- Restructure global nav + หน้า public Leaderboard
- เพิ่ม season-total tab ในหน้า leaderboard

## Day 9 — 2026-07-20 (วันนี้): Type Drift Fix + Game Design Research
- Regenerate `database.types.ts` จาก production schema จริง, ลบ `as never` casts ที่ค้างอยู่ใน `leaderboard-view.tsx` (แก้ปัญหา schema drift ที่เจอจากรอบ type-gen ก่อนหน้า)
- **งานวิจัย (ไม่ใช่โค้ด)**: วิเคราะห์เปรียบเทียบสถาปัตยกรรมความปลอดภัยของเกมอ้างอิง 2 เกม (Realm of Aethel, Spirit World MMORPG) สรุปเป็นหลักการ "client ส่งแค่เจตนา, server คำนวณผลเองเสมอ" — เตรียมไว้ก่อนเริ่มออกแบบ `/game` จริง
- เริ่ม conceptual design ของ Seasonal MMORPG economy (affiliate-linked itemization, T1/T2 supply chain) — **อยู่ระหว่างพิจารณา ยังไม่ตัดสินใจ ยังไม่มีโค้ด**

---

## สถานะปัจจุบัน (สรุปจาก project_status memory)

**ที่ทำเสร็จแล้ว, พร้อมใช้งานจริง:** Auth + Profile, Affiliate link manager, Brand Mode ครบ lifecycle, Job Board ครบ lifecycle, Post-Match Contact Reveal, Novice Academy (`/academy`), Season Leaderboard, CI + strict types + test suite + audit trail

**ที่ตั้งใจเลื่อนไว้ (ไม่ใช่บั๊ก อย่าไปแก้เองโดยไม่ถาม):**
- Insights CSV bulk-upload ยังรองรับแค่ content platforms (Facebook/TikTok) — ยังไม่ทำ commerce (Shopee/Lazada)
- Portfolio pivot schema (`niche_tags`, `portfolio_items`) มี schema แต่ยังไม่มี frontend เลย
- เกมยังเป็น Phaser placeholder (`TownScene.ts` — walkable field เปล่า ไม่มี NPC) — เพิ่งเริ่มขั้นตอนออกแบบ (Day 9)
- หน้า `/login` วิดีโอพื้นหลังแบบ cinematic ที่วางแผนไว้ยังไม่เริ่ม
- Theme ยังไม่สม่ำเสมอ: `/settings`, `/game`, `/stats` ยังใช้สไตล์ neutral ธรรมดา ต่างจากหน้าอื่นที่เป็น navy/gold

**Production migration policy**: migration ฐานข้อมูล production ยังคง paste ผ่าน Supabase Studio ด้วยมือเสมอ ไม่ auto-apply แม้จะมี CI/test-project automation แล้วก็ตาม (เป็นการตัดสินใจตั้งใจ)
