# 00 Build Order And Gates

## Objective

สร้างระบบแบบ function ใช้งานจริงทีละก้อน โดยไม่ขึ้น UI mock ก่อน domain logic พร้อมใช้งาน จุดประสงค์คือให้ทุก step มีของจริงที่ทดสอบซ้ำได้บน Supabase local ก่อนข้ามไป step ถัดไป

## Non-Negotiables

- UI ทุกหน้าต้องอ่าน/เขียน Supabase จริง หรือเรียก service จริง
- ห้ามสร้างปุ่มที่โชว์ success โดยไม่ mutate DB/Storage/Auth จริง
- ห้าม hardcode player, rank, tournament, payment, registration เพื่อให้หน้า “ดูเหมือนเสร็จ”
- Seed data ใช้ได้เฉพาะ local test/dev และต้องแยกชัดว่าเป็น fixture
- ทุก state transition ต้องถูกบังคับทั้งใน service layer และ DB/RLS เท่าที่ทำได้

## Build Sequence

1. Project foundation
   - Next.js App Router, TS strict, Tailwind, shadcn/ui, Supabase local, env template
   - Deliverable: app boot, Supabase local health check, empty shell

2. Identity foundation
   - `accounts`, `account_roles`, `role_requests`, `referee_invite_codes`
   - Auth signup/login/session/middleware
   - Deliverable: player signup, coach pending request, admin role seed, referee invite redeem

3. Go Player Database
   - Excel import DAN/KYU/AWARD, parse, normalize, rank conversion, trigram search
   - Deliverable: import real Excel and search real names with verified/pending fallback

4. Player Profile and Coach Link
   - 1 account has max 1 player profile
   - Coach cannot create player; coach links only to existing player accounts
   - Deliverable: player approves coach request; coach can see approved linked player

5. Tournament admin
   - Tournament/division CRUD, banner upload, status rules, promo code CRUD
   - Deliverable: admin creates real open tournament shown on public list/detail

6. Registration and payment
   - Player self registration, coach linked-player registration, validation, quota, payment order, QR, slip upload
   - Deliverable: real registration/payment flow to pending_verify/confirmed

7. Admin operations
   - verify payment, approve pending ranks, user management, exports, notifications
   - Deliverable: admin can resolve operational queues without direct DB edits

8. Cron and lifecycle
   - payment timeout, quota return, waiting-list promotion
   - Deliverable: local Edge Function transitions expired orders correctly

9. Tournament day
   - Phase 2 schema, TSV import, judge page, realtime results, standings
   - Deliverable: one tournament-day rehearsal from start to complete

## Gate For Every System

- Schema/migration exists and `supabase db reset` passes
- RLS policies exist for every touched table
- Service functions cover allowed and forbidden actors
- UI has loading, empty, error, success states from real outcomes
- At least one happy-path and one failure-path test is documented or automated
- `npm run lint` and `npm run build` pass
- Mobile user view works at 375-430px
- Admin view works at 1024px+

## Stop Conditions

Do not move to the next system if:

- The current system depends on mock data to look complete
- A user can bypass permissions through client-side checks only
- A destructive or financial state transition lacks an audit trail
- Any old masterplan assumption reappears, especially multi-profile account creation by coach

