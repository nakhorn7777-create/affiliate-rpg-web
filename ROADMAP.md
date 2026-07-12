# Roadmap: Affiliate Profile + RPG Game (อัปเดตล่าสุด)

## สรุปไฟล์ Schema (`schema_v2.sql`)

ไฟล์เดียว รันครั้งเดียวใน Supabase SQL Editor ครอบคลุมทั้งหมด: **19 ตาราง, 28 functions/views**

### ตารางทั้งหมด
| กลุ่ม | ตาราง |
|---|---|
| Auth/Profile | `profiles`, `signup_audit_log`, `fraud_flags` |
| Season | `seasons`, `season_rewards`, `season_notifications_log` |
| Affiliate | `affiliate_links`, `followers`, `profile_views` |
| Game Core | `game_stats`, `game_items`, `crafting_recipes`, `crafting_recipe_ingredients`, `player_inventory` |
| Marketplace | `marketplace_listings`, `marketplace_transactions`, `item_price_bands` |
| Subscription | `subscription_codes`, `subscription_cancellations` |

### Business Logic หลักที่ฝังอยู่ในโค้ดแล้ว
- **Token**: 1 follow = 1 token (เพดาน 1000/season/คน กัน inflation), รีเซ็ตได้ทุก season
- **Marketplace**: ร้าน 10 ช่อง/season, ภาษีตาม tier (30%/15%/10%), เพดานราคาปรับทุก 100 ชิ้นขาย, กัน race condition ด้วย row lock
- **Subscription Tier**: copper→legendary ตามวันล็อกอินสะสม + subscribe ได้ tier กระโดด, โค้ดฟรีช่วงแรก, ยกเลิกผ่าน admin
- **Anti-fraud**: จำกัด 3 บัญชี/IP/วัน (flag ไม่บล็อก), Turnstile ตอน signup
- **Season Reset**: auto-cancel listing ค้าง, แจกถ้วยรางวัล top3+participation, freeze อัตโนมัติ, admin กด activate season ใหม่เอง, นับถอยหลังแบบ real-time
- **RLS**: ครบทุกตาราง แบ่งโซนเว็บ (public) กับโซนเกม (private + RPC only)

### ที่ยังไม่ได้ทำ (นอก schema)
- Auth flow ฝั่ง Frontend (API route wrap Supabase Auth + Turnstile + IP capture)
- Frontend ทั้งหมด (Next.js/Astro สำหรับ Profile, Phaser.js สำหรับเกม)
- Supabase Dashboard setup (Google OAuth, SMTP, Redirect URLs — ดู checklist ด้านล่าง)

---

## ควรเริ่มตรงไหนก่อน? — ลำดับที่แนะนำ

### Step 0: เตรียมเครื่องมือ (ทำครั้งเดียว)
1. สมัคร/สร้างโปรเจกต์ที่ [supabase.com](https://supabase.com) (ฟรีพอสำหรับช่วง dev)
2. เปิด **SQL Editor** ในโปรเจกต์ → paste `schema_v2.sql` ทั้งไฟล์ → กด Run
   - ถ้ารันผ่านหมดไม่มี error = schema พร้อมใช้งานจริงแล้ว
3. เก็บ 3 ค่านี้ไว้ (จะใช้ตอนต่อ frontend): **Project URL**, **anon public key**, **service_role key** (อยู่ที่ Settings → API)

### Step 1: ตั้งค่า Auth (ทำก่อนเขียนโค้ดเลย)
ทำ checklist นี้ให้ครบก่อน ไม่งั้นจะเจอ error ตอนทดสอบ login:
- [ ] Google OAuth: สร้าง Client ID/Secret ที่ Google Cloud Console → ใส่ใน Supabase Dashboard → Authentication → Providers → Google (เปิด toggle)
- [ ] Authorized Redirect URI ที่ Google Console = `https://<project-ref>.supabase.co/auth/v1/callback`
- [ ] Email/Magic Link: เปิด provider ใน Auth settings (เปิดอยู่แล้วโดย default ปกติ)
- [ ] เพิ่ม `http://localhost:3000` (หรือพอร์ตที่ใช้ dev) เข้า Redirect URLs ก่อน จะได้ทดสอบได้ทันที (ค่อยเพิ่ม production domain จริงทีหลัง)

### Step 2: Scaffold โปรเจกต์ Frontend (Profile ก่อน)
เริ่มจาก **หน้า Profile** ก่อนเกม เพราะเป็นหัวใจธุรกิจหลัก และทดสอบ Auth ได้ง่ายกว่า:
1. สร้างโปรเจกต์ Next.js ใหม่
2. ติดตั้ง `@supabase/supabase-js` และ `@supabase/ssr`
3. เชื่อม Supabase client ด้วย Project URL + anon key
4. ทำหน้า Login (ปุ่ม "Continue with Google" + "Continue with email") — **นี่คือจุดที่เห็นหน้าตาเว็บจริงครั้งแรก** ทดสอบ login ให้ผ่านก่อนไปทำหน้าอื่น

### Step 3: ทำหน้า Profile พื้นฐาน
- แสดงข้อมูล `profiles`, `affiliate_links` (แบบ read-only ก่อน)
- ทำฟอร์มแก้ไขโปรไฟล์ + เพิ่มลิงก์ (เชื่อม RLS ที่มีอยู่แล้วได้ทันที ไม่ต้องเขียน backend เพิ่ม)
- ทดสอบปุ่ม Follow (เช็คว่า token ขึ้นใน `game_stats` จริงไหม)

### Step 4: ค่อยไปทำ Game (Phaser.js)
รอให้ฝั่ง Profile + Auth เสถียรก่อน ค่อยเริ่มเกม เพราะเกมต้องพึ่ง session ที่ auth flow สร้างไว้แล้ว

### Step 5: Anti-fraud + Season Automation
ทำหลังสุด เพราะเป็นระบบเสริมด้านหลังบ้าน ไม่กระทบหน้าตาเว็บที่เห็น — ตั้งค่า pg_cron และ Edge Function ตอนใกล้ launch จริง

---

## ตอบคำถาม: ต้องใช้ Claude Code ไหม หรือโยนไฟล์ไว้ตรงไหน?

**ใช้ Claude Code ได้เลยครับ เหมาะกับงานนี้มาก** เพราะเป็นงานเขียนโค้ดหลายไฟล์ต่อเนื่อง (Next.js + Phaser.js) ที่ต้องรันคำสั่ง terminal, สร้างไฟล์จริง, และ debug ไปเรื่อยๆ — ต่างจากแชทนี้ที่เหมาะกับการ "ออกแบบ/คุยตัดสินใจ" มากกว่า

**วิธีโยนไฟล์ให้ Claude Code เข้าใจ:**
1. สร้างโฟลเดอร์โปรเจกต์ใหม่ (เช่น `affiliate-rpg-web/`)
2. วาง `schema_v2.sql` ไว้ในโฟลเดอร์นั้น เช่น `affiliate-rpg-web/supabase/schema_v2.sql`
3. เปิด Claude Code ที่โฟลเดอร์นี้ แล้วบอกตรงๆ ว่า "นี่คือ schema ของ Supabase ที่ออกแบบไว้แล้ว ช่วยสร้างโปรเจกต์ Next.js เชื่อมกับ schema นี้ทีละ step" — Claude Code จะอ่านไฟล์ `.sql` นี้เป็น context อ้างอิงเวลาเขียนโค้ด query/RPC ได้ถูกต้องตรงกับโครงสร้างจริง
4. แนะนำให้ก็อปวางไฟล์ `project_roadmap.md` นี้ไว้ในโฟลเดอร์เดียวกันด้วย (เช่น `affiliate-rpg-web/ROADMAP.md`) จะได้เป็น context ให้ Claude Code เข้าใจภาพรวมทั้งโปรเจกต์ ไม่ใช่แค่ schema อย่างเดียว

**คำแนะนำเรื่อง step-by-step ที่อยากได้**: บอก Claude Code ตรงๆ แบบเดียวกับที่คุยกับผมได้เลยครับ เช่น "ทำแค่หน้า Login ก่อน อย่าเพิ่งทำหน้าอื่น" แล้วค่อยสั่งทีละ Step ตามลำดับด้านบน (Step 2 → 3 → 4 → 5) จะได้เห็นหน้าตาเว็บทีละส่วนและเช็คความถูกต้องได้ตลอดทาง ตรงกับที่ต้องการเป๊ะ
