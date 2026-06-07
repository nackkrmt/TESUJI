# TESUJI System Plans

เอกสารชุดนี้แยกแผน implement ตามระบบย่อย เพื่อกันการทำแล้วรื้อซ้ำ จุดยึดหลักคือ `master_plan.md` แต่ไฟล์ในโฟลเดอร์นี้ลงรายละเอียดเชิง implementation มากกว่า

## Token-Light Usage

- อ่าน `docs/AI_HANDOFF.md` และ `docs/DECISIONS.md` ก่อนเสมอ
- อ่านเฉพาะไฟล์แผนย่อยที่เกี่ยวกับงานปัจจุบัน
- ห้ามเปิด `master_plan.md` ทั้งไฟล์ ให้ใช้ `rg -n "<keyword>" master_plan.md` แล้วอ่านเฉพาะช่วงที่จำเป็น
- ถ้าต้องทำ Sprint 5 ให้เริ่มจาก `05_registration_payment_token_light_slices.md` และทำทีละ slice เท่านั้น

## กติกากลาง

- ไม่มี mockup, fake state, hardcoded success, หรือ UI ที่กดแล้วไม่เกิด mutation จริง
- ทุกระบบต้องเริ่มจาก schema/RLS/service logic ก่อน UI
- ใช้ Supabase local เป็นฐานพิสูจน์ว่า function ใช้งานจริง
- ก่อนข้ามระบบ ต้องผ่าน lint/build, migration reset, RLS checks, happy path, failure path สำคัญ, และ responsive gate
- ถ้า spec ในไฟล์ย่อยขัดกับ `docs/DECISIONS.md` หรือ `docs/AI_HANDOFF.md` ให้ยึดสองไฟล์นั้นก่อน แล้วค่อยค้น `master_plan.md` แบบเจาะจุดถ้ายังจำเป็น

## ลำดับอ่านและลงมือ

1. `00_build_order_and_gates.md` — ลำดับงานและ gate ห้ามข้าม
2. `01_identity_roles_access.md` — Account, roles, Coach approval, Referee invite
3. `02_go_player_database_rank_matching.md` — Go Player DB, Excel import, rank matching
4. `03_player_profile_coach_link.md` — Player Profile 1:1 และ Coach Link
5. `04_tournament_admin.md` — Tournament, Division, Promo Code, admin CRUD
6. `05_registration_payment_token_light_slices.md` — Sprint 5 token-light command slices
7. `05_registration_payment_waiting_list.md` — สมัครแข่ง, payment, quota, waiting list full subsystem plan
8. `06_admin_ops_notifications.md` — ตรวจสลิป, approve rank, user/admin ops, notification
9. `07_tournament_day_realtime.md` — Phase 2: TSV, judge, results, realtime
10. `08_quality_release.md` — test strategy, release readiness, no-mock audit
