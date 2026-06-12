# TESUJI — แผนทดสอบระบบโดยผู้ใช้ (Owner-run End-to-End UAT Plan)

> สร้างเมื่อ 2026-06-13 โดยอ่านโค้ดจริงของแต่ละ subsystem (workflow `tesuji-uat-plan`, 9 readers + completeness critic). ทุก step/field/ปุ่ม/ผลลัพธ์อ้างอิงจากโค้ดและพฤติกรรม RPC จริงใน `docs/AI_HANDOFF.md` ณ วันที่สร้าง — ถ้าโค้ดเปลี่ยน ให้รัน generator ใหม่หรือแก้รายการที่กระทบ

**ผู้รัน:** เจ้าของโปรเจกต์ (owner QA) ทดสอบด้วยมือบนเบราว์เซอร์ก่อน launch  •  **ขอบเขต:** ทั้งระบบ end-to-end ทุก role (player / coach / referee / admin)

**สรุปจำนวน:** 9 suites · **288 test cases** — P0 `103` / P1 `114` / P2 `71` · happy `97` / negative `101` / edge `90`

## สารบัญ & coverage

| # | Suite | Cases | P0 | P1 | P2 | happy | neg | edge |
|---|-------|------:|---:|---:|---:|------:|----:|-----:|
| 1 | [Auth & Registration](#suite-1) | 40 | 11 | 16 | 13 | 8 | 14 | 18 |
| 2 | [Profile & Coach Link](#suite-2) | 22 | 8 | 8 | 6 | 10 | 7 | 5 |
| 3 | [Tournament — Admin CRUD + Public](#suite-3) | 32 | 8 | 14 | 10 | 9 | 11 | 12 |
| 4 | [Tournament Registration](#suite-4) | 33 | 12 | 16 | 5 | 6 | 15 | 12 |
| 5 | [Payment / Slip / My-Registrations / Cancel / Waiting-list](#suite-5) | 44 | 18 | 16 | 10 | 14 | 17 | 13 |
| 6 | [Admin Operations Queues + Referee Invite](#suite-6) | 44 | 19 | 12 | 13 | 18 | 15 | 11 |
| 7 | [Manual Notifications](#suite-7) | 24 | 10 | 10 | 4 | 12 | 7 | 5 |
| 8 | [Admin Database Upload + Search](#suite-8) | 27 | 7 | 13 | 7 | 8 | 11 | 8 |
| 9 | [Home / Digital ID + Navigation](#suite-9) | 22 | 10 | 9 | 3 | 12 | 4 | 6 |
| | **รวม** | **288** | **103** | **114** | **71** | **97** | **101** | **90** |

ภาคผนวก: [A — ช่องโหว่ความครอบคลุม & เคสเสริม](#appendix-a) · [B — ข้อสังเกต/บั๊กที่อาจพบ](#appendix-b) · [C — ตาราง sign-off](#appendix-c)

---

## 0. วิธีใช้เอกสารนี้

- ทุกเคสมี checkbox `[ ]` — ติ๊กเมื่อผ่าน และเติมบรรทัด **Result** ว่า pass/fail + เลขบั๊ก/หมายเหตุ
- **Priority:** `P0` = ต้องผ่านก่อน launch (critical path / ความปลอดภัยข้อมูล) · `P1` = สำคัญ · `P2` = เสริม/ขอบเขต
- **Type:** `happy` = เส้นทางปกติต้องสำเร็จ · `negative` = ต้องถูกปฏิเสธ/แสดง error · `edge` = ขอบเขต/กรณีพิเศษ
- รันตามลำดับใน [§3 ลำดับการทดสอบ](#exec-order) เพราะหลาย flow มี dependency (เช่น ต้องมีทัวร์นาเมนต์เปิดอยู่ก่อนถึงจะลงทะเบียนได้)
- ตรวจผลทั้ง **UI** (ข้อความ/สถานะที่เห็น) และ **DB** (แถว/คอลัมน์/สถานะใน Supabase) ตามที่ระบุในแต่ละเคส

## 1. การเตรียม Environment

```bash
# เปิด dev server (ใช้ host/port นี้ให้ตรงกับที่ทีมใช้)
npm run dev -- --hostname 127.0.0.1 --port 3000
# => base URL: http://127.0.0.1:3000
```

- ⚠️ **ห้ามรัน `npm run build` ขณะ dev server กำลังทำงานบนโฟลเดอร์เดียวกัน** — ทั้งคู่เขียน `.next/` ทำให้ bundle ชนกันแล้วเกิด hydration error (เช่นบน `/register`). ถ้าเจอ: kill dev, ลบ `.next`, แล้ว start dev ใหม่
- `.env.local` ต้องมีครบ: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (หรือ `SUPABASE_SERVICE_ROLE_KEY`), `IDENTITY_HASH_SALT` — ถ้าขาด secret key signup จะ 500, ถ้าขาด salt signup จะ throw
- เปิด **DevTools** ค้างทุกการเทส: **Console** (จับ error/warning), **Application ▸ Cookies** (เช็ก persistent vs session), **Network** (เช็ก HTTP status ของ API)
- **User pages** (`/`, `/login`, `/register`, `/profile`, `/tournaments*`, `/payments*`, `/my-registrations*`, `/notifications`, `/referee/invite`) แสดงใน **mobile frame** เสมอแม้บน desktop
- **Admin pages** (`/admin*`) เป็น desktop และ **ยังไม่มี route guard ใน dev mode** → เปิด URL ตรงได้เลยโดยไม่ต้อง login admin (เป็น locked decision ของ dev mode)
- ต้องมีสิทธิ์เข้า **Supabase dashboard** (project ref `jiweobnsxpmgexipqzbx`) เพื่อ seed admin role, ตรวจ DB rows, และ cleanup

## 2. ข้อตกลง Test Data + Cleanup

- ⚠️ **ทุกอย่างเขียนลง Supabase โปรเจกต์จริง** — ใช้ prefix `uat-` กับ email / ชื่อ / title ทัวร์นาเมนต์ทุกครั้ง เพื่อให้ค้นหา + ลบทิ้งง่าย
- **ห้ามใส่เลขบัตรประชาชน/passport จริง** — ใช้ค่า dummy ที่ไม่ซ้ำ (ระบบเก็บเป็น salted SHA-256 hash เท่านั้น ไม่เก็บค่าดิบ)
- จดรายการสิ่งที่สร้างระหว่างเทสไว้: `auth.users`, `accounts`, `tournaments`/`divisions`, `payment_orders`, `registrations`, `promo_code_usages`, `manual_notifications`(+recipients), `referee_invite_codes`, และ Storage objects ใน bucket `slips` / `tournament-banners`
- **Cleanup หลังเทส:** ลบ auth users (rows ที่เกี่ยวจะ cascade), ลบ tournament/division/registration/payment, ลบ Storage objects, ลบ notifications/invites แล้วรัน query ยืนยันว่าไม่เหลือ `uat-%`
- **Admin actor:** ใน dev mode admin actions ส่ง `null` เป็น `p_admin_account_id` ได้ ถ้าจะเทสเส้นทางที่ต้องมี admin จริง ให้ seed ด้วยมือ: ตั้ง `account_roles.admin = active` ให้บัญชี `uat-admin`

<a id="exec-order"></a>
## 3. Test Accounts + ลำดับการทดสอบ (Execution Order)

### 3.1 บัญชีทดสอบที่ต้องเตรียม

| บัญชี | Role | ใช้ทำอะไร |
|-------|------|-----------|
| `uat-admin@example.com` | admin (seed ด้วยมือ) | ใช้เป็น admin actor จริงเมื่อต้องการ; เปิด `/admin*` |
| `uat-player-self@example.com` | player | rank แบบ self-declared → `pending` (ทดสอบ rank approval) |
| `uat-player-matched@example.com` | player | rank แบบ matched จาก Go DB → `verified` |
| `uat-coach@example.com` | coach (pending→approve) | ได้ active `player` ทันที, `coach` รออนุมัติ; ทดสอบ Coach Link + register linked player |
| `uat-player-linked@example.com` | player | เป็น player ที่ coach ขอ link เพื่อลงแข่งแทน |
| `uat-referee@example.com` | player→referee | redeem referee invite code |

### 3.2 ลำดับแนะนำ (รันครบหนึ่งรอบ)

> มาจาก completeness critic — เรียงตาม dependency ของข้อมูลจริง

1. PHASE 0 — ENV + MIGRATION SANITY (do once, before any data writes). Confirm dev server on http://127.0.0.1:3000 (npm run dev -- --hostname 127.0.0.1 --port 3000). Verify .env.local has NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY/SERVICE_ROLE_KEY, IDENTITY_HASH_SALT. Open /admin/tournaments, /admin/payments, /admin/notifications, /admin/ranks, /admin/roles, /admin/database — none should show a 'Migration pending'/'unavailable' banner. This gates EVERYTHING (signup needs secret key+salt; referee invite needs salt; notifications/payments/tournaments need their migrations).
2. PHASE 1 — GO/SCHOOL DATABASE (read-only first, destructive last). Run all READ-ONLY rank/school search + dashboard cases (DBADM-01, RANK-01..06, SCH-01..04) against existing production rows FIRST — these need no writes and validate the matched-DAN data the signup flow depends on. ONLY THEN, if testing destructive replace (DBADM-02..16), do it in isolation with canonical workbooks ready to restore (DAN 1142/KYU 1635/AWARD 985/SCHOOL 3). Do destructive DB replace BEFORE creating any tournaments/accounts you care about, or after a full cleanup. This phase must precede signup matched-rank tests (REG-01) because rank/search reads go_player_database.
3. PHASE 2 — AUTH + REGISTRATION WIZARD (creates the core test accounts). Run AUTH-01..14 and REG-01..26. During this phase create and RECORD the durable uat- accounts the rest of the pass needs: (A) uat-player-self (player, complete profile, matched or self rank) — record accounts.id, player_profiles.id (UUID), email; (B) uat-coach (registered as coach -> creates pending coach role_request) — record id; (C) uat-other (second player, for permission negatives); (D) a profile-less account if you can craft one (for missing-profile + QR-missing edge). Coach signup (REG-03) leaves coach role PENDING — it is activated in Phase 3.
4. PHASE 3 — ADMIN ROLE ACTIVATION + SEEDS (unblocks coach + referee + rank flows). At /admin/roles approve uat-coach's coach request (ROLE-COACH-01) so account_roles.coach becomes active — REQUIRED before ANY coach search/register/link case. At /admin/ranks approve a pending rank (RANK-01..06) to exercise rank review. Create+capture referee invite raw codes (ROLE-INV-01..04) and run REF-REDEEM-01..07 (redeem needs a logged-in non-referee account). Seed uat-admin-01 (manual account_roles admin=active in Supabase) for HOME-10 Admin tile. This phase must follow Phase 2 (accounts exist) and precede Phase 5 (coach-registers-linked-player needs active coach).
5. PHASE 4 — COACH LINK LIFECYCLE (on /profile). With uat-coach now active: COACH-01..09 (search + send link request to uat-player-self), then PLAYER-01..05 as uat-player-self (approve one link -> APPROVED is the precondition for Phase 5 coach registration; reject another), PROF-01..04, NEG-01..04. The APPROVED coach_player_link from PLAYER-01 is the hard gate for REG-08 (coach registers linked player) and the coach payment/my-registrations access cases. Also exercise the new COACH-REVOKE-ACCESS gap case here.
6. PHASE 5 — TOURNAMENT ADMIN CRUD + OPEN (builds the registration targets). At /admin/tournaments create the uat- tournaments and DRIVE THEM TO 'open' with active divisions inside their registration windows: a standard open paid+free tournament (TRN-HAPPY-01..09), a future-window one (TRN-EDGE-06), a past-window one (TRN-EDGE-07), an unbounded-window one (TRN-EDGE-08), a FULL paid division and a FULL free division (fill to quota for waitlist), time-conflicting divisions, bound-testing divisions, and a cancelled one (TRN-EDGE-12). Add promo codes (percentage/fixed/free/expired/inactive/usage-capped/division-restricted) per TRN-HAPPY-06/07 + REG-10..18 setup. Run all TRN-NEG/EDGE cases. This phase MUST precede Phase 6 — no registration is possible until a tournament is open with an active division inside its window (RPC enforces status='open' + window + division active).
7. PHASE 6 — USER REGISTRATION (the core flow + new server-defense cases). As uat-player-self / uat-coach run REG-01..33 of the registration suite: guest/closed/missing-profile panels, paid/free happy paths, coach-registers-approved-linked-player (needs Phase 4 APPROVED link), all promo cases, eligibility (power/age/duplicate/time-conflict) cases, waiting-list position cases (needs Phase 5 full divisions), and the NEW server-defense cases REG-SRV-WINDOW, REG-XTOUR-DIV, REG-RACE-LASTSLOT. Each paid registration here PRODUCES the pending_payment payment_orders that Phase 7 consumes.
8. PHASE 7 — PAYMENT + SLIP (consumes Phase 6 orders). On the pending_payment orders from Phase 6: PAY-01..10 (QR/masking/fallback/missing-config/expired — set expires_at directly in Supabase for the expired path), SLIP-01..11 (upload valid jpg/png moves order+regs to pending_verify; bad-type/oversize/cross-user/coach-upload/expired-direct-POST), plus new SLIP-ROUTE-METHODS, PAY-QR-MERCHANTNAME, PAY-PROMPTPAY-FORMATS. Uploading a slip (SLIP-01) is the hard precondition for Phase 8 admin verify.
9. PHASE 8 — ADMIN PAYMENT VERIFY + WAITLIST/TIMEOUT (consumes Phase 7 pending_verify + Phase 5/6 waitlist). At /admin/payments: PAY-01..10 admin queue, Approve (PAY-02), Reject-send-new (PAY-03), Reject-cancel-with-promotion (PAY-04 — needs a full division with a waitlister behind the order), Run-timeout-sweep (PAY-08/09, TIMEOUT-01/02 — needs an overdue pending_payment order, set expires_at past), plus new PAY-APPROVE-ZEROUPD. Then user-side WAIT-01..05 and CANCEL-01..07 cancellation+promotion cases (cancel a confirmed slot -> promote oldest waitlister), and MYREG-01..09 my-registrations list/detail (now populated with mixed statuses incl. promoted/expired/cancelled). Confirmed orders here also feed PAY-CONFIRMED-PANEL and PAY-REJECTED-PANEL.
10. PHASE 9 — NOTIFICATIONS + HOME/DIGITAL-ID (consumes registered + linked accounts). At /admin/notifications send all_accounts / selected / tournament-audience notifications (MNOT-01..14, plus MNOT-PREVIEW-PARITY) — tournament audience needs Phase 6 registrants with mixed statuses to resolve owner+registered_by dedupe and excluded-status checks. Then as users: inbox + mark-read + RLS isolation (MNOT-15..24), unread-count entry points on / and /profile (PROF-04, HOME-08/09, MNOT-18/19). Run the full Home/Digital-ID suite (HOME-01..22) now that accounts have profiles, roles, coach links, and unread notifications. /admin/users (USER-01..05) and /admin/registrations + CSV export (REG-01..07 admin) can run any time after Phase 6 produces registrations.
11. PHASE 10 — CLEANUP (reverse dependency order). Delete in FK-safe order: manual_notification_recipients + manual_notifications; promo_code_usages; registrations + payment_orders (and slips Storage objects under {tournament_id}/{orderId}/); promo_codes + divisions + tournaments (+ tournament-banners Storage objects, not cascade-deleted); coach_player_links; role_requests; referee_invite_codes; account_roles; player_profiles; accounts; finally the auth.users rows (cascades the public.* children). If Phase 1 ran destructive DB replace, RE-UPLOAD the canonical DAN/KYU/AWARD/SCHOOL workbooks to restore production counts. Leave database_import_runs as audit history or prune uat- rows directly.

### 3.3 Dependency ข้าม flow ที่ต้องระวัง

- GO/SCHOOL DB BEFORE SIGNUP MATCHED-RANK: REG-01 (matched-DAN verified signup) and rank/search RANK-01..06 read go_player_database; the matched name (e.g. 'ก่อศักดิ์ ไชยรัศมีศักดิ์' 7 Dan) must exist BEFORE any verified-rank signup. Any destructive DBADM replace must NOT wipe the source those tests rely on.
- SECRET KEY + IDENTITY_HASH_SALT BEFORE SIGNUP: /api/auth/signup returns 500 without SUPABASE_SECRET_KEY and throws without IDENTITY_HASH_SALT (identity hashing). Referee invite create/redeem also need the salt. Env sanity (Phase 0) gates Phases 2 and 3.
- SIGNUP BEFORE EVERYTHING USER-SIDE: every user-side suite (profile, coach-link, registration, payment, my-registrations, notifications inbox, home) needs the uat- accounts + player_profiles rows produced by Phase 2 registration. A profile-less account (needed for missing-profile + QR-missing edges) cannot be produced by normal signup — requires manual DB setup.
- ADMIN COACH-APPROVAL BEFORE COACH TOOLS: registering as coach only creates a pending role_requests row. account_roles.coach status='active' (granted via /admin/roles review_coach_request) is REQUIRED before CoachLinkPanel renders search, before searchCoachPlayers/requestCoachPlayerLink succeed, and before REG-08 (coach registers a linked player). Phase 3 must precede Phase 4 and the coach branch of Phase 6.
- APPROVED COACH LINK BEFORE COACH-REGISTERS-LINKED-PLAYER: REG-08 and the coach payment/my-registrations access cases require a coach_player_links row with status='approved' (coach->linked player), which only exists after PLAYER-01 (player approves the link) in Phase 4. A pending/rejected link does not grant registration or access rights.
- TOURNAMENT CREATED + OPEN + ACTIVE DIVISION + INSIDE WINDOW BEFORE REGISTRATION: create_registration_transaction RPC (202606080003) hard-enforces tournament.status='open', now within [registration_opens_at, registration_closes_at] (NULL = unbounded), and division.status='active'. The register PAGE also requires getIsRegistrationOpen. So Phase 5 (create draft -> add active divisions -> set status open with a valid window) MUST complete before any Phase 6 registration. Draft/closed/future/past-window tournaments are reachable as pages but the RPC rejects forced submits.
- FULL DIVISION (FILLED TO QUOTA) BEFORE WAITING-LIST CASES: REG-21/22/31, PAY-04, WAIT-01/02, TIMEOUT-01 all need a division at max_players with reserved (pending_payment+pending_verify+confirmed) >= max_players so the next register lands as waiting_list. Quota and waiting_list_position are produced by create_registration_transaction, so you must register filler players first (Phase 6) before the waitlist-dependent cases.
- PAID REGISTRATION (pending_payment ORDER) BEFORE PAYMENT/SLIP: PAY-01..10 and SLIP-01..11 need a payment_orders row in pending_payment with a future expires_at — produced only by a paid-division registration in Phase 6. Free/full-discount registrations create NO order (confirmed directly), so they cannot feed the payment suite.
- SLIP UPLOADED (pending_verify ORDER) BEFORE ADMIN VERIFY: /admin/payments queue and PAY-02/03/04 admin actions require an order in pending_verify, which exists only after a user uploads a slip (SLIP-01) in Phase 7. Approve/Reject cannot be exercised on a pending_payment order.
- CONFIRMED/CANCELLED SLOT BEFORE WAITLIST PROMOTION: WAIT-01/02 (user cancel -> promote oldest waitlister) and PAY-04 (admin reject-cancel -> promote) require BOTH a cancellable confirmed/paid slot AND a waiting_list row behind it in the same full division. Set up the full division + waitlister (Phase 5/6) before the cancel/reject-cancel cases.
- OVERDUE pending_payment ORDER BEFORE TIMEOUT SWEEP: PAY-08/09 and TIMEOUT-01/02 need a pending_payment order with expires_at in the PAST (set directly in Supabase) — and ideally a waitlister behind a full division — before clicking Run-timeout-sweep, which expires it and promotes the next waitlister.
- REGISTRANTS WITH MIXED STATUSES BEFORE TOURNAMENT-AUDIENCE NOTIFICATIONS: MNOT-09/10 and MNOT-PREVIEW-PARITY resolve recipients from registrations (owner + registered_by, excluding cancelled/expired/rejected). They require Phase 6/8 to have produced registrations across included AND excluded statuses, including a coach/admin-registered row (player_profiles.account_id != registered_by_account_id) to exercise the owner+registered_by dedupe.
- ADMIN-SENT NOTIFICATION BEFORE UNREAD-COUNT ENTRY POINTS: PROF-04, HOME-08, MNOT-18/19 (unread pills/tiles on /profile and Home) need a manual_notification_recipients row with read_at NULL addressed to the test account — created by an /admin/notifications send (Phase 9) before checking the counts.
- REFEREE INVITE CAPTURED ONCE BEFORE REDEEM: the raw REF-XXXX code is shown ONLY once at create time (/admin/roles, ROLE-INV-01). Capture it before reload; redeem cases (REF-REDEEM-01..07) and the revoked/expired/already-redeemed negatives all consume specific captured codes against a logged-in non-referee account. After a successful redeem the account holds the role, so re-testing redemption needs a different uat account.
- ADMIN ROUTES UNPROTECTED IN DEV: all /admin/* mutations run with p_admin_account_id=null (ensureAdminMutationAllowedForDevMode is a no-op), so no admin login is needed to drive setup steps (approve coach, approve rank, create invites, open tournaments, verify payments). This is what lets the orchestration phases use admin pages freely — but it also means the admin-auth gate itself cannot be tested in dev and must be flagged for production hardening.

---

<a id="suite-1"></a>
## 1. Auth & Registration

**40 cases** — P0 `11` / P1 `16` / P2 `13` · happy `8` / negative `14` / edge `18`

<sub>Authentication & Registration wizard</sub>

**Routes:** `/login` · `/register` · `/forgot-password` · `/reset-password` · `/auth/callback` · `POST /api/auth/login` · `POST /api/auth/logout` · `POST /api/auth/signup` · `POST /api/auth/forgot-password` · `POST /api/auth/update-password` · `POST /api/rank/search` · `GET /api/schools/search`

**Preconditions (suite-level):**
- Dev server running: npm run dev -- --hostname 127.0.0.1 --port 3000 ; base URL http://127.0.0.1:3000
- .env.local has NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY), and IDENTITY_HASH_SALT set (signup returns 500 'ยังไม่ได้ตั้งค่า SUPABASE_SECRET_KEY...' if the secret key is missing; signup throws 'Missing IDENTITY_HASH_SALT' if the salt is missing)
- User-facing pages (/login,/register,/forgot-password,/reset-password,/) render inside the mobile frame even on desktop
- All writes hit the REAL linked Supabase project (ref jiweobnsxpmgexipqzbx). Use an obvious uat- prefix for emails/names and clean up afterward
- Go DB has real rows: a known DAN name to test the matched path (handoff used 'โฆษา อารียา' -> 6 Dan, rating 1600). Pick a real first/last Thai name pair present in go_player_database for matched tests
- school_database has at least the 3 uploaded rows for institute autocomplete; use a query that returns a school to test selection
- A pre-existing logged-out browser session (clear cookies) before login/redirect tests
- To verify DB rows the tester (owner) must use Supabase dashboard/SQL on accounts, account_roles, role_requests, player_profiles tables

<details><summary><b>Test data ที่ต้องเตรียม</b></summary>

- uat-player-<timestamp>@example.com / password 'uat-pass-123' (>=8 chars) for happy-path player signup
- uat-coach-<timestamp>@example.com / 'uat-pass-123' for coach signup
- A real Thai first+last name that EXISTS in go_player_database with a DAN record (matched-verified path) e.g. handoff's 'โฆษา' / 'อารียา'
- A clearly fake Thai first+last name with no DB match (e.g. firstNameTh 'อัุยทดสอบ', lastNameTh 'ไม่มีจริง') for the self-declared/not_found path
- A valid 13-digit national ID-format string and a passport-format string (both unique, never used before) e.g. '1100700000001' / 'UAT1234567'
- A reused identity document value to trigger the duplicate-hash error (run a successful signup first, then reuse the same doc type+value)
- A second signup reusing an already-registered email to trigger duplicate-email error
- Thai phone string >=8 chars e.g. '0812345678'
- An institute search query that returns at least one school_database row, plus a custom institute name not in the DB

</details>

### Test cases

- [ ] **AUTH-01** · `P0` `happy` `player` — Login happy path with Remember = ON sets persistent (30-day) auth cookie
  - **Pre:**
    - A confirmed account exists (use the account from REG-01)
    - Browser logged out / cookies cleared
  - **Steps:**
    1. Open http://127.0.0.1:3000/login
    2. Enter the account email in อีเมล
    3. Enter the correct password in รหัสผ่าน
    4. Leave จดจำฉัน checkbox CHECKED (default is on)
    5. Click เข้าสู่ระบบ
  - **Expected:**
    - Button shows spinner 'กำลังเข้าสู่ระบบ...' then browser navigates to / (Home/Digital ID)
    - No error alert appears
    - POST /api/auth/login returns 200
    - In DevTools > Application > Cookies, the Supabase sb-*-auth-token cookie(s) have an Expires/Max-Age ~30 days in the future (persistent), not 'Session'
  - **DB:** accounts.last_login_at may update on session; primary check is cookie persistence, not a DB column
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **AUTH-02** · `P1` `edge` `player` — Login with Remember = OFF uses session cookie (no Max-Age)
  - **Pre:**
    - Same confirmed account
    - Browser logged out / cookies cleared
  - **Steps:**
    1. Open /login
    2. Enter correct email + password
    3. UNCHECK จดจำฉัน
    4. Click เข้าสู่ระบบ
  - **Expected:**
    - Navigates to / successfully
    - Supabase auth cookie shows Expires = 'Session' (no 30-day Max-Age), confirming remember=false path in createSupabaseRouteHandlerClient
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **AUTH-03** · `P0` `negative` `player` — Login with wrong password is rejected with Thai error and stays on /login
  - **Pre:**
    - A confirmed account exists
  - **Steps:**
    1. Open /login
    2. Enter the correct email
    3. Enter an INCORRECT password
    4. Click เข้าสู่ระบบ
  - **Expected:**
    - A red role=alert box shows 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
    - Still on /login, not redirected
    - POST /api/auth/login returns HTTP 401
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **AUTH-04** · `P1` `negative` `guest` — Login with malformed email is rejected by schema validation (400)
  - **Pre:**
    - Browser logged out
  - **Steps:**
    1. Open /login
    2. Type 'not-an-email' in อีเมล
    3. Type any password
    4. Click เข้าสู่ระบบ
  - **Expected:**
    - Error alert shows the Thai validation message (loginSchema email message 'อีเมลไม่ถูกต้อง' or generic fallback)
    - POST /api/auth/login returns HTTP 400
    - Stays on /login
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **AUTH-05** · `P2` `edge` `guest` — Show/hide password toggle reveals and re-masks the password field on /login
  - **Steps:**
    1. Open /login
    2. Type a password in รหัสผ่าน
    3. Click the eye icon button at the right edge of the password field
    4. Click it again
  - **Expected:**
    - First click: input type changes to text and the password becomes visible; aria-pressed=true; icon switches to EyeOff
    - Second click: field re-masks (type=password); aria-pressed=false
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **AUTH-06** · `P1` `edge` `player` — Authenticated user visiting /login is redirected to /
  - **Pre:**
    - Already logged in (complete AUTH-01 first)
  - **Steps:**
    1. While logged in, manually navigate to http://127.0.0.1:3000/login
  - **Expected:**
    - Immediately redirected to / (getCurrentAccount() truthy => redirect('/')) ; login form is not shown
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **AUTH-07** · `P1` `edge` `player` — Authenticated user visiting /register is redirected to /
  - **Pre:**
    - Already logged in
  - **Steps:**
    1. While logged in, navigate to http://127.0.0.1:3000/register
  - **Expected:**
    - Immediately redirected to /; register wizard is not shown
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **AUTH-08** · `P0` `happy` `player` — Logout clears the session and protected Home redirects back to /login
  - **Pre:**
    - Logged in
  - **Steps:**
    1. Trigger logout via the app's logout control (POST /api/auth/logout) or call the route
    2. After logout, navigate to /
  - **Expected:**
    - POST /api/auth/logout returns 200 {ok:true}
    - Supabase auth cookies are cleared (signOut)
    - Navigating to / redirects unauthenticated user to /login
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-01** · `P0` `happy` `player` — Full Player signup happy path (preset title, no middle name, matched-DAN rank, remember on)
  - **Pre:**
    - Logged out
    - A real Thai name present in go_player_database DAN source is known
  - **Steps:**
    1. Open /register (Step 1 Profile)
    2. Select คำนำหน้า = นาย (verify Title EN auto-maps to Mr. internally; dropdown shows 'นาย (Mr.)')
    3. Fill ชื่อไทย and นามสกุลไทย with the REAL Thai first/last name that exists in the DAN DB
    4. Fill First name EN / Last name EN
    5. Leave มีชื่อกลาง toggle OFF
    6. Tap วันเกิด, scroll the 3 wheels to a valid date, tap ยืนยัน
    7. Leave สัญชาติ = Thai (default); confirm the identity field label is 'เลขบัตรประชาชน'
    8. Enter a valid unique 13-digit national ID
    9. Enter เบอร์โทร (>=8 digits)
    10. CHECK the PDPA consent checkbox
    11. Click 'ถัดไป: ค้นหา Rank'
    12. On Step 2 (Rank) the green 'เจอข้อมูลในฐานข้อมูลจริง' panel appears with radio candidates; the first is preselected — keep it
    13. Click 'ถัดไป: เลือก Role'
    14. On Step 3 keep Player selected, click 'ถัดไป: ตั้งค่าบัญชี'
    15. On Step 4 summary shows Role: Player and 'Rank: <rank> (verified)'
    16. Enter a unique uat- email and a password >=8 chars
    17. Leave 'จดจำฉันหลังสมัคร' checked
    18. Click สมัครสมาชิก
  - **Expected:**
    - Step 1 -> Step 2 transition shows real matched candidates (status matched/multiple)
    - Step 4 summary shows '(verified)' rank because a DB candidate was chosen
    - Button shows 'กำลังสมัคร...' then navigates to / (auto-login succeeded)
    - POST /api/rank/search returned 200 matched/multiple; POST /api/auth/signup returned 200
  - **DB:** accounts: new row email=lowercased uat- email, phone set, active_role='player'. account_roles: role='player', status='active'. player_profiles: title_th='นาย', title_en='Mr.', rank_status='verified', rating non-null, matched_go_player_id set, identity_document_type='national_id', identity_document_hash is a 64-char hex (NOT the raw ID), pdpa_consent=true, pdpa_consent_at set. role_requests: NO row for this account.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-02** · `P0` `happy` `player` — Player signup with self-declared rank when name NOT found stores rank_status=pending
  - **Pre:**
    - Logged out
  - **Steps:**
    1. Open /register
    2. Complete Step 1 with a clearly fake Thai name not in the DB (e.g. ชื่อไทย 'ทดสอบไม่มีจริง'), valid DOB, Thai nationality, unique national ID, phone, PDPA checked
    3. Click 'ถัดไป: ค้นหา Rank'
    4. On Step 2 an amber 'ไม่พบชื่อในฐานข้อมูล DAN/KYU/AWARD' panel appears with a 'เลือกระดับฝีมือ' dropdown defaulting to '15 Kyu'
    5. Pick '5 Kyu' from the dropdown
    6. Click 'ถัดไป: เลือก Role', keep Player, continue to Account
    7. Verify Step 4 summary shows 'Rank: 5 Kyu (pending)'
    8. Enter unique email + password >=8, click สมัครสมาชิก
  - **Expected:**
    - Step 2 shows not_found self-declared UI
    - Summary shows '(pending)'
    - Navigates to / on success
    - POST /api/auth/signup returns 200
  - **DB:** player_profiles: rank='5 Kyu', rank_status='pending', power_level=12 (17-5), rating IS NULL, matched_go_player_id IS NULL, pdpa_consent=true. account_roles.player active. No role_requests row.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-03** · `P0` `happy` `coach` — Coach signup grants ACTIVE player role immediately plus a PENDING coach role_request
  - **Pre:**
    - Logged out
  - **Steps:**
    1. Open /register, complete Step 1 with a self-declared (not-found) name, valid data, PDPA checked
    2. Step 2: pick any self rank (e.g. '1 Dan')
    3. Step 3: click the Coach card; verify the amber note 'หลังสมัครคุณจะได้ role Player ทันที ส่วนสิทธิ์ Coach จะเป็น pending' appears
    4. Continue to Step 4; verify summary shows 'Role: Coach pending + Player' and 'Rank: 1 Dan (pending)'
    5. Enter unique uat-coach email + password, click สมัครสมาชิก
  - **Expected:**
    - Step 4 summary explicitly shows 'Coach pending + Player'
    - Navigates to / on success
    - POST /api/auth/signup returns 200 with body coachPending:true
  - **DB:** account_roles: role='player' status='active' (NO coach row in account_roles). role_requests: requested_role='coach', status='pending', reason='สมัครเป็น Coach ในขั้นตอนสมัครสมาชิก'. player_profiles.rank_status='pending' (self-declared 1 Dan, power_level=17).
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-04** · `P1` `edge` `player` — Self-declared 9 Dan still saves as rank_status=pending (no auto-verify for self path)
  - **Pre:**
    - Logged out
  - **Steps:**
    1. Register with a not-found name
    2. Step 2: choose the highest self rank '9 Dan'
    3. Continue and submit with a unique email
  - **Expected:**
    - Step 4 summary shows 'Rank: 9 Dan (pending)' even though it is the top rank
    - Signup succeeds
  - **DB:** player_profiles: rank='9 Dan', power_level=25 (16+9), rank_status='pending', rating NULL, matched_go_player_id NULL
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-05** · `P1` `edge` `player` — Custom title 'อื่น ๆ' reveals editable TH+EN inputs and persists both
  - **Pre:**
    - Logged out
  - **Steps:**
    1. Open /register Step 1
    2. Select คำนำหน้า = 'อื่น ๆ (โปรดระบุ)'
    3. Confirm a grouped inset appears with 'ไทย' (auto-focused) and 'อังกฤษ' inputs and helper text
    4. Type ไทย='ดร.' and อังกฤษ='Dr.'
    5. Fill the rest of the required fields, PDPA checked, and complete a self-declared signup with a unique email
  - **Expected:**
    - Selecting 'อื่น ๆ' clears the preset and shows the two custom inputs; ไทย field is focused on mount
    - Both custom title fields accept free text
    - Signup succeeds
  - **DB:** player_profiles.title_th='ดร.' and title_en='Dr.' (custom values saved, not a preset map)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-06** · `P2` `edge` `player` — Title EN auto-maps for each preset (นางสาว and เด็กหญิง both map to Miss)
  - **Pre:**
    - Logged out
  - **Steps:**
    1. On /register Step 1 select each preset in turn: นาย, นาง, นางสาว, เด็กชาย, เด็กหญิง
    2. For นางสาว complete a full self-declared signup (unique email)
  - **Expected:**
    - Dropdown labels render '<TH> (<EN>)' i.e. นาย (Mr.), นาง (Mrs.), นางสาว (Miss), เด็กชาย (Master), เด็กหญิง (Miss)
    - No custom inputs appear for presets
  - **DB:** For the นางสาว signup: player_profiles.title_th='นางสาว', title_en='Miss'. (Spot-check that เด็กหญิง would also map to 'Miss'.)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-07** · `P1` `negative` `player` — Middle name toggle ON requires BOTH TH and EN middle names
  - **Pre:**
    - Logged out
  - **Steps:**
    1. On Step 1 fill all required fields and PDPA
    2. Turn มีชื่อกลาง toggle ON; two fields appear (ชื่อกลางไทย, Middle name EN)
    3. Fill ชื่อกลางไทย but leave Middle name EN blank
    4. Click 'ถัดไป: ค้นหา Rank'
  - **Expected:**
    - Red role=alert shows 'กรุณากรอกชื่อกลาง TH/EN หรือปิดสวิตช์ชื่อกลาง'
    - Wizard stays on Step 1 (no rank search call)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-08** · `P2` `edge` `player` — Middle name toggle OFF clears any previously typed middle-name values
  - **Pre:**
    - Logged out
  - **Steps:**
    1. Turn มีชื่อกลาง ON, type ชื่อกลางไทย and Middle name EN
    2. Turn the toggle OFF
    3. Complete the rest of a valid self-declared signup with a unique email
  - **Expected:**
    - Toggling OFF hides the two middle-name fields and clears their state (handleMiddleToggle resets to '')
  - **DB:** player_profiles.middle_name_th IS NULL and middle_name_en IS NULL (RPC stores nullif(trim,'') for empty)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-09** · `P0` `negative` `player` — PDPA consent unchecked blocks progressing past Step 1
  - **Pre:**
    - Logged out
  - **Steps:**
    1. Fill every required Step 1 field correctly but leave the PDPA consent checkbox UNCHECKED
    2. Click 'ถัดไป: ค้นหา Rank'
  - **Expected:**
    - Red role=alert shows 'กรุณายอมรับเงื่อนไข PDPA ก่อนดำเนินการต่อ'
    - No /api/rank/search call; wizard stays on Step 1
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-10** · `P1` `negative` `player` — Server-side PDPA rejection (defense in depth) if consent=false reaches signup
  - **Pre:**
    - Logged out; tester comfortable using DevTools/network to POST directly
  - **Steps:**
    1. Construct a POST /api/auth/signup body identical to a valid one but with profile.pdpaConsent=false (e.g. via DevTools console fetch)
    2. Send the request
  - **Expected:**
    - Request is rejected: signupSchema's pdpaConsent.refine(value===true) returns HTTP 400 with the Thai message 'กรุณายอมรับเงื่อนไข PDPA'
    - No auth.users / accounts row is created
  - **DB:** No new accounts/player_profiles row for that email
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-11** · `P1` `negative` `player` — Missing required profile field (e.g. blank phone) blocks Step 1 with the field-specific Thai error
  - **Pre:**
    - Logged out
  - **Steps:**
    1. Fill all Step 1 fields except leave เบอร์โทร blank, PDPA checked
    2. Click 'ถัดไป: ค้นหา Rank'
  - **Expected:**
    - validateProfile returns and alert shows 'กรุณากรอกเบอร์โทร'
    - Stays on Step 1. (Spot-check other required fields produce their own messages: missing title='กรุณาเลือกคำนำหน้า', missing DOB='กรุณาเลือกวันเกิด', missing identity value='กรุณากรอกเลขบัตรหรือ Passport', blank nationality='กรุณาเลือกสัญชาติ')
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-12** · `P2` `negative` `player` — Identity value too short (<6 chars) is accepted by client but rejected by signup schema
  - **Pre:**
    - Logged out
  - **Steps:**
    1. NOTE: client validateProfile only checks non-empty identityDocumentValue, so a 3-char value passes Step 1.
    2. Enter identity value 'ABC' (3 chars), complete all steps to Step 4, submit
  - **Expected:**
    - POST /api/auth/signup returns HTTP 400 with 'กรุณากรอกเลขเอกสาร' (playerProfileInputSchema requires min 6, trimmed)
    - Stays on Step 4 with the error alert
    - No account is created
  - **DB:** No accounts/player_profiles row created
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-13** · `P1` `edge` `player` — Nationality != Thai switches identity doc to Passport and clears the value
  - **Pre:**
    - Logged out
  - **Steps:**
    1. On Step 1 with default Thai nationality, type a national ID value
    2. Open the สัญชาติ searchable dropdown, search 'Japan', select 'Japanese'
    3. Observe the identity field
  - **Expected:**
    - Identity label changes from 'เลขบัตรประชาชน' to 'หมายเลขหนังสือเดินทาง (Passport)'
    - The previously typed national-ID value is CLEARED (handleNationalityChange resets value)
    - Input no longer has the 13-char numeric limit
  - **DB:** If a passport signup is completed: player_profiles.identity_document_type='passport', nationality='Japanese'
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-14** · `P2` `edge` `player` — Manual identity doc-type switch link toggles national_id <-> passport and clears value
  - **Pre:**
    - Logged out; nationality = Thai
  - **Steps:**
    1. With Thai nationality, type a national ID
    2. Click the link 'ไม่มีบัตรประชาชน? ใช้พาสปอร์ตแทน'
    3. Then click 'ใช้เลขบัตรประชาชนแทน' to switch back
  - **Expected:**
    - First click: label becomes Passport, value cleared, link text becomes 'ใช้เลขบัตรประชาชนแทน'
    - Second click: label returns to เลขบัตรประชาชน with 13-digit numeric input, value cleared again
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-15** · `P2` `edge` `player` — National ID input enforces numeric inputmode and 13-char max length
  - **Pre:**
    - Logged out; nationality = Thai
  - **Steps:**
    1. Focus the เลขบัตรประชาชน input
    2. Type/paste a 20-character string
  - **Expected:**
    - Field accepts at most 13 characters (maxLength=13)
    - On mobile/numeric keyboards inputMode='numeric' shows the digit keypad (placeholder 'เลขบัตร 13 หลัก')
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-16** · `P1` `edge` `player` — DOB wheel picker stores yyyy-mm-dd and clamps invalid day when month shortens
  - **Pre:**
    - Logged out
  - **Steps:**
    1. Tap วันเกิด to open the bottom sheet
    2. Scroll Day wheel to 31, Month to a 31-day month, Year to any year
    3. Now scroll Month to กุมภาพันธ์ (February) of a non-leap year
    4. Tap ยืนยัน
  - **Expected:**
    - Display shows dd/mm/yyyy format; the selected day is clamped to the month's max (e.g. Feb -> 28) via safeDay so no invalid date is produced
    - Closing/reopening preserves the chosen values
  - **DB:** player_profiles.date_of_birth (date) equals the confirmed clamped value (yyyy-mm-dd), matches dateOfBirth regex ^\d{4}-\d{2}-\d{2}$
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-17** · `P2` `edge` `player` — Nationality searchable dropdown filters and 'ไม่พบรายการ' on no match
  - **Pre:**
    - Logged out
  - **Steps:**
    1. Open the สัญชาติ dropdown
    2. Type 'kor' in the search box -> select 'Korean'
    3. Reopen, type 'zzzzz'
  - **Expected:**
    - Typing 'kor' filters to Korean (case-insensitive includes); selecting it closes the panel and sets the value with a check mark
    - Typing 'zzzzz' shows 'ไม่พบรายการ'
    - Clicking outside the dropdown closes it
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-18** · `P2` `happy` `player` — Institute autocomplete returns real school_database results and allows selection
  - **Pre:**
    - Logged out; school_database has matching rows
  - **Steps:**
    1. On Step 1 focus the สถาบัน (ไม่บังคับ) field
    2. Type a query (2+ chars) known to match a school row
    3. Wait for the debounced (~220ms) GET /api/schools/search?q=... to populate the dropdown
    4. Click a result
  - **Expected:**
    - Dropdown shows 'กำลังค้นหา...' then real school name(s) with keyword subtitles
    - Clicking a result fills the input with school.name and closes the panel (check mark on the selected one)
    - GET /api/schools/search returns 200 with results[]
  - **DB:** If signup completed: player_profiles.institute_name = the selected school name
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-19** · `P2` `edge` `player` — Institute allows a custom (not-in-DB) value (field is optional)
  - **Pre:**
    - Logged out
  - **Steps:**
    1. Type a custom institute name that returns no results (panel shows 'ไม่พบสถาบัน')
    2. Do NOT select anything; leave the typed value in the field
    3. Complete a valid self-declared signup with a unique email
  - **Expected:**
    - The typed custom institute text remains in the field and is submitted
    - Signup succeeds (instituteName is optional in schema)
  - **DB:** player_profiles.institute_name = the custom typed text (or NULL if left empty, since RPC stores nullif(trim,''))
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-20** · `P1` `edge` `player` — Multiple rank matches require explicit candidate selection before proceeding
  - **Pre:**
    - Logged out; a Thai name that returns 2+ candidates (status='multiple')
  - **Steps:**
    1. Complete Step 1 with a name that has multiple DB candidates
    2. On Step 2 the candidate radios appear; the first is preselected
    3. (If feasible) deselect to no candidate — note: code preselects candidates[0], so to test the guard, the tester can rely on the not_found vs multiple branching) — keep the first selected and click 'ถัดไป: เลือก Role'
  - **Expected:**
    - Step 2 shows the green real-DB panel with radio cards (source badge DAN/KYU/AWARD, rank, power, evidence bullets)
    - Proceeding with a selected candidate advances to Step 3; if selectedCandidateId were empty for a non-not_found result, alert 'กรุณาเลือก record ที่ตรงกับคุณ' would show
  - **DB:** player_profiles.matched_go_player_id = the selected candidate id, rank_status='verified'
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-21** · `P2` `edge` `player` — DAN priority: when a DAN record matches, only DAN candidates are returned
  - **Pre:**
    - Logged out; a name present in both DAN and KYU/AWARD sources
  - **Steps:**
    1. Search rank for a name known to exist as both a DAN player and a KYU/AWARD entry
  - **Expected:**
    - Step 2 candidates show only DAN source badges (matchGoPlayerRank returns DAN candidates and skips KYU/AWARD when DAN matches exist)
    - No KYU/AWARD candidate is mixed in for that search
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-22** · `P2` `edge` `player` — Back navigation between wizard steps preserves entered data
  - **Pre:**
    - Logged out
  - **Steps:**
    1. Fill Step 1, search rank to reach Step 2
    2. Click 'กลับไปแก้ Profile' to return to Step 1
    3. Verify all Step 1 fields still hold their values
    4. Advance again, on Step 3 click 'กลับไปเลือก Rank', on Step 4 click 'กลับไปเลือก Role'
  - **Expected:**
    - Each back button returns to the prior step with state intact (profile, selected candidate, role, credentials are component state and are not reset)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-23** · `P0` `negative` `player` — Duplicate identity document is rejected at signup with a clear message
  - **Pre:**
    - A successful signup (REG-01/REG-02) already used a specific national ID value
  - **Steps:**
    1. Start a NEW signup with a DIFFERENT email but reuse the SAME identity document type + value as a prior account
    2. Complete all steps and click สมัครสมาชิก
  - **Expected:**
    - POST /api/auth/signup returns HTTP 400 with 'เลขบัตร/Passport นี้ถูกใช้สมัครแล้ว กรุณารีเซ็ตรหัสผ่านหรือติดต่อ Admin' (unique violation on player_profiles_identity_document_hash_key)
    - The just-created Supabase auth user is deleted (rollback) so no orphan account remains
  - **DB:** No new accounts/player_profiles row created for the second email; auth.users has no leftover user for it (deleteUser rollback). Confirm identity stored only as identity_document_hash (64-hex), raw value never persisted.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-24** · `P0` `negative` `player` — Duplicate email is rejected at signup
  - **Pre:**
    - An account already exists for a given email
  - **Steps:**
    1. Start a new signup reusing an already-registered email (different identity doc + name)
    2. Complete all steps and submit
  - **Expected:**
    - POST /api/auth/signup returns HTTP 400; error shown is either the Supabase createUser duplicate-email message or 'อีเมลนี้ถูกใช้สมัครแล้ว กรุณาเข้าสู่ระบบหรือรีเซ็ตรหัสผ่าน' (accounts_email_key)
    - No second account/profile is created
  - **DB:** accounts has exactly one row for that email; no duplicate player_profiles
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-25** · `P1` `negative` `player` — Weak password (<8 chars) rejected at signup; missing email/password blocked client-side
  - **Pre:**
    - Logged out
  - **Steps:**
    1. Reach Step 4 with all valid prior data
    2. Leave email or password blank and click สมัครสมาชิก (client guard)
    3. Then enter a valid email but a 5-char password and click สมัครสมาชิก
  - **Expected:**
    - Blank case: client shows 'กรุณากรอกอีเมลและรหัสผ่าน' with no network call
    - Short password: POST /api/auth/signup returns HTTP 400 with 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'
    - No account created in either case
  - **DB:** No new accounts row for that email
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-26** · `P2` `edge` `player` — Account-step password show/hide toggle and remember-after-signup checkbox
  - **Pre:**
    - Logged out
  - **Steps:**
    1. On Step 4 type a password
    2. Click the eye toggle in the รหัสผ่าน field
    3. Toggle 'จดจำฉันหลังสมัคร' off then on
  - **Expected:**
    - Password reveals/masks via the eye button (aria-pressed flips)
    - Remember checkbox default is ON; unchecking sets remember=false in the signup payload (controls cookie persistence after auto-login)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **AUTH-09** · `P0` `happy` `guest` — Forgot-password sends a reset link and shows success status
  - **Pre:**
    - A real registered email the tester can access (or owner inbox)
  - **Steps:**
    1. Open /forgot-password
    2. Enter a registered email
    3. Click ส่งลิงก์รีเซ็ต
  - **Expected:**
    - Green role=status box shows 'ส่งลิงก์รีเซ็ตรหัสผ่านแล้ว กรุณาเช็กอีเมล'
    - POST /api/auth/forgot-password returns 200 {ok:true}
    - A Supabase reset email arrives whose link points to /auth/callback?next=/reset-password
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **AUTH-10** · `P1` `negative` `guest` — Forgot-password with malformed email returns 400 and shows error
  - **Steps:**
    1. Open /forgot-password
    2. Enter 'bad-email' (no @)
    3. Click ส่งลิงก์รีเซ็ต
  - **Expected:**
    - Red role=alert shows 'อีเมลไม่ถูกต้อง'
    - POST /api/auth/forgot-password returns HTTP 400
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **AUTH-11** · `P0` `happy` `player` — Reset-password full flow: callback exchanges code then update-password succeeds
  - **Pre:**
    - A reset email from AUTH-09 is available
  - **Steps:**
    1. Click the reset link in the email -> lands on /auth/callback?code=...&next=/reset-password which exchanges the code and redirects to /reset-password
    2. On /reset-password enter a new password (>=8) in รหัสผ่านใหม่ and the SAME value in ยืนยันรหัสผ่านใหม่
    3. Click บันทึกรหัสผ่านใหม่
  - **Expected:**
    - GET /auth/callback redirects to /reset-password with a valid recovery session cookie set
    - POST /api/auth/update-password returns 200, then app navigates to /
    - Logging out and back in with the NEW password succeeds (and the old password now fails)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **AUTH-12** · `P1` `negative` `player` — Reset-password mismatch is blocked client-side before any request
  - **Pre:**
    - On /reset-password with a valid recovery session
  - **Steps:**
    1. Enter 'newpass123' in รหัสผ่านใหม่
    2. Enter 'different99' in ยืนยันรหัสผ่านใหม่
    3. Click บันทึกรหัสผ่านใหม่
  - **Expected:**
    - Red role=alert shows 'รหัสผ่านทั้งสองช่องไม่ตรงกัน'
    - No POST /api/auth/update-password call is made
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **AUTH-13** · `P1` `negative` `guest` — Update-password without a valid recovery/login session is rejected (401)
  - **Pre:**
    - Logged out / no recovery session (clear cookies)
  - **Steps:**
    1. Navigate directly to /reset-password without going through the email callback
    2. Enter matching valid passwords and click บันทึกรหัสผ่านใหม่
  - **Expected:**
    - POST /api/auth/update-password returns HTTP 401 (supabase.auth.updateUser has no authenticated user); a red error alert is shown with the Supabase error message
    - No redirect to /
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **AUTH-14** · `P2` `negative` `player` — Reset-password short new password (<8) is rejected by schema
  - **Pre:**
    - On /reset-password with a valid recovery session
  - **Steps:**
    1. Enter '123' in both new-password fields (they match)
    2. Click บันทึกรหัสผ่านใหม่
  - **Expected:**
    - POST /api/auth/update-password returns HTTP 400 with 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' (updatePasswordSchema min 8)
    - Error alert shown, no redirect
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

> ⚠️ **ข้อสังเกตจากโค้ด (อ่านก่อนเทส suite นี้):**
> - Referee role cannot be chosen in the register wizard at all: RoleStep only renders Player and Coach. Referee is granted separately via an Admin invite code at /referee/invite (redeem_referee_invite). Admin role is seeded manually. So no AUTH/REG case can self-register as referee or admin — this matches the spec.
> - POSSIBLE GAP: client-side validateProfile() only checks that identityDocumentValue is non-empty (.trim()), but the server schema requires min 6 chars. A 1-5 char value passes Step 1 and only fails at the final /api/auth/signup with 'กรุณากรอกเลขเอกสาร' (covered by REG-12). There is also no national-ID format/length/checksum validation beyond maxLength=13 on the input element — a 5-digit national ID is accepted as long as it is >=6 chars overall... note 13-digit IDs are >6 so fine; the gap is only the 1-5 char window.
> - POSSIBLE UX GAP: in the rank step, for status 'matched'/'multiple' the wizard always preselects candidates[0] (setSelectedCandidateId to first id). The guard 'กรุณาเลือก record ที่ตรงกับคุณ' in goToRoleStep can only fire if selectedCandidateId is empty, which won't happen for a non-empty candidate list. The radios have no native deselect, so REG-20's empty-selection branch is effectively unreachable from the UI; documented as designed.
> - Forgot-password endpoint returns {ok:true} success for ANY syntactically valid email (Supabase resetPasswordForEmail does not error on unknown emails by design), so AUTH-09 success text appears even for a non-existent address — this is intended anti-enumeration behavior, not a bug.
> - Identity privacy confirmed in code: hashIdentityDocument() salts with IDENTITY_HASH_SALT and stores SHA-256 hex in player_profiles.identity_document_hash (unique). The raw national ID / passport number is never persisted; migration 202606010004 also revokes direct client updates to accounts/player_profiles. Testers should verify in Supabase that identity_document_hash is a 64-char hex string and that no raw ID column exists.
> - Self-declared rank power levels: Kyu power = 17 - kyu (15 Kyu=2 ... 1 Kyu=16); Dan power = 16 + dan (1 Dan=17 ... 9 Dan=25). selfDeclaredRankOptions = 15 Kyu..1 Kyu then 1 Dan..9 Dan. Self path always sets rank_status='pending', rating=NULL, matched_go_player_id=NULL regardless of how high the declared rank is (REG-04).
> - Cookie persistence: createSupabaseRouteHandlerClient applies maxAge=30 days only when remember=true; otherwise session cookie. Login default remember=true (LoginForm), signup default remember=true (RegisterWizard). update-password and auth/callback always use remember=true.
> - Signup is atomic with rollback: if complete_account_signup RPC fails (e.g. duplicate hash/email), the just-created auth.users row is deleted via adminClient.auth.admin.deleteUser. Verify no orphan auth user remains after duplicate tests.
> - If SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY is missing, /api/auth/signup returns HTTP 500 with a Thai 'ยังไม่ได้ตั้งค่า...' message before any user is created; if IDENTITY_HASH_SALT is missing, hashIdentityDocument throws (unhandled) -> 500. Worth a one-off env sanity check before running REG cases.
> - Cleanup guidance: each REG-* signup creates rows in auth.users, accounts, account_roles, player_profiles (and role_requests for coach). Delete the auth.users row (cascades to accounts -> account_roles/role_requests/player_profiles via ON DELETE CASCADE) to fully clean up a uat- test account. Use uat- email prefixes and obvious test names to find them.
> - DB write summary for verification (from complete_account_signup RPC + migration 202606010003/...0005): accounts(active_role='player'), account_roles(player/active), player_profiles(all profile fields + rank snapshot + pdpa_consent/pdpa_consent_at), and for coach an extra role_requests(coach/pending). Coach never gets account_roles.coach at signup — only a pending role_requests row.

---

<a id="suite-2"></a>
## 2. Profile & Coach Link

**22 cases** — P0 `8` / P1 `8` / P2 `6` · happy `10` / negative `7` / edge `5`

**Routes:** `/profile` · `/notifications` · `/login` · `/register` · `/admin/roles (coach activation precondition)` · `/admin/users (DB verification helper, read-only)`

**Preconditions (suite-level):**
- Local dev server running: npm run dev -- --hostname 127.0.0.1 --port 3000 (base URL http://127.0.0.1:3000).
- All writes hit the REAL linked Supabase dev project. Use an obvious uat- prefix on every test account email and name (e.g. uat-player-a@example.com, first_name_en 'uat Player A') and clean up afterwards.
- At least 3 test accounts created via /register: (A) a PLAYER account that owns a Player Profile (the link target/owner), (B) a COACH account whose coach role is ACTIVE, (C) a second PLAYER or non-coach account for negative tests. Registration only offers player or coach; referee/admin are out of scope here.
- Coach activation: registering as coach creates a pending role_requests row (requested_role='coach', status='pending'); the coach role is NOT active until an Admin approves it. To get account B to an ACTIVE coach, an Admin must approve via review_coach_request (e.g. through /admin/roles). Until then account B's Coach Links panel shows the pending/contact-Admin messaging.
- All test player accounts must have a completed Player Profile (player_profiles row) so they appear in coach search and so getCoachLinkDashboard returns links. The owning Player must know their own Player Profile ID (player_profiles.id, a UUID) and exact email to exercise the search-by-id / search-by-email paths.
- Because pages are unauthenticated-redirect protected, each role's actions must be performed while logged in as that exact account; use separate browser profiles/incognito windows to hold concurrent sessions for coach and player.
- coach_player_links has a UNIQUE(coach_account_id, player_profile_id) constraint, so there is at most one link row per coach+player pair; status transitions in place (pending -> approved/rejected, and rejected/revoked -> pending on re-request).

<details><summary><b>Test data ที่ต้องเตรียม</b></summary>

- PLAYER account A (link target/owner): registered via /register as player, completed Player Profile. Record accounts.id, player_profiles.id (UUID), and exact email (uat-player-a@example.com). Used as search-by-id and search-by-email target and as the approver/rejecter.
- COACH account B with ACTIVE coach role: registered as coach, then coach role activated by an Admin (review_coach_request) so account_roles has role='coach', status='active'. B should also own a Player Profile to exercise the self-link negative cases (NEG-02, COACH-09).
- COACH account B' in PENDING state (registered as coach, NOT yet approved) for PROF-02 — can be the same account B observed before Admin approval, or a separate uat coach account.
- PLAYER/non-coach account C (no coach role, no pending coach request) for PROF-03, NEG-01, PLAYER-05.
- Optional second player X with a profile to create a second link so COACH-07 can show approved vs pending/rejected side by side.
- Optional: an Admin-sent manual notification to account A (manual_notification_recipients row, read_at NULL) so NOTIF/PROF-04 unread count is > 0.
- Optional: an inactive account (accounts.is_active=false) with a profile for COACH-09 / NEG-03 exclusion checks.
- Distinctive Thai names on the player profiles to exercise the normalize_thai_name partial-match search (COACH-03).

</details>

### Test cases

- [ ] **PROF-01** · `P0` `happy` `player` — View own Player Profile, rank status badge, and roles on /profile
  - **Pre:**
    - Logged in as a PLAYER account (A) with a completed Player Profile.
  - **Steps:**
    1. Open http://127.0.0.1:3000/profile in a desktop browser (renders inside the mobile frame).
    2. Observe the 'Player Profile' card.
    3. Observe the rank-status pill in the top-right of the Player Profile card.
    4. Observe the 'Rank' and 'Active role' info blocks.
    5. Observe the 'Roles' card listing each role with its status.
  - **Expected:**
    - Page returns 200 and renders inside the mobile shell titled 'Profile'.
    - Player Profile card shows profile.nameTh as the heading and profile.nameEn as the sub-line (first_name + last_name from player_profiles).
    - Rank-status pill reads 'verified' (green) when player_profiles.rank_status='verified', otherwise 'pending' (amber). Code: account.profile.rankStatus, defaulting to 'pending' text if null.
    - 'Rank' info block shows player_profiles.rank (or '-' if missing); 'Active role' shows accounts.active_role.
    - Institute line shows player_profiles.institute_name, or the placeholder 'ยังไม่ได้ระบุสถาบัน' when null/empty.
    - 'Roles' card lists one row per account_roles entry, each showing role (capitalized) and status.
  - **DB:** player_profiles (account_id = A): first_name_th/last_name_th/first_name_en/last_name_en/rank/rank_status/institute_name match the rendered card; account_roles (account_id = A) rows match the Roles card.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **PROF-02** · `P0` `happy` `coach` — Pending Coach state shows 'waiting for Admin' messaging and hides Coach tools
  - **Pre:**
    - Logged in as account B that registered as coach but whose coach role is NOT yet active (a pending role_requests row with requested_role='coach', status='pending' exists; no active account_roles.coach row).
  - **Steps:**
    1. Open http://127.0.0.1:3000/profile.
    2. Scroll to the 'Coach Links' card at the bottom.
  - **Expected:**
    - The 'Coach Links' card renders the pending message: 'สิทธิ์ Coach ยังรอ Admin อนุมัติ หลังอนุมัติแล้วจึงจะค้นหาและส่งคำขอ link Player ได้' (because isActiveCoach=false AND hasPendingCoachRequest=true).
    - No 'Find player' search form, no Search input, and no 'Linked players' section are rendered (CoachLinkPanel early-returns for non-active coaches).
  - **DB:** role_requests (account_id = B, requested_role='coach', status='pending') exists; no account_roles row with role='coach' AND status='active' for B. getHasPendingCoachRequest queries exactly this row.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **PROF-03** · `P1` `happy` `player` — Non-coach with no pending request sees 'no active coach right' messaging
  - **Pre:**
    - Logged in as a PLAYER account (C) that never requested a coach role (no pending coach role_requests row, no active coach account_role).
  - **Steps:**
    1. Open http://127.0.0.1:3000/profile.
    2. Scroll to the 'Coach Links' card.
  - **Expected:**
    - The Coach Links card shows: 'บัญชีนี้ยังไม่มีสิทธิ์ Coach active จึงยังส่งคำขอ link Player ไม่ได้' (isActiveCoach=false AND hasPendingCoachRequest=false).
    - No search form or coach tools are shown.
  - **DB:** No role_requests (account_id=C, requested_role='coach', status='pending'); no active account_roles.coach for C.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **PROF-04** · `P1` `happy` `player` — Notifications entry point on /profile shows correct unread count and links to /notifications
  - **Pre:**
    - Logged in as any account. Optionally have an Admin send this account a manual notification (manual_notification_recipients row) so unread > 0.
  - **Steps:**
    1. Open http://127.0.0.1:3000/profile.
    2. Read the 'Notifications' entry row near the top (BellRing icon).
    3. Note the 'N unread' pill value.
    4. Click the 'Notifications' row.
  - **Expected:**
    - The pill shows the count from getMyUnreadNotificationCount(), i.e. manual_notification_recipients rows for this user where read_at IS NULL, formatted with Thai locale digits, followed by ' unread'.
    - Clicking navigates to /notifications, which returns 200 and shows an 'Inbox summary' with matching 'Unread' value (rendered en-US there).
  - **DB:** manual_notification_recipients: COUNT(*) WHERE recipient = current user AND read_at IS NULL equals the displayed unread number on both /profile and /notifications.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **COACH-01** · `P0` `happy` `coach` — Active Coach searches an existing Player by exact email
  - **Pre:**
    - Logged in as account B with ACTIVE coach role.
    - A target Player account A exists with a completed profile and known exact email (e.g. uat-player-a@example.com); account A is active (accounts.is_active=true).
  - **Steps:**
    1. Open http://127.0.0.1:3000/profile.
    2. In the 'Find player' card, type the target player's exact email into the 'Player ID / email / name' input.
    3. Click 'Search'.
  - **Expected:**
    - A result card appears for player A showing nameTh, nameEn, '<rank> · <rankStatus>', and institute (or 'ไม่ระบุสถาบัน').
    - Status message turns green: 'พบ 1 รายการ' (or the count found).
    - A 'Send link request' button is enabled on the card (no existing link yet).
  - **DB:** RPC search_player_profiles_for_coach matched account A via lower(a.email)=lower(query); player_profiles row for A is the returned player_profile_id.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **COACH-02** · `P1` `happy` `coach` — Active Coach searches a Player by exact Player Profile ID (UUID)
  - **Pre:**
    - Logged in as active Coach B.
    - Known player_profiles.id (UUID) for target player A.
  - **Steps:**
    1. Open /profile, in 'Find player' paste the player_profiles.id UUID into the query input.
    2. Click 'Search'.
  - **Expected:**
    - The matching player A card is returned (RPC matches pp.id = query::uuid and orders UUID matches first).
    - Status message: 'พบ 1 รายการ'.
  - **DB:** search_player_profiles_for_coach returns the row whose player_profile_id equals the pasted UUID.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **COACH-03** · `P2` `edge` `coach` — Active Coach searches by Thai name with normalization (partial match)
  - **Pre:**
    - Logged in as active Coach B.
    - Target player A has a distinctive Thai first/last name.
  - **Steps:**
    1. Open /profile, type part of the player's Thai name (at least 2 characters) into the query input.
    2. Click 'Search'.
  - **Expected:**
    - Player A appears in results via the normalize_thai_name LIKE match (the RPC normalizes both stored name and query: collapses whitespace, maps ศษณญภฎฏฑใ->สสนยพดตทไ, strips ์).
    - Up to 5 results are returned (p_limit=5).
    - Status message shows the count, e.g. 'พบ N รายการ'.
  - **DB:** normalize_thai_name(stored name) LIKE '%' || normalize_thai_name(query) || '%' is true for player A.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **COACH-04** · `P0` `happy` `coach` — Active Coach sends a pending link request to a Player
  - **Pre:**
    - COACH-01 search succeeded; result card for player A has an enabled 'Send link request' button and no prior link exists between B and A.
  - **Steps:**
    1. On player A's search result card, click 'Send link request'.
    2. Wait for the action to complete (button shows a spinner, then page refreshes).
  - **Expected:**
    - An action status line appears: 'ส่งคำขอ link ไปยัง Player แล้ว' (green).
    - After refresh, a 'Link requests' section appears for the coach containing player A with a 'pending' badge (amber).
    - If the same search is repeated, the card now shows a 'pending' status badge and the button reads 'Request exists' and is disabled.
  - **DB:** coach_player_links: a row exists with coach_account_id=B, player_profile_id=A's profile id, status='pending', requested_at set, responded_at NULL, revoked_at NULL. Created by request_coach_player_link RPC.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **COACH-05** · `P1` `edge` `coach` — Duplicate / repeat link request reuses the same pending row (no second row, idempotent)
  - **Pre:**
    - COACH-04 done: a pending link B->A already exists.
  - **Steps:**
    1. As Coach B, search for player A again.
    2. Note the card now shows 'pending' badge and 'Request exists' (button disabled) — confirming UI dedupe.
    3. (Optional, to exercise the RPC directly) If you can force a second request to the same player (e.g. via an existing rejected/revoked link), observe the result.
  - **Expected:**
    - No new pending request can be sent from the UI because the button is disabled when existingLinkStatus is 'pending' or 'approved' (alreadyLinked).
    - At the RPC level, request_coach_player_link returns the existing row id without inserting when status is already 'pending' or 'approved', so there is never a duplicate row (also enforced by UNIQUE(coach_account_id, player_profile_id)).
  - **DB:** coach_player_links has exactly ONE row for (B, A's profile); requested_at unchanged when the existing status was pending/approved (no new insert).
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **COACH-06** · `P2` `edge` `coach` — Re-requesting after rejection/revocation resets the existing row back to pending
  - **Pre:**
    - A coach_player_links row for (B, A) exists with status 'rejected' or 'revoked' (e.g. after PLAYER-02).
  - **Steps:**
    1. As active Coach B, search for player A again.
    2. Confirm the card shows a 'rejected' (or 'revoked') badge and the 'Send link request' button is ENABLED (alreadyLinked is false for rejected/revoked).
    3. Click 'Send link request'.
  - **Expected:**
    - Action status: 'ส่งคำขอ link ไปยัง Player แล้ว'.
    - The link returns to 'pending' on refresh.
    - Still only one row exists for the pair.
  - **DB:** coach_player_links row (B, A): status updated to 'pending', requested_at refreshed to now(), responded_at reset to NULL, revoked_at reset to NULL (request_coach_player_link update branch). Row id is unchanged; no duplicate row.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **COACH-07** · `P0` `happy` `coach` — Coach sees approved linked players separately from pending/rejected requests
  - **Pre:**
    - At least one link B->A is 'approved' (after PLAYER-01) and at least one other link B->X is 'pending' or 'rejected'.
  - **Steps:**
    1. As active Coach B, open /profile.
    2. Inspect the 'Linked players' card.
    3. Inspect the 'Link requests' card below it.
  - **Expected:**
    - 'Linked players' (CheckCircle2 header) lists only links with status='approved' (player A), each with an 'approved' green badge.
    - 'Link requests' (Clock header) lists only non-approved links (pending/rejected/revoked), each with the appropriate badge color (amber pending, red rejected/revoked).
    - Empty 'Linked players' shows 'ยังไม่มี Player ที่อนุมัติ link แล้ว'; the 'Link requests' card is hidden entirely when there are no non-approved links.
  - **DB:** coach_player_links rows for coach_account_id=B split by status: status='approved' appear under Linked players; all other statuses under Link requests.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **COACH-08** · `P2` `negative` `coach` — Search input below 2 characters is rejected (client + RPC validation)
  - **Pre:**
    - Logged in as active Coach B.
  - **Steps:**
    1. Open /profile, type a single character (e.g. 'a') into the 'Player ID / email / name' input.
    2. Click 'Search'.
  - **Expected:**
    - The action returns an error and the status line turns red showing 'กรุณากรอกอย่างน้อย 2 ตัวอักษร' (Zod min(2) on the trimmed query).
    - No results are rendered. (The RPC also independently raises 'Search query must be at least 2 characters' if reached.)
  - **DB:** No coach_player_links changes; no row created.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **COACH-09** · `P1` `edge` `coach` — Coach search excludes the coach's own Player Profile and inactive accounts
  - **Pre:**
    - Logged in as active Coach B, who also owns a Player Profile.
    - An inactive account (accounts.is_active=false) with a profile also exists, if testable.
  - **Steps:**
    1. As Coach B, search using a term that would match B's OWN name/email/profile id.
    2. Observe results.
    3. (If available) search a term matching an inactive account's profile.
  - **Expected:**
    - B's own Player Profile never appears in results (RPC filters pp.account_id <> p_coach_account_id).
    - Inactive accounts never appear (RPC requires a.is_active = true).
  - **DB:** search_player_profiles_for_coach result set excludes pp.account_id = B and any accounts.is_active=false.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **PLAYER-01** · `P0` `happy` `player` — Player owner approves an incoming Coach Link request
  - **Pre:**
    - A pending link from Coach B to player A exists (after COACH-04).
    - Logged in as the Player owner A.
  - **Steps:**
    1. Open http://127.0.0.1:3000/profile as player A.
    2. Scroll to the 'Coach requests' card.
    3. Confirm the pending pill count and that Coach B's card (nameTh, nameEn, email) is listed with a 'pending' badge.
    4. Click 'Approve' on Coach B's request.
  - **Expected:**
    - Button shows a spinner, then a green status line: 'อนุมัติ Coach Link แล้ว'.
    - After refresh, Coach B moves from the pending list into the 'Approved coaches' section with an 'approved' badge, and the 'pending' count decreases by 1.
  - **DB:** coach_player_links row (B, A's profile): status='approved', responded_at set to now(), updated_at refreshed. Done by respond_coach_player_link with p_decision='approved'.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **PLAYER-02** · `P0` `happy` `player` — Player owner rejects an incoming Coach Link request
  - **Pre:**
    - A pending link from Coach B to player A exists.
    - Logged in as Player owner A.
  - **Steps:**
    1. Open /profile as player A, find Coach B's pending request in 'Coach requests'.
    2. Click 'Reject'.
  - **Expected:**
    - Green status line: 'ปฏิเสธ Coach Link แล้ว'.
    - After refresh, Coach B's request no longer appears in the pending list (it is not approved, so it is not shown under 'Approved coaches' either) and the pending count decreases by 1.
  - **DB:** coach_player_links row (B, A's profile): status='rejected', responded_at set, updated_at refreshed.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **PLAYER-03** · `P2` `edge` `player` — Player with no incoming requests sees the empty state
  - **Pre:**
    - Logged in as a Player account with no coach_player_links rows targeting their profile.
  - **Steps:**
    1. Open /profile.
    2. Inspect the 'Coach requests' card.
  - **Expected:**
    - Pending pill shows '0 pending'.
    - Body shows 'ยังไม่มีคำขอ Coach Link ที่รออนุมัติ'.
    - No 'Approved coaches' subsection is rendered.
  - **DB:** No coach_player_links rows where player_profile_id = this account's profile id.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **PLAYER-04** · `P2` `negative` `player` — Approving/rejecting an already-responded request fails gracefully
  - **Pre:**
    - A link B->A already has status 'approved' or 'rejected' (after PLAYER-01/02).
    - Logged in as Player A.
  - **Steps:**
    1. This double-action is normally prevented by the UI (only pending links render Approve/Reject buttons). To exercise the guard, attempt a second response on the same link (e.g. re-trigger the action before refresh, or via repeated rapid clicks).
    2. Observe the result.
  - **Expected:**
    - The action returns an error; the status line turns red. The underlying RPC respond_coach_player_link raises 'Coach link request is already approved' (or 'rejected'), because it only updates rows whose status is currently 'pending'.
    - No state corruption occurs; the link keeps its prior status.
  - **DB:** coach_player_links row status is unchanged from its prior approved/rejected value; no extra rows.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **PLAYER-05** · `P1` `negative` `player` — Player cannot respond to a link that belongs to a different player profile
  - **Pre:**
    - A pending link exists targeting player A's profile.
    - Logged in as a DIFFERENT player account C (not the link's player owner).
  - **Steps:**
    1. As account C, this link does not appear in C's 'Coach requests' (server only loads incomingLinks where player_profile_id = C's own profile).
    2. To exercise the server guard, attempt to call respondCoachPlayerLink with another player's linkId (e.g. via a crafted request).
  - **Expected:**
    - The link never appears in C's UI (getCoachLinkDashboard filters by C's own profile id).
    - If the action is forced with someone else's linkId, respond_coach_player_link raises 'Coach link request not found' because its query joins on pp.account_id = p_player_account_id; the action surfaces an error message.
  - **DB:** No coach_player_links row is modified by account C; the targeted link's status is unchanged.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **NEG-01** · `P0` `negative` `player` — Non-coach account cannot search or request a Coach Link
  - **Pre:**
    - Logged in as a player/non-coach account C (coach role not active).
  - **Steps:**
    1. Open /profile as account C.
    2. Confirm the Coach Links card shows the non-active messaging and no search form is rendered (UI gate).
    3. To exercise the server gate, attempt to invoke searchCoachPlayers / requestCoachPlayerLink directly (e.g. crafted form POST).
  - **Expected:**
    - No Find player form is shown in the UI (CoachLinkPanel early-returns when isActiveCoach is false).
    - If searchCoachPlayers is invoked, it returns status 'error' with message 'Coach role ยังไม่ active จึงยังส่งคำขอ link Player ไม่ได้' (server checks hasActiveCoachRole). The RPC independently raises 'Coach role is not active'.
    - If requestCoachPlayerLink is invoked, it returns the same 'Coach role ยังไม่ active...' error and creates no link.
  - **DB:** No coach_player_links row is created for account C as coach.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **NEG-02** · `P1` `negative` `coach` — Coach cannot link to their own Player Profile (self-link blocked)
  - **Pre:**
    - Logged in as active Coach B who also owns a Player Profile.
  - **Steps:**
    1. As Coach B, attempt to send a link request targeting B's own player_profiles.id (B's own profile is excluded from search results, so this requires forcing requestCoachPlayerLink with B's own profile id).
  - **Expected:**
    - The request fails: requestCoachPlayerLink returns status 'error' with the RPC message 'Coach cannot link to their own player profile' (request_coach_player_link raises this when pp.account_id = p_coach_account_id).
    - No link row is created.
  - **DB:** coach_player_links has NO row where coach_account_id = B AND player_profile_id = B's own profile id.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **NEG-03** · `P2` `negative` `coach` — Request to a non-existent or inactive player profile fails
  - **Pre:**
    - Logged in as active Coach B.
  - **Steps:**
    1. Force requestCoachPlayerLink with a random/invalid UUID, then with the id of an inactive account's profile (accounts.is_active=false).
  - **Expected:**
    - A non-UUID value is rejected by Zod (requestSchema .uuid()) with 'Player profile ไม่ถูกต้อง'.
    - A well-formed but unknown UUID, or an inactive player's profile id, is rejected by the RPC with 'Player profile not found' (request_coach_player_link requires the profile to exist and a.is_active=true).
    - No link row is created.
  - **DB:** No new coach_player_links row inserted for the invalid/inactive target.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **NEG-04** · `P1` `negative` `guest` — Unauthenticated user is redirected away from /profile and /notifications
  - **Pre:**
    - No active session (logged out / fresh incognito).
  - **Steps:**
    1. Open http://127.0.0.1:3000/profile.
    2. Open http://127.0.0.1:3000/notifications.
  - **Expected:**
    - /profile redirects to /login (getCurrentAccount returns null -> redirect('/login')).
    - /notifications redirects to /login for the same reason.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

> ⚠️ **ข้อสังเกตจากโค้ด (อ่านก่อนเทส suite นี้):**
> - Coach activation is a hard precondition not satisfiable from /register alone: registering as coach only inserts a pending role_requests row. The Coach Links tools (search + request) require account_roles.coach with status='active', which an Admin must grant (review_coach_request, surfaced at /admin/roles). Plan the coach test account around an Admin approval step first.
> - Self-link has defense in depth: the search RPC excludes the coach's own profile (pp.account_id <> p_coach_account_id), so NEG-02 cannot be reached via the normal UI at all — the 'Send link request' path for one's own profile is only reachable by forcing requestCoachPlayerLink with the coach's own profile id, where the RPC raises 'Coach cannot link to their own player profile'. Tester should note the UI never surfaces this case.
> - Duplicate-request idempotency is enforced at three layers: UI disables the button when existingLinkStatus is 'pending' or 'approved'; the RPC returns the existing row id without inserting for pending/approved; and a UNIQUE(coach_account_id, player_profile_id) DB constraint guarantees a single row per pair. There is no way to create two rows for the same coach+player.
> - Re-request after rejected/revoked is allowed and resets the SAME row to pending (requested_at refreshed, responded_at/revoked_at cleared) — it does not create a new row. UI reflects this because rejected/revoked are not treated as alreadyLinked, so the 'Send link request' button is enabled again.
> - Notifications subsystem here is only the unread-count entry point on /profile and the /notifications inbox. getMyUnreadNotificationCount and getMyNotifications run under the user's RLS client (createSupabaseServerComponentClient) and rely on manual_notification_recipients RLS to scope to the current user; the count is NOT filtered by an explicit user-id column in the query, so correct scoping depends on RLS — worth a deliberate check that one user never sees another's count.
> - Coach/player link notifications: there is NO automatic notification generated when a coach requests a link or a player approves/rejects (request_coach_player_link / respond_coach_player_link only mutate coach_player_links). The only notifications shown anywhere are manual Admin notifications. Do not expect a 'new coach request' notification to appear automatically.
> - /profile and the coach search depend on real player_profiles rows with all of first_name_th/last_name_th/first_name_en/last_name_en/rank/rank_status populated; a player account without a completed profile will not appear in coach search (RPC joins player_profiles) and getCoachLinkDashboard returns empty (account.profile null short-circuits).
> - The 'pending' count badge in 'Coach requests' and the unread notification pill use Thai-locale digit formatting (toLocaleString('th-TH')); /notifications uses en-US. Numbers may render as Thai numerals on /profile — not a bug.
> - Admin route /admin/users is read-only and a convenient way to verify Coach Link status counts and pending coach role requests without querying the DB directly, but it is not part of this subsystem's user flow.
> - Cleanup after testing: delete the coach_player_links rows, the player_profiles rows, role_requests, account_roles, accounts, and the underlying auth users for every uat- account created, plus any manual_notification_recipients/manual_notifications used for PROF-04.

---

<a id="suite-3"></a>
## 3. Tournament — Admin CRUD + Public

**32 cases** — P0 `8` / P1 `14` / P2 `10` · happy `9` / negative `11` / edge `12`

<sub>Tournament Admin CRUD + public browsing (create draft with divisions, banner upload, promo codes, status transitions, delete draft; public /tournaments list + detail + registration CTA gating)</sub>

**Routes:** `/admin/tournaments` · `/admin/tournaments/new` · `/admin/tournaments/[id]` · `/tournaments` · `/tournaments/[id]`

**Preconditions (suite-level):**
- Dev server running: npm run dev -- --hostname 127.0.0.1 --port 3000 (base URL http://127.0.0.1:3000).
- Migrations 202606040001_tournament_admin.sql and 202606040002_refactor_tournament_creation.sql applied (tables public.tournaments, public.divisions, public.promo_codes exist; tournament-banners Storage bucket exists, public, 2MB limit, mime jpeg/png/webp). If /admin/tournaments shows the orange 'Migration pending / Tournament tables are not on Supabase yet' panel, STOP and apply migrations first.
- Admin routes are NOT route-protected in dev mode (ensureAdminMutationAllowedForDevMode is a no-op), so open /admin/tournaments directly without an admin login.
- Service-role env (SUPABASE service role key) configured so admin server actions can write; NEXT_PUBLIC_SUPABASE_URL set so banner image host is allowed in next.config.ts remotePatterns.
- Have local image files ready for banner tests: a valid JPG/PNG/WebP under 2MB, an image just over 2MB but under 3MB, and a non-image file (e.g. .pdf or .gif) renamed/real.
- Use an OBVIOUS test prefix for all titles, e.g. 'uat-tournament-...', and clean up tournaments/divisions/promo_codes rows plus any tournament-banners Storage objects afterward.
- Admin pages are desktop layout; public /tournaments and /tournaments/[id] render inside the mobile frame even on desktop.

<details><summary><b>Test data ที่ต้องเตรียม</b></summary>

- Valid banner image < 2MB (JPG, PNG, or WebP).
- Image file slightly over 2MB and under 3MB (to hit the 2MB server validation, not Next bodySizeLimit).
- Image/file > 3MB (to hit Next serverActions bodySizeLimit of 3mb).
- A non-allowed type file (e.g. image/gif) to confirm rejection if the OS file picker allows selecting it.
- Test title prefix 'uat-' for every created tournament.
- Optional: a Supabase SQL console / Table editor session to verify rows in tournaments, divisions, promo_codes and the tournament-banners bucket.

</details>

### Test cases

- [ ] **TRN-HAPPY-01** · `P0` `happy` `admin` — Create a DRAFT tournament with two divisions in one form
  - **Pre:**
    - /admin/tournaments loads without the migration-pending panel
  - **Steps:**
    1. Open http://127.0.0.1:3000/admin/tournaments
    2. Click 'New tournament' (top right) -> lands on /admin/tournaments/new
    3. In 'ชื่องาน' (title) enter 'uat-tournament-A'
    4. Click the 'วันที่จัดงาน' wheel picker and pick a date about 30 days in the future; confirm
    5. Leave 'สถานที่จัดงาน (ลิงก์ Google Maps)' blank
    6. Set 'วัน-เวลาที่เปิดรับสมัคร': pick a date via wheel, then choose hour '09' and minute '00'
    7. Set 'วัน-เวลาที่ปิดรับสมัคร': pick a later date, hour '17', minute '00'
    8. In division 1: ชื่อรุ่นการแข่งขัน='uat-div-morning', ราคาค่าสมัคร='100', จำนวนที่รับสมัคร='16', Min Power='Open', Max Power='Open', Min Age='Open', Max Age='Open', ช่วงเวลาที่แข่งขัน='เช้า'
    9. Click 'เพิ่มรุ่น' to add division 2: ชื่อรุ่น='uat-div-afternoon', ราคา='0', จำนวน left blank (ไม่จำกัด), time slot='บ่าย'
    10. Click 'สร้างรายการพร้อมรุ่นแข่งขัน'
  - **Expected:**
    - Green success message 'Tournament draft created with divisions.' appears
    - An 'Open tournament' link appears; clicking it goes to /admin/tournaments/[id] showing both divisions
    - Tournament status shows 'draft'
  - **DB:** tournaments: 1 new row title='uat-tournament-A', status='draft', event_date set, registration_opens_at/closes_at set, banner_url NULL. divisions: 2 rows for this tournament_id, status='active', sort_order 0 and 1, div1 max_players=16 fee_amount=100.00 time_slot_label='เช้า', div2 max_players NULL fee_amount=0.00 time_slot_label='บ่าย', all power/age bounds NULL
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **TRN-HAPPY-02** · `P0` `happy` `admin` — Upload a valid banner (<2MB) and verify public URL stored + rendered
  - **Pre:**
    - A draft tournament from TRN-HAPPY-01 exists, or create a new one
  - **Steps:**
    1. Open /admin/tournaments/[id] for the draft, or use the create form
    2. Under 'Banner รูป' click the file input and select a valid JPG/PNG/WebP under 2MB
    3. Fill required fields (title + at least 1 division) if creating fresh
    4. Submit the form ('บันทึกรายการและรุ่นแข่งขัน' or 'สร้าง...')
    5. Change status to 'open' (so the public page is reachable) after ensuring an active division exists
    6. Open /tournaments/[id] in the mobile frame
  - **Expected:**
    - Form saves with success message
    - On /admin/tournaments/[id] a 'ดู banner เดิม' link appears pointing at the stored banner URL
    - On public /tournaments/[id] the 16:9 banner image renders at the top (Next/Image optimized)
    - No console error about un-allowed image host
  - **DB:** tournaments.banner_url = https://<supabase-host>/storage/v1/object/public/tournament-banners/<tournamentId>/<uuid>.<ext>; a corresponding object exists in the tournament-banners Storage bucket; banner_alt defaults to the title
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **TRN-HAPPY-03** · `P0` `happy` `admin` — Change status draft -> open with at least one active division
  - **Pre:**
    - A draft tournament with >=1 division (status active, which is the default) exists
  - **Steps:**
    1. Open /admin/tournaments/[id] for the draft
    2. In the Status section click the 'open' button
  - **Expected:**
    - Green message 'Tournament status changed to open.'
    - Status header updates to 'open'; the 'open' button becomes disabled
    - A 'Public detail' external link now appears in the page header
  - **DB:** tournaments.status='open', published_at set to now (non-null), cancelled_at NULL
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **TRN-HAPPY-04** · `P0` `happy` `guest` — Open tournament appears on public /tournaments list with banner and is clickable
  - **Pre:**
    - TRN-HAPPY-02/03 produced an open tournament with a banner
  - **Steps:**
    1. Open http://127.0.0.1:3000/tournaments (mobile frame)
    2. Locate the 'uat-tournament-A' card
    3. Click the card
  - **Expected:**
    - The open tournament card is listed with a green 'open' status badge and the event date + venue lines
    - Draft tournaments do NOT appear in this list
    - Clicking navigates to /tournaments/[id] showing banner, divisions list, and registration section
  - **DB:** Only status<>'draft' rows are returned by getPublicTournaments (verify draft is absent from the list)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **TRN-HAPPY-05** · `P0` `happy` `guest` — Public detail shows divisions with Open bounds rendered as 'Open' and CTA enabled
  - **Pre:**
    - Open tournament from TRN-HAPPY-03 with registration window currently active (opens_at in past, closes_at in future) and an active division with NULL power/age bounds
  - **Steps:**
    1. Open /tournaments/[id] for the open tournament
    2. Inspect the 'รุ่นแข่งขัน' section division cards
    3. Inspect the 'การสมัคร' section button
  - **Expected:**
    - Division card with NULL bounds shows 'Power Open - Open' and 'อายุ Open - Open'
    - Division with max_players NULL shows 'จำกัดคน: ไม่จำกัด'; fee 0 shows 'ฟรี'
    - The registration CTA renders as an enabled link 'สมัครแข่งขัน' linking to /tournaments/[id]/register (because status=open, window open, and an active division exists)
  - **DB:** divisions rows with min/max_power_level and min/max_age = NULL
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **TRN-HAPPY-06** · `P1` `happy` `admin` — Add a promo code (percentage) to the tournament
  - **Pre:**
    - A tournament exists with at least one division (for optional scope selection)
  - **Steps:**
    1. Open /admin/tournaments/[id]
    2. In the Promo Codes section's 'New promo code' form set Code='uat-promo10', Discount type='percentage', Discount value='10', leave Usage limit blank, leave Scope divisions unselected, keep Active checked
    3. Click 'Add'
  - **Expected:**
    - Green message 'Promo code added.'
    - A new PromoCodeForm card appears below pre-filled with code 'UAT-PROMO10' (uppercased)
  - **DB:** promo_codes: 1 row tournament_id matches, code='UAT-PROMO10', code_normalized='UAT-PROMO10', discount_type='percentage', discount_value=10.00, usage_limit NULL, division_ids NULL, is_active true, used_count 0
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **TRN-HAPPY-07** · `P1` `happy` `admin` — Edit an existing promo code (change to fixed discount + add usage limit + scope to one division)
  - **Pre:**
    - Promo code 'UAT-PROMO10' from TRN-HAPPY-06 exists; tournament has at least one division
  - **Steps:**
    1. Open /admin/tournaments/[id]
    2. In the existing promo card change Discount type='fixed', Discount value='50', Usage limit='100', select one division in 'Scope divisions'
    3. Click 'Save'
  - **Expected:**
    - Green message 'Promo code updated.'
  - **DB:** promo_codes row updated: discount_type='fixed', discount_value=50.00, usage_limit=100, division_ids contains the selected division id, updated_at refreshed
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **TRN-HAPPY-08** · `P1` `happy` `admin` — Edit tournament: update title and a division name in one save
  - **Pre:**
    - Tournament from TRN-HAPPY-01 exists (draft or open)
  - **Steps:**
    1. Open /admin/tournaments/[id]
    2. In the TournamentForm change 'ชื่องาน' to 'uat-tournament-A-edited'
    3. Change division 1 name to 'uat-div-morning-edited'
    4. Click 'บันทึกรายการและรุ่นแข่งขัน'
  - **Expected:**
    - Green message 'Tournament and divisions updated.'
    - Header/title reflects new name after reload
  - **DB:** tournaments.title='uat-tournament-A-edited', updated_at refreshed; divisions: existing div1 row updated in place (same id) name='uat-div-morning-edited'; div count unchanged; both divisions still status='active'
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **TRN-EDGE-01** · `P1` `edge` `admin` — Edit form removes a division -> stale division is deleted from DB
  - **Pre:**
    - Tournament with exactly two divisions exists
  - **Steps:**
    1. Open /admin/tournaments/[id]
    2. Click 'ลบรุ่น' on division 2 (the remove button is enabled because >1 division remains)
    3. Click 'บันทึกรายการและรุ่นแข่งขัน'
  - **Expected:**
    - Success message 'Tournament and divisions updated.'
    - Only one division card remains after reload
  - **DB:** divisions: the removed division row is DELETED (replaceTournamentDivisions deletes ids no longer in the submitted JSON); exactly 1 division row remains for this tournament_id
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **TRN-EDGE-02** · `P2` `edge` `admin` — Remove-last-division control is disabled (cannot submit zero divisions via UI)
  - **Pre:**
    - Create form open, or a tournament with a single division
  - **Steps:**
    1. Open /admin/tournaments/new (or a 1-division tournament's edit form)
    2. Observe the single division card's 'ลบรุ่น' button
  - **Expected:**
    - The 'ลบรุ่น' (remove) button is disabled when only one division is present (divisions.length===1), so the tester cannot reduce to zero divisions through the UI
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **TRN-EDGE-03** · `P1` `edge` `admin` — Boundary banner: file between 2MB and 3MB rejected with friendly 2MB message
  - **Pre:**
    - A valid-type image just over 2MB and under 3MB is available
  - **Steps:**
    1. Open /admin/tournaments/new (or edit)
    2. Select the 2-3MB image as the banner
    3. Fill title + one division
    4. Submit
  - **Expected:**
    - Red error message 'Banner image must be 2MB or smaller.' (server validation MAX_BANNER_BYTES)
    - No tournament row is left created from this attempt (create rolls back) — verify the title does not appear in the list
  - **DB:** No tournaments row with the test title; no orphan object in tournament-banners bucket
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **TRN-EDGE-04** · `P2` `edge` `admin` — Banner over Next bodySizeLimit (>3MB) hits request-size error, not the friendly message
  - **Pre:**
    - An image file larger than 3MB is available
  - **Steps:**
    1. Open /admin/tournaments/new
    2. Select the >3MB image as the banner
    3. Fill title + one division
    4. Submit
  - **Expected:**
    - The submission fails due to Next serverActions.bodySizeLimit='3mb' BEFORE the action runs; expect a generic/runtime error (server log 'Body exceeded 3mb limit' or a generic error UI), NOT the friendly 'Banner image must be 2MB or smaller.' message
    - Record exact UI behavior in notes if it differs
  - **DB:** No new tournaments row from this attempt
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **TRN-NEG-01** · `P0` `negative` `admin` — Submit create form with empty title -> validation error
  - **Pre:**
    - /admin/tournaments/new open
  - **Steps:**
    1. Leave 'ชื่องาน' empty
    2. Fill division 1 name and submit
  - **Expected:**
    - Browser HTML5 'required' validation blocks submit on the title input (it has required); if bypassed, server returns red error 'Event title is required.'
  - **DB:** No new tournaments row
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **TRN-NEG-02** · `P1` `negative` `admin` — Submit create form with no division name -> 'Division 1 name is required.'
  - **Pre:**
    - /admin/tournaments/new open
  - **Steps:**
    1. Enter title 'uat-tournament-noDivName'
    2. Leave division 1 'ชื่อรุ่นการแข่งขัน' empty
    3. Submit
  - **Expected:**
    - Red error message 'Division 1 name is required.'
  - **DB:** No new tournaments row (create rolls back)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **TRN-NEG-03** · `P1` `negative` `admin` — Invalid Google Maps URL (no http/https) -> rejected
  - **Pre:**
    - /admin/tournaments/new open
  - **Steps:**
    1. Enter title 'uat-tournament-badmap'
    2. Enter 'สถานที่จัดงาน (ลิงก์ Google Maps)' = 'maps.google.com/foo' (no scheme)
    3. Fill division 1 name and submit
  - **Expected:**
    - The input type='url' may trigger browser validation; if it passes, server returns red error 'Google Maps URL must start with http:// or https://.'
  - **DB:** No new tournaments row
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **TRN-NEG-04** · `P0` `negative` `admin` — Open a tournament with NO active division is blocked
  - **Pre:**
    - A draft tournament exists. Because the bulk form always writes status='active' divisions and you cannot remove the last division in the UI, set the tournament's only division status to 'closed' (or 'cancelled') directly in the DB to reach this state — see notes about this gap.
  - **Steps:**
    1. In Supabase, update the single division row for the draft tournament: status='closed'
    2. Open /admin/tournaments/[id] for that draft
    3. Click the 'open' status button
  - **Expected:**
    - Red error message 'Add at least one active division before opening registration.'
    - Status remains 'draft'
  - **DB:** tournaments.status still 'draft', published_at NULL; divisions count of status='active'=0 for this tournament
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **TRN-NEG-05** · `P1` `negative` `admin` — Banner with disallowed mime type rejected server-side
  - **Pre:**
    - A non-allowed image (e.g. .gif) available; in the OS file picker switch filter to 'All files' to select it past the accept attribute
  - **Steps:**
    1. Open /admin/tournaments/new
    2. In the banner file input switch the picker to 'All files' and select a .gif (image/gif)
    3. Fill title + division name and submit
  - **Expected:**
    - Red error 'Banner image must be JPG, PNG, or WebP.' (server ALLOWED_BANNER_TYPES); if the OS picker honors accept and won't let you pick the gif, note that the accept attribute filtered it (still a valid pass)
  - **DB:** No new tournaments row; no object uploaded to tournament-banners
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **TRN-NEG-06** · `P1` `negative` `admin` — Registration close before open -> validation error
  - **Pre:**
    - /admin/tournaments/new open
  - **Steps:**
    1. Enter title 'uat-tournament-badwindow'
    2. Set 'วัน-เวลาที่เปิดรับสมัคร' to a LATER date/time
    3. Set 'วัน-เวลาที่ปิดรับสมัคร' to an EARLIER date/time
    4. Fill division 1 name and submit
  - **Expected:**
    - Red error 'Registration close must be after open.'
  - **DB:** No new tournaments row
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **TRN-NEG-07** · `P1` `negative` `admin` — Duplicate promo code (case/space-insensitive) in same tournament rejected
  - **Pre:**
    - Promo code 'UAT-PROMO10' already exists on the tournament (TRN-HAPPY-06)
  - **Steps:**
    1. Open /admin/tournaments/[id]
    2. In the 'New promo code' form enter Code='uat-promo10' (or '  UAT PROMO10  ' with spaces), Discount type='percentage', value='5'
    3. Click 'Add'
  - **Expected:**
    - Red error message (generic action error surfaced from the Postgres unique violation on unique(tournament_id, code_normalized)); NO new promo card with this code is created
  - **DB:** promo_codes: still only ONE row with code_normalized='UAT-PROMO10' for this tournament
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **TRN-NEG-08** · `P2` `negative` `admin` — Percentage promo out of range (>100) rejected
  - **Pre:**
    - /admin/tournaments/[id] open
  - **Steps:**
    1. In the 'New promo code' form set Code='uat-promo-bad', Discount type='percentage', Discount value='150'
    2. Click 'Add'
  - **Expected:**
    - Red error 'Percentage discount must be between 1 and 100.'
  - **DB:** No promo_codes row with code_normalized='UAT-PROMO-BAD'
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **TRN-NEG-09** · `P2` `negative` `admin` — Fixed promo with zero/negative value rejected
  - **Pre:**
    - /admin/tournaments/[id] open
  - **Steps:**
    1. In the 'New promo code' form set Code='uat-promo-fixed0', Discount type='fixed', Discount value='0'
    2. Click 'Add'
  - **Expected:**
    - Red error 'Fixed discount must be greater than 0.'
  - **DB:** No promo_codes row with code_normalized='UAT-PROMO-FIXED0'
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **TRN-EDGE-05** · `P2` `edge` `admin` — Free promo code forces discount value 0
  - **Pre:**
    - /admin/tournaments/[id] open
  - **Steps:**
    1. In the 'New promo code' form set Code='uat-promo-free', Discount type='free', Discount value='999' (any number)
    2. Click 'Add'
  - **Expected:**
    - Green message 'Promo code added.' (free type ignores the entered value and stores 0)
  - **DB:** promo_codes row code_normalized='UAT-PROMO-FREE', discount_type='free', discount_value=0.00
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **TRN-NEG-10** · `P1` `negative` `admin` — Delete draft button is disabled for non-draft and refused server-side
  - **Pre:**
    - An OPEN tournament exists (e.g. TRN-HAPPY-03)
  - **Steps:**
    1. Open /admin/tournaments/[id] for the open tournament
    2. Observe the 'Delete draft' button in the Status section
  - **Expected:**
    - 'Delete draft' button is DISABLED because status!=='draft'
    - (If forced by removing the disabled attribute) the server action returns 'Only draft tournaments can be deleted.' and the tournament remains
  - **DB:** tournaments row for the open tournament still exists
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **TRN-HAPPY-09** · `P0` `happy` `admin` — Delete a DRAFT tournament (cascade removes divisions/promo codes)
  - **Pre:**
    - A DRAFT tournament with divisions (and optionally a promo code) exists; use a disposable uat- draft
  - **Steps:**
    1. Open /admin/tournaments/[id] for the draft
    2. Click 'Delete draft'
  - **Expected:**
    - Green message 'Draft tournament deleted.'
    - Returning to /admin/tournaments the deleted draft no longer appears
  - **DB:** tournaments row deleted; its divisions and promo_codes rows are also gone (FK on delete cascade); any banner Storage object is NOT auto-deleted by cascade (note: only the row is removed) — verify and clean the tournament-banners object manually if one was uploaded
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **TRN-NEG-11** · `P1` `negative` `guest` — Public detail returns 404 for a draft tournament id
  - **Pre:**
    - A DRAFT tournament id is known (copy from /admin/tournaments/[id] URL)
  - **Steps:**
    1. Open /tournaments/<draft-tournament-id> directly in the mobile frame
  - **Expected:**
    - Next notFound() 404 page (getPublicTournamentDetail excludes status='draft' via .neq('status','draft')); the draft is never viewable publicly
  - **DB:** Confirm that tournament's status='draft'
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **TRN-EDGE-06** · `P1` `edge` `guest` — CTA disabled when status is open but registration window not yet started
  - **Pre:**
    - Create an OPEN tournament whose registration_opens_at is in the FUTURE (set the open date/time later than now), with an active division
  - **Steps:**
    1. Set registration opens-at to a future date/time, save, change status to open
    2. Open /tournaments/[id]
  - **Expected:**
    - The 'การสมัคร' section shows the DISABLED grey button 'ยังไม่เปิดรับสมัคร' (getIsRegistrationOpen returns false because now < opensAt), not the active 'สมัครแข่งขัน' link
  - **DB:** tournaments.status='open', registration_opens_at in the future
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **TRN-EDGE-07** · `P1` `edge` `guest` — CTA disabled when registration window already closed
  - **Pre:**
    - An OPEN tournament whose registration_closes_at is in the PAST, with an active division
  - **Steps:**
    1. Set registration closes-at to a past date/time (you can set opens-at also in the past so it isn't a window-order error), save, ensure status open
    2. Open /tournaments/[id]
  - **Expected:**
    - The CTA shows the DISABLED grey button 'ยังไม่เปิดรับสมัคร' (now > closesAt)
  - **DB:** tournaments.status='open', registration_closes_at in the past
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **TRN-EDGE-08** · `P2` `edge` `guest` — Unbounded registration window (both opens_at and closes_at NULL) -> CTA enabled
  - **Pre:**
    - An OPEN tournament with registration_opens_at NULL and registration_closes_at NULL, with an active division
  - **Steps:**
    1. Create/edit a tournament leaving BOTH registration wheel/time fields blank
    2. Set status to open
    3. Open /tournaments/[id]
  - **Expected:**
    - The CTA is the ENABLED 'สมัครแข่งขัน' link (getIsRegistrationOpen treats NULL bounds as unbounded: opensAt===null and closesAt===null both pass)
  - **DB:** tournaments registration_opens_at NULL, registration_closes_at NULL, status='open'
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **TRN-EDGE-09** · `P2` `edge` `admin` — Empty states: no tournaments shows empty admin and public messaging
  - **Pre:**
    - A clean DB with zero tournaments (or before creating any uat- data)
  - **Steps:**
    1. Open /admin/tournaments
    2. Open /tournaments
  - **Expected:**
    - /admin/tournaments shows the dashed empty card 'ยังไม่มี tournament' with guidance to create a draft first
    - /tournaments shows the dashed empty card 'ยังไม่มีรายการที่เผยแพร่'
  - **DB:** tournaments table has zero non-draft rows for the public empty state
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **TRN-EDGE-10** · `P2` `edge` `guest` — Public detail with a tournament that has zero divisions shows empty-division note and disabled CTA
  - **Pre:**
    - An open/non-draft tournament with NO active division. Reaching this requires DB intervention since the form requires >=1 active division and open requires >=1 active. Create an open tournament, then in DB set its only division status='cancelled' (or delete the division row directly).
  - **Steps:**
    1. In DB, for an already-open tournament, delete its division row(s) (or set status non-active)
    2. Open /tournaments/[id]
  - **Expected:**
    - The 'รุ่นแข่งขัน' section shows 'ยังไม่มี division' / 'Admin ต้องเพิ่ม division ก่อนเปิดรับสมัคร' when there are zero division rows
    - The registration CTA is DISABLED ('ยังไม่เปิดรับสมัคร') because no active division exists
  - **DB:** divisions for this tournament: zero rows (or zero with status='active')
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **TRN-EDGE-11** · `P2` `edge` `admin` — Numeric window guard: division max power lower than min power rejected
  - **Pre:**
    - /admin/tournaments/new open
  - **Steps:**
    1. Enter title 'uat-tournament-powerflip'
    2. In division 1 set Min Power to a HIGH rank value and Max Power to a LOWER rank value (the power dropdown is ordered weakest->strongest; pick min stronger than max)
    3. Enter division name and submit
  - **Expected:**
    - Red error 'Division 1 max power must be at least min power.' (assertNumericWindow); also a DB CHECK divisions_power_window_check would block it
  - **DB:** No new tournaments row (create rolls back)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **TRN-EDGE-12** · `P2` `edge` `admin` — Cancel an open tournament sets cancelled_at and public badge turns red
  - **Pre:**
    - An OPEN tournament exists
  - **Steps:**
    1. Open /admin/tournaments/[id]
    2. Click the 'cancelled' status button
    3. Open /tournaments and /tournaments/[id]
  - **Expected:**
    - Message 'Tournament status changed to cancelled.'
    - Public list still SHOWS the tournament (cancelled is non-draft) with a red 'cancelled' badge
    - Public detail shows red cancelled badge and the registration CTA is disabled (status!=='open')
  - **DB:** tournaments.status='cancelled', cancelled_at set to now (non-null)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

> ⚠️ **ข้อสังเกตจากโค้ด (อ่านก่อนเทส suite นี้):**
> - VERIFIED: The main TournamentForm always submits each division with status='active' (hardcoded in actions.ts parseDivisionJson, line ~235) and timeSlotLabel defaulting to 'เช้า'. There is NO control in the bulk create/edit form to set a division to 'closed'/'cancelled'. The standalone DivisionForm component (which has a Status dropdown) is defined in tournament-forms.tsx but is NOT rendered anywhere on /admin/tournaments/[id] (the detail page only renders TournamentStatusActions, TournamentForm, PromoCodeForm). Consequence: to test the 'open blocked when no active division' rule you must either remove ALL divisions (not possible via UI — the form blocks removing the last division: the remove button is disabled when divisions.length===1) or set a division status to non-active directly in the DB. So OPEN-NO-ACTIVE-DIV is effectively only reachable via a DB edit. Flagged as a gap in TC TRN-NEG-04.
> - VERIFIED: Editing an existing tournament via TournamentForm REPLACES divisions (replaceTournamentDivisions). Divisions present in the form are kept/updated by id; any existing division whose id is NOT in the submitted JSON is DELETED. Because the edit form re-derives status='active' for every division on save, re-saving the edit form will reset any division previously set to closed/cancelled (e.g. via DB) back to active. Tester should be aware editing wipes manual division-status changes.
> - VERIFIED: Division status='active' is what both the public registration CTA (getIsRegistrationOpen requires divisions.some(status==='active')) and the open-status guard (setTournamentStatus counts status='active' divisions) rely on. Public detail DivisionCard shows division.status text but does NOT hide non-active divisions.
> - VERIFIED: Banner size is enforced in TWO places — Supabase bucket file_size_limit=2097152 AND server code maybeUploadTournamentBanner (>2MB -> 'Banner image must be 2MB or smaller.'). Also Next serverActions.bodySizeLimit='3mb' will reject the whole request before the action runs if the multipart body exceeds 3MB, giving a different/generic error rather than the friendly 2MB message. So a 2-3MB file yields the friendly message; a >3MB file yields a body-size/runtime error.
> - VERIFIED: Banner mime is restricted by the file input accept='image/jpeg,image/png,image/webp' AND server validation (non-allowed type -> 'Banner image must be JPG, PNG, or WebP.'). The accept attribute is only a filter; if the picker is switched to 'All files' a disallowed type still gets rejected server-side.
> - VERIFIED: googleMapsUrl must start with http:// or https:// else action error 'Google Maps URL must start with http:// or https://.' (parseTournamentInput). Banner URL (existingBannerUrl hidden field) must start with /, http://, or https:// — but this is a hidden field populated from the existing record, not directly tester-editable.
> - VERIFIED: Open/NULL bounds — leaving a power or age dropdown on the 'Open' option submits '' which parses to null; DB stores NULL; public detail formatNumberRange renders 'Open' for null min/max. RangePreview in the form shows 'Open' live.
> - VERIFIED: Registration window validation — registrationClosesAt must be >= registrationOpensAt or action error 'Registration close must be after open.' Also a DB CHECK constraint tournaments_registration_window_check enforces the same.
> - VERIFIED: Numeric window — division max power < min power (or max age < min age) is blocked client-impossible-to-trigger via dropdowns in normal order but enforced server-side: 'Division N max power must be at least min power.' / 'Division N max age must be at least min age.' Power dropdown values are derived from rank power levels (9x9=0, 13x13=1, then ranks); age dropdown is 0..100.
> - VERIFIED: Promo code is uppercased on save (toUpperCase) and DB has a generated code_normalized with a UNIQUE(tournament_id, code_normalized). A second promo with the same code (case/space-insensitive) in the same tournament will fail with a Postgres unique-violation surfaced as a generic action error (not a friendly message).
> - VERIFIED: Promo discount validation — percentage must be 1..100 ('Percentage discount must be between 1 and 100.'), fixed must be >0 ('Fixed discount must be greater than 0.'), free forces discountValue=0. DB CHECK promo_codes_discount_check mirrors this.
> - VERIFIED: setTournamentStatus sets published_at=now() and clears cancelled_at when going to 'open'; sets cancelled_at=now() when going to 'cancelled'. Status buttons available on detail: open, closed, in_progress, completed, cancelled. The current status button is disabled. Delete draft button is disabled unless status==='draft'.
> - VERIFIED: deleteDraftTournament refuses non-draft ('Only draft tournaments can be deleted.') and missing id ('Tournament not found.'); cascade deletes divisions/promo_codes via FK on delete cascade. The UI also disables the Delete button for non-draft, so the negative path is only reachable by editing the disabled attribute or a stale page.
> - VERIFIED: Public list getPublicTournaments filters status<>'draft'; ordering is by event_starts_at asc then created_at desc. event_starts_at is derived from event_date at +07:00. Public detail getPublicTournamentDetail also excludes draft (returns 404/notFound for draft id). Public detail promoCodes is always [] (promo codes never shown publicly).
> - POTENTIAL ISSUE: Public list/detail StatusBadge has no explicit style for 'closed'/'in_progress'/'completed'; they fall through to the default amber style. Not a bug, just cosmetic — all non-open/non-cancelled statuses look the same. Worth a visual note when testing closed tournaments.
> - POTENTIAL ISSUE: Public list date formatting uses new Date(`${eventDate}T00:00:00.000Z`) (UTC) while toTournamentMutation stored event_starts_at at +07:00. The displayed event date on the public list/detail is interpreted as UTC midnight, so for Thailand timezone the displayed calendar date should still match event_date, but admin card formatEventDate also uses UTC — confirm the date shown equals the date picked in the wheel picker (no off-by-one).
> - VERIFIED: Removing the last division is impossible in the form (remove button disabled when divisions.length===1); the bulk form requires >=1 division ('Add at least one division.' if divisionsJson is empty/invalid).
> - Banner is uploaded under path `${tournamentId}/${uuid}.{ext}` in bucket tournament-banners and banner_url stores the public URL. On create, if any step fails the uploaded banner and the tournament row are rolled back/removed. On update, a failed save removes the newly uploaded banner.

---

<a id="suite-4"></a>
## 4. Tournament Registration

**33 cases** — P0 `12` / P1 `16` / P2 `5` · happy `6` / negative `15` / edge `12`

<sub>Tournament Registration flow (user side) — /tournaments/[id]/register, submitTournamentRegistration server action, src/lib/registrations/options.ts + transaction.ts, and create_registration_transaction RPC (migration 202606080003)</sub>

**Routes:** `/tournaments/[id]/register (GET, register page; force-dynamic)` · `submitTournamentRegistration (server action invoked by the register form POST)` · `/tournaments/[id] (detail page; the register CTA only links here when getIsRegistrationOpen passes)` · `/login and /register (guest panel CTAs from register page)` · `/profile (missing-profile panel CTA)` · `/payments/[paymentOrderId] (success panel payment link when a payment order is created)`

**Preconditions (suite-level):**
- Dev server running: npm run dev -- --hostname 127.0.0.1 --port 3000 ; base URL http://127.0.0.1:3000
- User-facing pages render in a MOBILE FRAME even on desktop.
- All writes hit the REAL linked Supabase project (ref jiweobnsxpmgexipqzbx). Every test tournament/account/promo must use an obvious uat- prefix and be cleaned up after.
- At least one test account exists with an active player role and a player_profiles row (rank_status verified or pending both allowed for registration).
- For coach cases: a second account with an active coach role plus an approved coach_player_links row (status='approved', coach_account_id = the coach account, player_profile_id = the linked player) to a DIFFERENT player profile.
- A uat- tournament with status='open', registration_opens_at <= now <= registration_closes_at (or NULL), and at least one division with status='active'. Created via /admin/tournaments/new (admin pages are not route-protected in dev).
- Division quota is governed by divisions.max_players (NULL = unlimited/Open). The page reads division_registration_summary (available_slots, reserved/confirmed/waiting counts).
- Promo codes are created per-tournament on /admin/tournaments/[id]; promo.code_normalized = UPPER(code with whitespace removed); discount_type in (free|percentage|fixed); optional starts_at/ends_at, usage_limit, division_ids restriction.
- Login must be done before hitting the register page; otherwise the guest panel shows. The actor account must be is_active=true.

<details><summary><b>Test data ที่ต้องเตรียม</b></summary>

- uat- open tournament: status='open', registration_opens_at <= now <= registration_closes_at (or NULL), promptpay_id/promptpay_name set so payment orders carry QR data
- uat- future tournament: status='open' but registration_opens_at in the future (REG-02)
- uat- closed-window tournament: registration_closes_at in the past (REG-03)
- Active division (paid): fee_amount e.g. 300-400, status='active', max_players large enough to not be full, power/age bounds wide enough for the test player
- Active division (free): fee_amount=0, status='active'
- FULL division: max_players small (e.g. 1) and pre-filled with reserved registrations so available_slots=0 (REG-21/22/31)
- Two time-conflicting active divisions (overlapping starts_at/ends_at OR identical time_slot_label OR one 'full_day'/'เต็มวัน') for REG-28/29
- Open-bounds division: min/max power & age all NULL and max_players NULL (REG-27)
- Bound-testing division: min_power_level above test player's power (REG-23); max_power_level below (REG-24); min_age above player's event-date age (REG-25); max_age below (REG-26)
- Promo codes on the open tournament: percentage (UAT25=25%), fixed (UATFIX150=150), free (UATFREE), expired (UATEXP ends_at past), inactive (UATOFF is_active=false), usage-capped (UATCAP usage_limit=1 already used), division-restricted (UATDIVA division_ids=[A only])
- Test accounts: (a) player with eligible power/age, (b) profile-less account (REG-04), (c) coach account with an approved coach_player_links to a separate eligible linked player, (d) optional second eligible player for waiting-list position test
- All accounts/tournaments/divisions/promos use uat- prefix and must be deleted afterward (registrations, payment_orders, promo_code_usages, divisions, tournaments, promo_codes, accounts/auth users)

</details>

### Test cases

- [ ] **REG-01** · `P0` `negative` `guest` — Open register page as guest shows login panel, not the form
  - **Pre:**
    - Not logged in (clear cookies / incognito)
    - A uat- open tournament with an active division exists
  - **Steps:**
    1. Open http://127.0.0.1:3000/tournaments/<openTournamentId>/register without logging in
  - **Expected:**
    - Page title 'สมัครแข่งขัน' with the tournament title as subtitle
    - A panel titled 'เข้าสู่ระบบก่อนสมัคร' with message about using a TESUJI account
    - Buttons: 'เข้าสู่ระบบ' (-> /login), 'สร้างบัญชีใหม่' (-> /register), and a 'ดูรายละเอียดรายการ' link to /tournaments/<id>
    - No player select, no division cards, no submit button render
  - **DB:** No rows written to registrations / payment_orders / promo_code_usages
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-02** · `P0` `negative` `player` — Register window closed (not yet open) shows closed panel with opens-at date
  - **Pre:**
    - Logged in as a player with a profile
    - A uat- tournament with status='open' but registration_opens_at in the FUTURE (or division not active / tournament status not open)
  - **Steps:**
    1. Open /tournaments/<futureOpenTournamentId>/register
  - **Expected:**
    - Panel 'ยังไม่เปิดรับสมัคร' renders (getIsRegistrationOpen returns false)
    - Message reads 'เปิดรับสมัคร <formatted opens date>' when registration_opens_at is in the future
    - No registration form is shown
  - **DB:** No registrations row created
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-03** · `P1` `edge` `player` — Register window already closed shows closed-at message
  - **Pre:**
    - Logged in as a player
    - A uat- tournament status='open' with registration_closes_at in the PAST
  - **Steps:**
    1. Open /tournaments/<closedWindowTournamentId>/register
  - **Expected:**
    - Panel 'ยังไม่เปิดรับสมัคร'
    - Message 'ปิดรับสมัครแล้วเมื่อ <formatted closes date>' (because now > closesAt)
    - No form shown
  - **DB:** No registrations row created
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-04** · `P1` `negative` `player` — Logged-in account without a player profile shows missing-profile panel
  - **Pre:**
    - An authenticated account that has NO player_profiles row (account.profile is null)
    - An open uat- tournament with an active division
  - **Steps:**
    1. Log in as the profile-less account
    2. Open /tournaments/<openTournamentId>/register
  - **Expected:**
    - Panel 'ยังไม่มี Player Profile' with message about no player data
    - A primary button 'เปิดโปรไฟล์' linking to /profile
    - No division cards / submit button
  - **DB:** No registrations row created
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-05** · `P2` `edge` `player` — Tournament with no active divisions shows 'no divisions' panel
  - **Pre:**
    - Logged in as a player with profile
    - A uat- tournament where every division.status != 'active' (e.g. all archived) — note: such a tournament normally also fails getIsRegistrationOpen, so to isolate this branch make tournament.status='open' with opens/closes NULL but flip the divisions to inactive AFTER opening
  - **Steps:**
    1. Open /tournaments/<id>/register
  - **Expected:**
    - Either the closed panel (if getIsRegistrationOpen now fails) OR, if registration still reads open, the 'ยังไม่มีรุ่นแข่งขัน' panel because data.divisions.length === 0 after filtering
    - Record in notes which branch actually renders
  - **DB:** No registrations row created
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-06** · `P0` `happy` `player` — Happy path: player self-registers in a single paid division
  - **Pre:**
    - Logged in as player whose power_level and age satisfy the division bounds
    - Open uat- tournament with an active paid division (fee_amount > 0, e.g. 300) that is NOT full
    - No existing active registration for this player+division
  - **Steps:**
    1. Open /tournaments/<id>/register
    2. Confirm 'เลือกผู้เล่น' select defaults to '<name> (ฉัน)'
    3. Tick the checkbox for the paid division card
    4. Confirm สรุปยอด: 'รุ่นที่เลือก' = 1 รุ่น and 'ยอดก่อนส่วนลด' = the fee (e.g. '300 บาท')
    5. Leave Promo code blank
    6. Click 'ยืนยันสมัคร'
  - **Expected:**
    - Green status message 'สมัครสำเร็จและสร้างรายการชำระเงินแล้ว'
    - ผลการสมัคร panel lists the division with 'รอชำระเงิน', ค่าสมัคร = fee, ส่วนลด = ฟรี (0), ยอดสุทธิ = fee
    - Bottom summary: ยอดรวม = fee, ส่วนลดรวม = ฟรี, ยอดชำระ = fee, plus a 'Payment order' short id
    - A 'ไปหน้าชำระเงิน' button links to /payments/<paymentOrderId>
    - Submit button becomes disabled (state.status === 'success')
  - **DB:** registrations: 1 new row status='pending_payment', source='self', registered_by_account_id = self account, payment_order_id set, fee_amount = fee, discount_amount=0, confirmed_at NULL. payment_orders: 1 row status='pending_payment', total_fee_amount=fee, discount_amount=0, expires_at ~ now+24h. No promo_code_usages.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-07** · `P0` `happy` `player` — Zero-fee division self-registration confirms with NO payment order
  - **Pre:**
    - Logged in as eligible player
    - Open uat- tournament with an active FREE division (fee_amount = 0), not full
  - **Steps:**
    1. Open /tournaments/<id>/register
    2. On the free division card confirm the fee line shows 'ฟรี'
    3. Tick the free division
    4. สรุปยอด shows ยอดก่อนส่วนลด = ฟรี
    5. Click 'ยืนยันสมัคร'
  - **Expected:**
    - Green status message 'สมัครสำเร็จและยืนยันรายการแล้ว' (overall status confirmed)
    - ผลการสมัคร shows the division as 'ยืนยันแล้ว' with a green check icon (not the clock)
    - ยอดชำระ = ฟรี and NO 'Payment order' line and NO 'ไปหน้าชำระเงิน' button
  - **DB:** registrations: 1 row status='confirmed', confirmed_at set, payment_order_id NULL, fee_amount=0. payment_orders: NO new row (amount_due = 0 so no order inserted).
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-08** · `P0` `happy` `coach` — Coach registers an APPROVED linked player (source=coach)
  - **Pre:**
    - Logged in as an account with active coach role
    - An approved coach_player_links row links this coach to a DIFFERENT player's profile, and that player satisfies the division bounds
    - Open uat- tournament with an active paid division, not full
  - **Steps:**
    1. Open /tournaments/<id>/register as the coach
    2. Open the 'เลือกผู้เล่น' select — confirm it lists both '<coach own name> (ฉัน)' and the linked player's name
    3. Choose the LINKED player (selecting changes player and clears any selected divisions)
    4. Tick the paid division
    5. Click 'ยืนยันสมัคร'
  - **Expected:**
    - Success message for pending payment
    - ผลการสมัคร panel renders with the linked player selected in the form, payment order created
  - **DB:** registrations: new row player_profile_id = linked player's profile, registered_by_account_id = coach account, source='coach', status='pending_payment'. payment_orders.account_id = coach account.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-09** · `P1` `negative` `coach` — Coach cannot register a player who is not an approved link (server-side guard)
  - **Pre:**
    - Logged in as a coach
    - Identify a player_profile_id that is NOT linked-approved to this coach and is not the coach's own
  - **Steps:**
    1. Note that the UI only lists own profile + approved links, so this exercises the server guard
    2. Submit the form with playerProfileId tampered to the unlinked profile (e.g. via DevTools edit the hidden input name='playerProfileId' before clicking ยืนยันสมัคร)
    3. Click 'ยืนยันสมัคร'
  - **Expected:**
    - Red alert message 'บัญชีนี้ไม่มีสิทธิ์สมัครให้ผู้เล่นคนนี้' (RPC raises 'Actor cannot register this player', mapped by toFriendlyRegistrationError)
    - No success panel
  - **DB:** No registrations / payment_orders rows created for that player+tournament
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-10** · `P0` `happy` `player` — Percentage promo creates a discounted pending_payment order
  - **Pre:**
    - Eligible player logged in
    - Open uat- tournament with a paid division (e.g. fee 400)
    - A percentage promo on that tournament, is_active=true, within window, e.g. code UAT25 = 25% (no division restriction or includes this division)
  - **Steps:**
    1. Open /tournaments/<id>/register
    2. Tick the paid division (ยอดก่อนส่วนลด shows 400 บาท)
    3. Type 'UAT25' into the Promo code field (placeholder 'PROMO2026')
    4. Click 'ยืนยันสมัคร'
  - **Expected:**
    - Success message 'สมัครสำเร็จและสร้างรายการชำระเงินแล้ว'
    - ผลการสมัคร: ค่าสมัคร = 400 บาท, ส่วนลด = 100 บาท (25% of 400), ยอดสุทธิ = 300 บาท
    - Bottom: ยอดรวม 400, ส่วนลดรวม 100, ยอดชำระ 300, with a Payment order id and 'ไปหน้าชำระเงิน'
    - Note: the on-page สรุปยอด box does NOT pre-apply the promo; the discount appears only in the result panel after submit
  - **DB:** registrations: status='pending_payment', fee_amount=400, discount_amount=100. payment_orders: total_fee_amount=400, discount_amount=100 (amount_due 300). promo_code_usages: 1 row (discount_type='percentage', discount_amount=100). promo_codes.used_count incremented by 1.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-11** · `P1` `happy` `player` — Fixed promo discounts by the fixed amount (capped at fee)
  - **Pre:**
    - Eligible player
    - Paid division fee e.g. 300
    - Fixed promo on tournament, active, in window, e.g. UATFIX150 = fixed 150
  - **Steps:**
    1. Open register page, tick the division
    2. Enter 'UATFIX150' in Promo code
    3. Click 'ยืนยันสมัคร'
  - **Expected:**
    - ผลการสมัคร: ส่วนลด = 150 บาท, ยอดสุทธิ = 150 บาท
    - ยอดชำระ = 150 บาท, Payment order created
    - If fixed value exceeded the fee it would be capped at the fee (least(discount_value, fee)) — verify with a fixed value > fee in a follow-up that ยอดสุทธิ = 0 and then becomes confirmed with no order
  - **DB:** registrations.discount_amount=150, status pending_payment. payment_orders.discount_amount=150. promo_code_usages 1 row discount_type='fixed'. used_count +1.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-12** · `P0` `happy` `player` — Free promo (or full-discount promo) confirms with NO payment order
  - **Pre:**
    - Eligible player
    - Paid division (fee > 0, e.g. 300)
    - A promo of discount_type='free' (or fixed >= fee) on this tournament, active, in window, e.g. UATFREE
  - **Steps:**
    1. Open register page, tick the paid division
    2. Enter 'UATFREE' in Promo code
    3. Click 'ยืนยันสมัคร'
  - **Expected:**
    - Success message 'สมัครสำเร็จและยืนยันรายการแล้ว' (overall confirmed because amount_due = 0)
    - ผลการสมัคร: ค่าสมัคร = 300, ส่วนลด = 300 บาท, ยอดสุทธิ = ฟรี, status 'ยืนยันแล้ว' (green check)
    - ยอดชำระ = ฟรี, NO Payment order line, NO 'ไปหน้าชำระเงิน' button
  - **DB:** registrations: status='confirmed', fee_amount=300, discount_amount=300, payment_order_id NULL, confirmed_at set. payment_orders: NONE (amount_due=0). promo_code_usages: 1 row discount_type='free' (or fixed) discount_amount=300. promo_codes.used_count +1.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-13** · `P0` `negative` `player` — Invalid promo code rejected with no registration or usage written
  - **Pre:**
    - Eligible player
    - Paid division
    - No promo with code_normalized matching the typed code exists on this tournament
  - **Steps:**
    1. Open register page, tick the paid division
    2. Enter 'UATNOPE' (a code that does not exist on this tournament)
    3. Click 'ยืนยันสมัคร'
  - **Expected:**
    - Red alert message 'Promo code นี้ใช้ไม่ได้กับรายการที่เลือก' (RPC raises 'Promo code is invalid', mapped because message contains 'promo code')
    - No success panel
  - **DB:** No new registrations, NO payment_orders, NO promo_code_usages. promo_codes.used_count unchanged for all codes (whole transaction rolled back).
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-14** · `P1` `negative` `player` — Expired promo rejected (now > ends_at)
  - **Pre:**
    - Eligible player
    - Paid division
    - A promo on the tournament with ends_at in the PAST, is_active=true, code UATEXP
  - **Steps:**
    1. Open register page, tick the paid division
    2. Enter 'UATEXP'
    3. Click 'ยืนยันสมัคร'
  - **Expected:**
    - Red alert 'Promo code นี้ใช้ไม่ได้กับรายการที่เลือก' (RPC 'Promo code is expired')
    - No success
  - **DB:** No registrations / payment_orders / promo_code_usages written; used_count unchanged.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-15** · `P2` `negative` `player` — Inactive promo (is_active=false) rejected
  - **Pre:**
    - Eligible player
    - Paid division
    - A promo on the tournament with is_active=false, code UATOFF
  - **Steps:**
    1. Open register page, tick the paid division, enter 'UATOFF'
    2. Click 'ยืนยันสมัคร'
  - **Expected:**
    - Red alert mapped to 'Promo code นี้ใช้ไม่ได้กับรายการที่เลือก' (RPC 'Promo code is not active')
    - No success
  - **DB:** No rows written; used_count unchanged.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-16** · `P1` `edge` `player` — Over-used promo (usage_limit reached) rejected atomically
  - **Pre:**
    - Eligible player
    - Paid division
    - A promo with usage_limit set and used_count already == usage_limit (e.g. usage_limit=1, used_count=1), is_active, in window, code UATCAP
  - **Steps:**
    1. Open register page, tick the paid division, enter 'UATCAP'
    2. Click 'ยืนยันสมัคร'
  - **Expected:**
    - Red alert mapped from 'Promo code usage limit exceeded' (contains 'promo code') -> 'Promo code นี้ใช้ไม่ได้กับรายการที่เลือก'
    - No success
  - **DB:** used_count stays at limit; NO new registrations / payment_orders / promo_code_usages (the conditional UPDATE ... where used_count+inc <= usage_limit returns no row, RPC raises, whole tx rolls back).
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-17** · `P1` `negative` `player` — Promo already used by this account for this tournament is rejected
  - **Pre:**
    - Eligible player who ALREADY has a promo_code_usages row for promo X on this tournament (e.g. from REG-10)
    - A second still-payable division in the same tournament so a fresh registration is possible
    - Promo X still active/in window
  - **Steps:**
    1. Open register page, tick the second payable division
    2. Enter the same promo code X used before
    3. Click 'ยืนยันสมัคร'
  - **Expected:**
    - Red alert 'Promo code นี้ใช้ไม่ได้กับรายการที่เลือก' (RPC 'Promo code was already used by this account for this tournament')
    - No success panel
  - **DB:** No new registrations/payment_orders/usages for this attempt; used_count unchanged.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-18** · `P1` `negative` `player` — Wrong-division promo (division_ids restriction) rejected
  - **Pre:**
    - Eligible player
    - Two payable divisions A and B in the tournament
    - A promo restricted via division_ids to ONLY division A (not B), active, in window, code UATDIVA
  - **Steps:**
    1. Open register page, tick ONLY division B
    2. Enter 'UATDIVA'
    3. Click 'ยืนยันสมัคร'
  - **Expected:**
    - Red alert 'Promo code นี้ใช้ไม่ได้กับรายการที่เลือก' (RPC 'Promo code does not apply to a selected division')
    - No success
  - **DB:** No registrations/payment_orders/usages written; used_count unchanged.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-19** · `P2` `edge` `player` — Promo applied to a selection with only waiting_list/free rows is rejected (no payable target)
  - **Pre:**
    - Eligible player
    - A FULL paid division (will go waiting_list) and/or a free division — selection has NO payable (status!=waiting_list AND fee>0) row
    - Any active promo on the tournament, code UATANY
  - **Steps:**
    1. Open register page, select only the full paid division (shows 'waiting list' / 'รุ่นเต็มแล้ว') and/or the free division
    2. Enter 'UATANY'
    3. Click 'ยืนยันสมัคร'
  - **Expected:**
    - Red alert 'Promo code นี้ใช้ไม่ได้กับรายการที่เลือก' (RPC 'Promo code does not apply to any payable registration')
    - No success — note the entire registration is blocked, so the waiting_list/free rows are NOT created either
  - **DB:** No registrations created at all (transaction rolled back); used_count unchanged.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-20** · `P0` `negative` `player` — Duplicate registration rejected — division already registered shows as ineligible
  - **Pre:**
    - Eligible player who ALREADY has an active (pending_payment/pending_verify/confirmed/waiting_list) registration for division D in this tournament
  - **Steps:**
    1. Open /tournaments/<id>/register again as the same player
  - **Expected:**
    - Division D's card is rendered but shows the reason 'สมัครรุ่นนี้ไว้แล้ว' and is greyed/disabled (eligibility.eligible = false), so its checkbox cannot be ticked
    - If forced via DOM tampering and submitted, server returns red alert 'ผู้เล่นคนนี้สมัครรุ่นที่เลือกไว้แล้ว' (RPC 'Player already has an active registration for a selected division')
  - **DB:** No second registrations row for that player+division; no new payment_orders
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-21** · `P0` `edge` `player` — FULL division yields waiting_list with a position number and no payment order
  - **Pre:**
    - Eligible player
    - A paid division with max_players set and reserved (pending_payment+pending_verify+confirmed) count >= max_players, so available_slots = 0
    - No existing waiting_list rows OR a known count to predict position
  - **Steps:**
    1. Open /tournaments/<id>/register
    2. On the full division card confirm the QuotaBadge shows 'waiting list' and the note 'รุ่นเต็มแล้ว รายการนี้จะเข้าคิว waiting list'
    3. Tick the full division
    4. Confirm สรุปยอด shows a 'Waiting list' line = 1 รุ่น and ยอดก่อนส่วนลด excludes its fee (subtotal counts only payable divisions)
    5. Click 'ยืนยันสมัคร'
  - **Expected:**
    - Success message 'สมัครเข้าคิว waiting list แล้ว'
    - ผลการสมัคร shows the division as 'Waiting list #<n>' (n = previous max waiting position + 1, e.g. #1 if first)
    - ยอดชำระ = ฟรี, NO Payment order, NO 'ไปหน้าชำระเงิน'
  - **DB:** registrations: 1 row status='waiting_list', waiting_list_position = max(existing)+1, payment_order_id NULL. payment_orders: NONE (waiting_list excluded from fee total, amount_due=0).
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-22** · `P1` `edge` `player` — Waiting-list position increments for the second waitlister
  - **Pre:**
    - The full division from REG-21 now has one waiting_list row at position 1 (player A)
    - A second eligible player B with no existing registration in that division
  - **Steps:**
    1. Log in as player B (or coach-register a different linked player B)
    2. Open register page, tick the full division, submit
  - **Expected:**
    - ผลการสมัคร shows 'Waiting list #2' for player B
  - **DB:** registrations: player B row waiting_list_position = 2 (coalesce(max(position),0)+1). No payment order.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-23** · `P0` `negative` `player` — Power level below division minimum is blocked (UI + server)
  - **Pre:**
    - Logged in as a player whose power_level < a division's min_power_level
    - That division active in an open tournament
  - **Steps:**
    1. Open /tournaments/<id>/register
  - **Expected:**
    - The division card is greyed/disabled with reason 'ต้องมี power อย่างน้อย <minPowerLevel>'; checkbox cannot be ticked
    - If forced via DOM and submitted, server red alert 'ผู้เล่นยังไม่เข้าเงื่อนไขขั้นต่ำของรุ่นนี้' (RPC 'Player power level is below the division minimum')
  - **DB:** No registration row created
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-24** · `P1` `negative` `player` — Power level above division maximum is blocked
  - **Pre:**
    - Player whose power_level > division.max_power_level
    - Division active in open tournament
  - **Steps:**
    1. Open /tournaments/<id>/register
  - **Expected:**
    - Division card shows reason 'power ต้องไม่เกิน <maxPowerLevel>' and is disabled
    - Forced submit -> red alert 'ผู้เล่นเกินเงื่อนไขสูงสุดของรุ่นนี้' (RPC 'Player power level is above the division maximum')
  - **DB:** No registration row created
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-25** · `P1` `edge` `player` — Age below division minimum is blocked (age computed on event date)
  - **Pre:**
    - Player whose age on the tournament event_date is below division.min_age
    - Division active in open tournament. Age uses event_date (or event_starts_at date, or today) vs date_of_birth
  - **Steps:**
    1. Open /tournaments/<id>/register
  - **Expected:**
    - Division card shows reason 'อายุยังไม่ถึง <minAge> ปี' and is disabled
    - Forced submit -> RPC 'Player is below the division minimum age' (no friendly mapping, raw English text shown in the red alert — see top-level notes)
  - **DB:** No registration row created
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-26** · `P2` `edge` `player` — Age above division maximum is blocked
  - **Pre:**
    - Player whose age on event_date exceeds division.max_age
    - Division active in open tournament
  - **Steps:**
    1. Open /tournaments/<id>/register
  - **Expected:**
    - Division card shows reason 'อายุเกิน <maxAge> ปี' and disabled
    - Forced submit -> RPC raw 'Player is above the division maximum age' shown as the red alert
  - **DB:** No registration row created
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-27** · `P1` `edge` `player` — Open/NULL bounds: division with NULL power & age accepts any eligible player
  - **Pre:**
    - A division with min_power_level/max_power_level/min_age/max_age all NULL (rendered 'Power Open · อายุ Open') and max_players NULL (badge 'ไม่จำกัด')
    - Eligible logged-in player
  - **Steps:**
    1. Open register page
    2. Confirm the card shows range label 'Open' and quota badge 'ไม่จำกัด'
    3. Tick the division and submit (paid or free per setup)
  - **Expected:**
    - No eligibility reasons shown; checkbox is enabled
    - Registration succeeds (confirmed if free, pending_payment if paid) — NULL bounds skip all power/age checks in the RPC
  - **DB:** registrations row created with correct status; quota never blocks (max_players NULL means availableSlots null, never waiting_list)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-28** · `P0` `negative` `player` — Time-slot conflict between two SELECTED divisions blocks submit (client guard)
  - **Pre:**
    - Eligible player
    - Two active divisions in the same tournament whose time slots overlap (overlapping starts_at/ends_at OR same time_slot_label OR one labelled full_day/เต็มวัน)
  - **Steps:**
    1. Open /tournaments/<id>/register
    2. Tick BOTH conflicting divisions
  - **Expected:**
    - A red AlertPanel: 'รุ่นที่เลือกมีเวลาชนกัน: <name A> และ <name B>'
    - The 'ยืนยันสมัคร' button is disabled (canSubmit false due to selectedConflict)
    - Server defense: RPC would also raise 'Selected divisions have a time-slot conflict' -> mapped to 'รุ่นที่เลือกมีเวลาชนกัน'
  - **DB:** No registrations rows created (submission blocked)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-29** · `P1` `negative` `player` — Time-slot conflict with an EXISTING registration marks the new division ineligible
  - **Pre:**
    - Player already has an active registration in division X (some time slot)
    - Division Y in the same tournament conflicts in time with X and the player is otherwise eligible for Y
  - **Steps:**
    1. Open /tournaments/<id>/register as that player
  - **Expected:**
    - Division Y card shows reason 'เวลาชนกับ <X name>' and is disabled
    - Forced submit -> RPC 'Player already has a time-slot conflict: ...' -> mapped to 'รุ่นที่เลือกมีเวลาชนกัน'
  - **DB:** No new registration for Y
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-30** · `P1` `negative` `player` — Submit with no division selected is prevented
  - **Pre:**
    - Eligible player on the register form
  - **Steps:**
    1. Open register page
    2. Do NOT tick any division
    3. Observe the 'ยืนยันสมัคร' button
  - **Expected:**
    - Submit button is disabled (canSubmit requires selectedDivisionIds.length > 0)
    - If the form is forced to POST with zero divisions, the server-action zod schema returns 'กรุณาเลือกรุ่นอย่างน้อย 1 รุ่น'
  - **DB:** No registrations row created
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-31** · `P1` `edge` `player` — Mixed selection: one payable + one full division -> mixed/partial result
  - **Pre:**
    - Eligible player
    - Same tournament has one available paid (or free) division A and one FULL division B that do NOT time-conflict
    - Player eligible for both
  - **Steps:**
    1. Open register page, tick BOTH A and B
    2. สรุปยอด shows รุ่นที่เลือก = 2 รุ่น, a Waiting list line = 1 รุ่น, and subtotal = only A's fee
    3. Click 'ยืนยันสมัคร'
  - **Expected:**
    - If A is free: success message 'สมัครสำเร็จ บางรุ่นรอชำระเงินหรืออยู่ใน waiting list' (overall 'mixed': has confirmed + waiting_list)
    - If A is paid: overall status is 'pending_payment' (any pending_payment dominates) with message 'สมัครสำเร็จและสร้างรายการชำระเงินแล้ว'
    - ผลการสมัคร lists A with its status and B as 'Waiting list #n'
  - **DB:** registrations: 2 rows — A confirmed/pending_payment, B waiting_list. payment_orders: created only if A is paid (covers A's fee only).
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-32** · `P2` `edge` `coach` — Changing the selected player resets the chosen divisions
  - **Pre:**
    - Coach with own profile + at least one approved linked player, both eligible for the same division
  - **Steps:**
    1. Open register page as coach
    2. Tick a division while own profile is selected
    3. Use the 'เลือกผู้เล่น' select to switch to the linked player
  - **Expected:**
    - The previously ticked division checkboxes clear (changePlayer sets selectedDivisionIds to [])
    - สรุปยอด resets to 0 รุ่น / ยอดก่อนส่วนลด ฟรี
    - Eligibility recomputes for the newly selected player (different cards may enable/disable)
  - **DB:** No DB change (no submit yet)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-33** · `P1` `edge` `player` — Success state locks the form against double submission
  - **Pre:**
    - Eligible player, paid division available
  - **Steps:**
    1. Complete a successful registration (e.g. REG-06)
    2. After the ผลการสมัคร panel appears, attempt to change the player select, toggle divisions, or click 'ยืนยันสมัคร' again
  - **Expected:**
    - Player select and division checkboxes are disabled (disabled when state.status === 'success')
    - 'ยืนยันสมัคร' is disabled (canSubmit requires state.status !== 'success')
    - No second submission is possible without reloading
  - **DB:** Only ONE registrations row + one payment_order from the single successful submit
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

> ⚠️ **ข้อสังเกตจากโค้ด (อ่านก่อนเทส suite นี้):**
> - The on-page 'สรุปยอด' box never previews promo discounts; the discount only appears in the post-submit 'ผลการสมัคร' panel. Subtotal there counts only payable divisions (waiting_list and free are excluded from ยอดก่อนส่วนลด). Verify testers do not expect a live discounted total before submitting.
> - toFriendlyRegistrationError (actions.ts) has NO mapping for age errors ('Player is below/above the division minimum/maximum age'). For age-out-of-bounds the raw English RPC message is shown to the user (REG-25/26). All age cases are also pre-blocked client-side as ineligible cards, so this only surfaces if the client guard is bypassed — still an inconsistency worth flagging.
> - The client form pre-filters ineligibility: ineligible divisions (wrong power/age, already registered, time conflict, inactive division) render disabled checkboxes, so the negative server paths (REG-09, REG-20, REG-23..26, REG-29) are reachable in normal use only by DOM tampering of the hidden playerProfileId input or the disabled checkboxes. They are included to test server-side defense-in-depth, which matches the RPC raises in migration 202606080003.
> - Quota: division_registration_summary.available_slots and the QuotaBadge derive 'full' from reserved = pending_payment + pending_verify + confirmed (NOT waiting_list). A division at max_players shows badge 'waiting list' even though new submits still succeed as waiting_list rows. max_players NULL => badge 'ไม่จำกัด' and availableSlots null, so it never routes to waiting_list.
> - Promo atomicity: every promo rejection (invalid/expired/inactive/over-used/already-used/wrong-division/no-payable-target/no-discount) raises inside the single RPC transaction, so the ENTIRE registration is rolled back — including any waiting_list/free rows that would otherwise have been created. Confirm zero rows in registrations/payment_orders/promo_code_usages and unchanged promo_codes.used_count after each promo-negative case.
> - Promo-on-non-payable (REG-19): selecting only full/free divisions plus a promo blocks the whole submission ('does not apply to any payable registration'). Without a promo, the same selection would succeed (waiting_list/confirmed). This asymmetry is by design but easy to misread as a bug.
> - Page renders the form only when data.players.length>0 AND data.divisions.length>0 AND getIsRegistrationOpen true. getIsRegistrationOpen requires tournament.status==='open' AND at least one division.status==='active' AND now within opens/closes window (NULL bounds treated as open-ended).
> - Coach-linked players appear in 'เลือกผู้เล่น' only when the actor has an ACTIVE coach role (account_roles role='coach' status='active') AND coach_player_links.status='approved'. Pending/rejected links must NOT appear.
> - promoCode is trimmed/length-validated (max 64) by both the action zod schema and the transaction.ts schema before the RPC; an empty/whitespace promo is sent as null (no promo path). code matching in the RPC uppercases and strips ALL whitespace, so 'uat 25' matches a stored code normalized to 'UAT25'.
> - Cleanup: deleting a uat- tournament should also clear its divisions, promo_codes, registrations, payment_orders, promo_code_usages; also delete the uat- auth users/accounts. Verify follow-up counts are 0, matching the project's smoke-test cleanup discipline.

---

<a id="suite-5"></a>
## 5. Payment / Slip / My-Registrations / Cancel / Waiting-list

**44 cases** — P0 `18` / P1 `16` / P2 `10` · happy `14` / negative `17` / edge `13`

<sub>Payment, Slip Upload, My-Registrations, Cancel, Waiting-List (user side)</sub>

**Routes:** `/payments/[id] (src/app/payments/[id]/page.tsx)` · `POST /payments/[id]/slip (src/app/payments/[id]/slip/route.ts)` · `/my-registrations (src/app/my-registrations/page.tsx)` · `/my-registrations/[id] (src/app/my-registrations/[id]/page.tsx)` · `Server action cancelRegistrationAction (src/app/my-registrations/[id]/actions.ts)` · `/admin/payments Run-timeout-sweep button (admin side, used to drive S5.7 timeout/promotion edge cases)`

**Preconditions (suite-level):**
- Dev server running: npm run dev -- --hostname 127.0.0.1 --port 3000; base URL http://127.0.0.1:3000
- User-facing pages require a REAL Supabase login. getCurrentAccount() calls supabase.auth.getUser() with NO dev bypass. A logged-out tester on /payments/[id] hits notFound(); on /my-registrations hits redirect('/login'). Log in via /login before every user-side test.
- Seed test data with an OBVIOUS uat- prefix on tournament titles and accounts (e.g. uat-pay-pp, uat-coach-01). Clean up afterward.
- Need at least one tournament with promptpay_id + promptpay_name configured, paid divisions (fee_amount > 0) for QR/slip tests, and at least one FREE division (fee_amount 0) for zero-amount paths.
- For waiting-list tests, fill a division to quota so the next registration lands status=waiting_list (waiting_list_position assigned by create_registration_transaction). Need a paid full division and a separate free full division.
- A payment order in pending_payment with a non-null expires_at in the FUTURE is required for the live countdown/upload path; an order with expires_at in the PAST is required for the expired path. Set expires_at directly in Supabase for deterministic tests.
- Coach tests need an active coach role on the test account and at least one coach_player_link with status=approved to the player profile being viewed.
- Prepare slip fixture files: valid small JPG, valid PNG, a >10MB JPG/PNG (e.g. 11MB), and a non-image (e.g. a .pdf or .gif) for negative MIME tests.
- Admin timeout-sweep edge cases use /admin/payments (desktop, not route-protected in dev) Run-timeout-sweep button, which calls expire_pending_payment_orders.

<details><summary><b>Test data ที่ต้องเตรียม</b></summary>

- uat tournament A: status published, promptpay_id set (Thai phone like 0812345678 OR 13-digit national ID), promptpay_name set; one paid division (fee_amount e.g. 300), one free division (fee_amount 0).
- uat tournament B: a paid division with capacity 1 already filled by a confirmed paid registration, plus an oldest paid waiting_list registration (position 1) belonging to a DIFFERENT test account, to verify promotion creates a new pending_payment order.
- uat tournament C: a FREE division with capacity 1 already filled, plus an oldest free waiting_list registration (position 1) for a different account, to verify promotion -> confirmed with NO payment order.
- Test accounts: uat-player-self (player role, own profile), uat-coach (active coach role) with an approved coach_player_link to uat-linked-player, uat-other (unrelated account with no link, for permission negatives).
- payment_orders rows: one pending_payment future-expiry (for QR/upload/countdown), one pending_payment past-expiry (for expired path), one pending_verify (cancel-forbidden path), one confirmed (state-panel + signed slip link path).
- Slip fixtures: valid.jpg (image/jpeg, <1MB), valid.png (image/png, <1MB), big.jpg (>10MB), bad.pdf (application/pdf), bad.gif (image/gif), and a .gif renamed to .jpg whose browser MIME still resolves to image/gif (content-vs-extension edge).

</details>

### Test cases

- [ ] **PAY-01** · `P0` `happy` `player` — Payment detail renders PromptPay QR, masked ID, account name and exact amount_due for a future-expiry pending_payment order
  - **Pre:**
    - Logged in as the account that owns the order (payment_orders.account_id = current user) or registered_by
    - Order status=pending_payment, amount_due>0, expires_at in the future, tournament.promptpay_id + promptpay_name set
  - **Steps:**
    1. Open http://127.0.0.1:3000/payments/{orderId}
    2. Observe the 'PromptPay QR' card
    3. Read the 'ยอดก่อนส่วนลด' / 'ส่วนลด' / 'ยอดชำระ' summary lines
    4. Read 'ชื่อบัญชี' and 'PromptPay' lines under the QR
  - **Expected:**
    - Status badge shows รอชำระ (pending_payment)
    - A PromptPay QR image (260x260, white card) renders
    - ยอดชำระ equals the order amount_due formatted as 'N,NNN.NN บาท' (matches DB payment_orders.amount_due)
    - ชื่อบัญชี shows promptpay_name; PromptPay shows masked id as first-3 + bullets + last-4 digits
    - A 'หมดเวลา' summary line shows the expires_at date and a 'เหลือเวลาโดยประมาณ X' countdown text appears
  - **DB:** payment_orders.status=pending_payment, amount_due matches displayed ยอดชำระ, promptpay_id/promptpay_name (or tournament fallback) match
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **PAY-02** · `P1` `happy` `player` — Linked registrations list shows each linked registration with division, player, rank, fee/discount/net and status badge
  - **Pre:**
    - Order with >=1 linked registration (registrations.payment_order_id = orderId)
  - **Steps:**
    1. Open /payments/{orderId}
    2. Scroll to 'รายการสมัครที่ผูกกับการชำระเงิน'
  - **Expected:**
    - One card per linked registration
    - Each shows divisionName, '{playerName} · {rank}', and a status badge
    - ค่าสมัคร = fee_amount, ส่วนลด = discount_amount, ยอดสุทธิ = final_fee_amount, each formatted as บาท (0 shows 'ฟรี')
  - **DB:** registrations WHERE payment_order_id=orderId: count and fee_amount/discount_amount/final_fee_amount match the displayed lines
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **PAY-03** · `P2` `edge` `player` — QR / amount uses tournament PromptPay fallback when order promptpay_id is NULL
  - **Pre:**
    - Order pending_payment with payment_orders.promptpay_id NULL but tournaments.promptpay_id set
  - **Steps:**
    1. Open /payments/{orderId}
    2. Inspect QR card ชื่อบัญชี / PromptPay
  - **Expected:**
    - QR still renders using tournament.promptpay_id and tournament.promptpay_name (server falls back order.promptpay_id ?? tournament.promptpay_id)
  - **DB:** payment_orders.promptpay_id IS NULL AND tournaments.promptpay_id IS NOT NULL
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **PAY-04** · `P1` `negative` `player` — Missing PromptPay configuration shows error alert instead of QR (no upload card)
  - **Pre:**
    - Order pending_payment, amount_due>0, future expiry, BUT both order.promptpay_id and tournament.promptpay_id are NULL
  - **Steps:**
    1. Open /payments/{orderId}
    2. Observe PromptPay QR card
  - **Expected:**
    - Red alert shows 'This tournament has no PromptPay ID configured.'
    - No QR image
    - Slip upload card 'ส่งสลิปชำระเงิน' is NOT rendered (canUploadSlip requires promptpayQrDataUrl)
  - **DB:** payment_orders.promptpay_id IS NULL AND tournaments.promptpay_id IS NULL
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **PAY-05** · `P2` `edge` `player` — Invalid PromptPay ID format surfaces a generation error from createPromptPayPayload
  - **Pre:**
    - Order pending_payment, amount_due>0, future expiry; tournament.promptpay_id set to a value that is NOT a 10/11/13/15-digit Thai phone/ID/e-wallet (e.g. '123')
  - **Steps:**
    1. Open /payments/{orderId}
    2. Observe PromptPay QR card
  - **Expected:**
    - Red alert shows the thrown message 'PromptPay ID must be a Thai phone number, 13-digit ID, or 15-digit e-wallet ID.'
    - No QR; no upload card
  - **DB:** tournaments.promptpay_id set to malformed value
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **PAY-06** · `P0` `edge` `player` — Expired pending_payment order shows expired banner, no QR, and no upload card
  - **Pre:**
    - Order status STILL pending_payment in DB but expires_at is in the PAST (set expires_at to a past timestamp; do not run sweep yet)
  - **Steps:**
    1. Open /payments/{orderId}
    2. Observe the deadline banner and QR card
  - **Expected:**
    - Top deadline banner shows 'รายการนี้หมดเวลาแล้ว' in red
    - QR card shows alert 'รายการนี้หมดเวลาแล้ว จึงไม่สามารถสแกน QR หรือส่งสลิปใหม่ได้'
    - No QR image
    - No 'ส่งสลิปชำระเงิน' upload card (canUploadSlip false because isExpired)
  - **DB:** payment_orders.status=pending_payment AND expires_at < now()
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **PAY-07** · `P2` `edge` `player` — Zero-amount / free order renders state panel, no QR and no upload
  - **Pre:**
    - A payment order (or pseudo) with amount_due = 0 OR a confirmed free registration path
  - **Steps:**
    1. Open /payments/{orderId} for an order with amount_due 0
    2. Observe panels
  - **Expected:**
    - ยอดชำระ shows 'ฟรี'
    - buildPromptPayQr returns null for amount<=0 so no QR card content; if status!=pending_payment the PaymentStatePanel renders instead
    - No upload card (canUploadSlip requires amountDue>0)
  - **DB:** payment_orders.amount_due = 0
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **PAY-08** · `P0` `negative` `player` — Non-owner with no relationship cannot view someone else's payment order (404)
  - **Pre:**
    - Order belongs to uat-player-self; current login is uat-other with no registered_by, no profile match, no approved coach link
  - **Steps:**
    1. Log in as uat-other
    2. Open /payments/{orderId of uat-player-self}
  - **Expected:**
    - Next.js notFound() 404 page (getPaymentOrderDetail returns null -> notFound)
  - **DB:** no relationship rows: order.account_id != uat-other, no registrations.registered_by_account_id=uat-other, no player_profiles.account_id=uat-other on linked profiles, no approved coach_player_links
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **PAY-09** · `P2` `negative` `player` — Malformed / non-UUID payment order id returns 404
  - **Pre:**
    - Logged in as any test account
  - **Steps:**
    1. Open /payments/not-a-uuid
  - **Expected:**
    - 404 (uuidSchema.safeParse fails -> getPaymentOrderDetail returns null -> notFound)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **PAY-10** · `P1` `negative` `guest` — Logged-out user cannot view a payment order
  - **Pre:**
    - No active session (sign out)
  - **Steps:**
    1. Open /payments/{anyValidOrderId} while logged out
  - **Expected:**
    - 404 (getCurrentAccount null -> getPaymentOrderDetail returns null -> notFound). Note: page does NOT redirect to /login, it 404s.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **SLIP-01** · `P0` `happy` `player` — Upload a valid JPG slip moves order + linked pending_payment registrations to pending_verify and QR/upload disappear after reload
  - **Pre:**
    - Order pending_payment, amount_due>0, future expiry, QR visible (upload card present)
    - Have valid.jpg (<10MB)
  - **Steps:**
    1. Open /payments/{orderId}
    2. In 'ส่งสลิปชำระเงิน' choose valid.jpg
    3. Click ส่งสลิป
    4. Wait for success message
    5. Reload the page
  - **Expected:**
    - Inline green status 'ส่งสลิปเรียบร้อยแล้ว รอ Admin ตรวจสอบการชำระเงิน' appears
    - After router.refresh()/reload: status badge becomes รอตรวจสอบ (pending_verify)
    - QR card replaced by PaymentStatePanel 'ระบบได้รับสลิปแล้ว รอ Admin ตรวจสอบ...'
    - A 'เปิดสลิปที่ส่งแล้ว' link (signed URL) appears
    - Upload form is gone
    - Linked registration badges show รอตรวจสอบ
  - **DB:** payment_orders.status -> pending_verify, slip_url=storage://slips/..., slip_storage_path set, paid_at set, submitted_at set; registrations WHERE payment_order_id (that were pending_payment) -> pending_verify; a new object exists in Storage bucket 'slips' under {tournament_id}/{orderId}/{uuid}.jpg
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **SLIP-02** · `P1` `happy` `player` — Upload a valid PNG slip succeeds with .png extension in storage path
  - **Pre:**
    - Fresh pending_payment order; valid.png (<10MB)
  - **Steps:**
    1. Open /payments/{orderId}
    2. Choose valid.png
    3. Click ส่งสลิป
    4. Reload
  - **Expected:**
    - Same pending_verify transition as SLIP-01
    - Stored object key ends with .png (getSlipExtension returns png for image/png)
  - **DB:** payment_orders.slip_storage_path ends with '.png'; status=pending_verify
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **SLIP-03** · `P2` `edge` `player` — Signed slip link is short-lived (10 min) and opens the uploaded image
  - **Pre:**
    - An order already in pending_verify (or confirmed) with slip_storage_path set
  - **Steps:**
    1. Open /payments/{orderId}
    2. Click 'เปิดสลิปที่ส่งแล้ว'
  - **Expected:**
    - A new tab opens the slip image via a Supabase signed URL (createSignedUrl with 600s expiry). Link is regenerated on each page load.
  - **DB:** payment_orders.slip_storage_path not null; bucket 'slips' is private (signed URL required)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **SLIP-04** · `P0` `negative` `player` — Non-JPG/PNG file is rejected client-side before any network upload
  - **Pre:**
    - Pending_payment order with upload card; bad.pdf or bad.gif fixture
  - **Steps:**
    1. Open /payments/{orderId}
    2. Use the file picker; if needed bypass the accept filter to choose bad.pdf
    3. Click ส่งสลิป
  - **Expected:**
    - Red inline alert 'สลิปต้องเป็นไฟล์ JPG หรือ PNG เท่านั้น'
    - No POST /payments/{id}/slip request is sent (validateSlip blocks before fetch)
    - No Storage object created
  - **DB:** payment_orders unchanged (still pending_payment); no new slips object
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **SLIP-05** · `P0` `negative` `player` — Oversized (>10MB) slip rejected before upload
  - **Pre:**
    - Pending_payment order with upload card; big.jpg >10MB (e.g. 11MB)
  - **Steps:**
    1. Open /payments/{orderId}
    2. Choose big.jpg
    3. Click ส่งสลิป
  - **Expected:**
    - Red inline alert 'สลิปต้องมีขนาดไม่เกิน 10MB'
    - No network upload (client maxSlipBytes=10*1024*1024 blocks first)
  - **DB:** payment_orders unchanged; no new slips object
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **SLIP-06** · `P1` `negative` `player` — Server route returns HTTP 400 for a bad file when bypassing the client form (direct POST)
  - **Pre:**
    - Logged-in session cookie; pending_payment order id
  - **Steps:**
    1. Send a multipart POST to /payments/{orderId}/slip with field 'slip' = a non-image (or >10MB) file using the browser session
    2. Observe response
  - **Expected:**
    - HTTP 400 with JSON {error: ...}
    - For non-image: 'สลิปต้องเป็นไฟล์ JPG หรือ PNG เท่านั้น'; for >10MB: 'สลิปต้องมีขนาดไม่เกิน 10MB' (validateSlipFile throws BEFORE supabase.storage.upload)
  - **DB:** payment_orders unchanged; no slips object created (validation precedes upload)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **SLIP-07** · `P1` `negative` `player` — Uploading a slip to an EXPIRED pending_payment order is rejected (400)
  - **Pre:**
    - Order status pending_payment in DB but expires_at in the past. Upload card is normally hidden (PAY-06); force a direct POST or temporarily set future expiry in UI then expire before submit
  - **Steps:**
    1. Direct POST a valid.jpg to /payments/{expiredOrderId}/slip
  - **Expected:**
    - HTTP 400 with 'รายการชำระเงินนี้หมดเวลาแล้ว' (submitPaymentSlip throws 'Payment order expired.' after file validation but the storage object created is removed on RPC/throw path; here the expiry check throws before upload so no object is stored)
  - **DB:** payment_orders.status still pending_payment (or expired if sweep ran); no new slips object
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **SLIP-08** · `P1` `negative` `player` — Uploading a slip to a non-pending_payment order (already pending_verify) is rejected
  - **Pre:**
    - Order already pending_verify; valid.jpg
  - **Steps:**
    1. Direct POST valid.jpg to /payments/{orderId}/slip
  - **Expected:**
    - HTTP 400 with 'รายการนี้ไม่ได้อยู่ในสถานะรอชำระเงิน' (status !== pending_payment guard)
  - **DB:** payment_orders.status stays pending_verify; no duplicate slip object
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **SLIP-09** · `P0` `negative` `player` — Non-related account cannot upload a slip for another user's order
  - **Pre:**
    - Logged in as uat-other (no relationship); order belongs to uat-player-self in pending_payment
  - **Steps:**
    1. Direct POST valid.jpg to /payments/{otherUsersOrderId}/slip
  - **Expected:**
    - HTTP 400 with 'บัญชีนี้ไม่มีสิทธิ์อัปโหลดสลิปให้รายการนี้' (canAccessPaymentOrder false -> 'Cannot update this payment order.')
  - **DB:** payment_orders unchanged; no slips object
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **SLIP-10** · `P1` `happy` `coach` — Coach with approved link can upload slip for a linked player's order
  - **Pre:**
    - Logged in as uat-coach (active coach role) with approved coach_player_link to the linked player profile on the order; order pending_payment, future expiry, QR visible
  - **Steps:**
    1. Open /payments/{linkedPlayerOrderId}
    2. Choose valid.jpg
    3. Click ส่งสลิป
    4. Reload
  - **Expected:**
    - Upload succeeds; order + linked registrations move to pending_verify (canAccessPaymentOrder allows via approved coach_player_links)
  - **DB:** payment_orders.status=pending_verify; registrations pending_verify; coach_player_links.status=approved exists for that profile
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **SLIP-11** · `P2` `edge` `player` — Content-vs-extension edge: a GIF renamed to .jpg is rejected by MIME type, not extension
  - **Pre:**
    - A real GIF saved as renamed.jpg whose browser-reported type stays image/gif
  - **Steps:**
    1. Open /payments/{orderId}
    2. Choose renamed.jpg
    3. Click ส่งสลิป
  - **Expected:**
    - Rejected with 'สลิปต้องเป็นไฟล์ JPG หรือ PNG เท่านั้น' because allowedSlipTypes checks the File.type (image/gif), not the filename. NOTE: validation is MIME-type-based, not magic-byte-based — a real JPEG/PNG with spoofed type=image/jpeg would pass; record in notes.
  - **DB:** payment_orders unchanged
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **MYREG-01** · `P0` `happy` `player` — My-registrations lists own registrations split into Active vs History with correct counts
  - **Pre:**
    - Logged in as uat-player-self with >=1 active (pending_payment/pending_verify/confirmed/waiting_list) and >=1 inactive (cancelled/expired/rejected) registration on own profile
  - **Steps:**
    1. Open http://127.0.0.1:3000/my-registrations
    2. Read the 'สรุปรายการสมัคร' Active/History counts
    3. Inspect 'กำลังดำเนินการ' and 'ประวัติ' sections
  - **Expected:**
    - Active count = number of non-(cancelled/expired/rejected) registrations; History = the rest
    - Active rows appear under กำลังดำเนินการ, inactive under ประวัติ
    - Each card shows tournamentTitle, divisionName, status badge, player·rank, event date, payment summary, finalFeeAmount (0 -> 'ฟรี')
  - **DB:** registrations WHERE player_profile_id = self profile: counts by status match Active/History split
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **MYREG-02** · `P2` `edge` `player` — Empty state for an account with no registrations
  - **Pre:**
    - Logged in as a fresh account with a profile but zero registrations and not an active coach with linked players
  - **Steps:**
    1. Open /my-registrations
  - **Expected:**
    - 'ยังไม่มีรายการสมัคร' empty card with 'ดูรายการแข่งขัน' button linking to /tournaments
    - Active=0 History=0
  - **DB:** registrations for the profile = 0
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **MYREG-03** · `P0` `happy` `coach` — Coach sees own + approved-linked players' registrations; unlinked players excluded
  - **Pre:**
    - Logged in as uat-coach (active coach); approved coach_player_link to uat-linked-player who has >=1 registration; a NON-linked player also has registrations
  - **Steps:**
    1. Open /my-registrations
  - **Expected:**
    - List includes the coach's own profile registrations AND the linked player's registrations
    - Registrations of non-linked players do NOT appear (getAccessibleProfileIds only includes approved links + own profile)
  - **DB:** coach_player_links WHERE coach_account_id=uat-coach AND status=approved lists exactly the linked profile ids shown
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **MYREG-04** · `P1` `edge` `player` — Waiting-list registration shows the position chip and waiting list status
  - **Pre:**
    - A registration with status=waiting_list and waiting_list_position not null on the visible profile
  - **Steps:**
    1. Open /my-registrations
    2. Find the waiting-list card
  - **Expected:**
    - Status badge shows 'waiting list' (purple)
    - A 'Waiting list: #N' line shows registrations.waiting_list_position
  - **DB:** registrations.status=waiting_list AND waiting_list_position = displayed N
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **MYREG-05** · `P1` `happy` `player` — Payment summary text matches order status (รอชำระ amount / รอตรวจสอบสลิป / ยืนยันแล้ว / หมดเวลา / ไม่ต้องชำระ)
  - **Pre:**
    - Registrations whose linked orders cover statuses pending_payment, pending_verify, confirmed, expired; plus a free reg with no payment_order_id
  - **Steps:**
    1. Open /my-registrations
    2. Read the 'ชำระเงิน' line on each card
  - **Expected:**
    - pending_payment -> 'รอชำระ {amount} บาท' using payment_orders.amount_due
    - pending_verify -> 'รอตรวจสอบสลิป'
    - confirmed -> 'ยืนยันแล้ว'
    - expired -> 'หมดเวลา'
    - no payment_order_id and finalFee 0 -> 'ไม่ต้องชำระ'
  - **DB:** payment_orders.status and amount_due per linked order match the rendered summary text
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **MYREG-06** · `P1` `negative` `guest` — Logged-out user is redirected to /login from my-registrations
  - **Pre:**
    - No session
  - **Steps:**
    1. Open /my-registrations while logged out
  - **Expected:**
    - Redirect to /login (getMyRegistrations returns null -> redirect('/login'))
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **MYREG-07** · `P0` `happy` `player` — Registration detail shows fee breakdown, payment panel, countdown, and slip link
  - **Pre:**
    - A registration with a linked payment order (pending_payment future expiry, or pending_verify with slip)
  - **Steps:**
    1. Open /my-registrations
    2. Click a card -> /my-registrations/{id}
    3. Inspect ค่าสมัคร and การชำระเงิน panels
  - **Expected:**
    - ค่าสมัคร: ยอดค่าสมัคร=fee_amount, ส่วนลด=discount_amount, ยอดสุทธิ=final_fee_amount
    - Payment panel shows 'Payment order {first8}', amount due, หมดเวลา date; for pending_payment a 'เหลือเวลา' line (or 'หมดเวลาแล้ว' if expired)
    - 'เปิดหน้าชำระเงิน' link to /payments/{orderId}
    - If slip uploaded, 'เปิดสลิปที่ส่งแล้ว' signed link
  - **DB:** registrations fee/discount/final match; payment_orders.expires_at/amount_due/slip_storage_path match
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **MYREG-08** · `P2` `edge` `player` — Detail of a registration with no payment order (free) shows 'ไม่มีค่าสมัคร'
  - **Pre:**
    - A confirmed FREE registration with payment_order_id NULL and final_fee_amount 0
  - **Steps:**
    1. Open /my-registrations/{freeRegId}
  - **Expected:**
    - Payment panel shows 'รายการนี้ไม่มีค่าสมัคร' (finalFeeAmount===0 branch)
    - No 'เปิดหน้าชำระเงิน' link
  - **DB:** registrations.payment_order_id IS NULL AND final_fee_amount=0
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **MYREG-09** · `P1` `negative` `player` — Detail 404 for a registration the user has no access to / non-UUID id
  - **Pre:**
    - A registration owned by a different unrelated account; current login uat-other
  - **Steps:**
    1. Open /my-registrations/{otherUsersRegId}
    2. Also try /my-registrations/not-a-uuid
  - **Expected:**
    - Both return notFound() 404 (canAccessRegistration false / invalid UUID -> null -> notFound)
  - **DB:** no registered_by/profile/approved-coach relationship between uat-other and the registration
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **CANCEL-01** · `P0` `happy` `player` — Cancel an eligible pending_payment registration with a reason sets cancelled status and audit fields
  - **Pre:**
    - A pending_payment (or confirmed/waiting_list) registration BEFORE event date, not pending_verify, owned by current user
  - **Steps:**
    1. Open /my-registrations/{id}
    2. In 'ยกเลิกรายการสมัคร' type a reason e.g. 'uat ติดธุระ'
    3. Click ยืนยันยกเลิกรายการ
    4. Wait for result
  - **Expected:**
    - Green status 'Cancelled. No waiting-list promotion was needed.' (or the promotion variant if a waiting row existed)
    - Submit button disabled after success
    - On reload the cancel form is replaced by the red 'รายการนี้ถูกยกเลิกแล้ว' panel showing ยกเลิกเมื่อ {date} and the reason
  - **DB:** registrations.status -> cancelled, cancelled_at set, cancellation_reason='uat ติดธุระ', cancelled_by set; if it was a single-registration pending_payment order with no other active regs, payment_orders.status -> cancelled
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **CANCEL-02** · `P0` `negative` `player` — Cancel requires a reason (empty reason blocked)
  - **Pre:**
    - Eligible registration with cancel form visible
  - **Steps:**
    1. Open /my-registrations/{id}
    2. Leave the reason textarea empty
    3. Click ยืนยันยกเลิกรายการ
  - **Expected:**
    - Browser blocks submit (textarea required); if forced, server action returns error 'Cancellation reason is required.' (zod min(1)). Registration stays unchanged.
  - **DB:** registrations.status unchanged (still active)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **CANCEL-03** · `P2` `edge` `player` — Reason over 500 chars is rejected
  - **Pre:**
    - Eligible registration
  - **Steps:**
    1. Open /my-registrations/{id}
    2. Paste a >500 char reason (textarea maxLength=500 caps typing; bypass to test server)
    3. Submit
  - **Expected:**
    - If forced past the client cap, server returns 'Reason must be 500 characters or fewer.' (zod max(500)). Boundary: exactly 500 chars is accepted.
  - **DB:** registrations.status unchanged on rejection
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **CANCEL-04** · `P0` `negative` `player` — Cancel is forbidden while payment is pending_verify (slip submitted)
  - **Pre:**
    - A registration whose status is pending_verify (slip already uploaded)
  - **Steps:**
    1. Open /my-registrations/{id}
  - **Expected:**
    - No cancel form; instead 'ยกเลิกผ่านระบบไม่ได้' panel with reason 'ส่งสลิปแล้ว กรุณารอ Admin ตรวจสอบหรือแจ้ง Admin เพื่อยกเลิก' (getCancelState blocks pending_verify). Even via direct action, RPC rejects ('under verification').
  - **DB:** registrations.status stays pending_verify
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **CANCEL-05** · `P0` `negative` `player` — Cancel is forbidden on/after the event date (Bangkok timezone)
  - **Pre:**
    - An active registration whose tournament.event_date (or event_starts_at date) is today or earlier in Asia/Bangkok
  - **Steps:**
    1. Open /my-registrations/{id}
  - **Expected:**
    - 'ยกเลิกผ่านระบบไม่ได้' panel with 'เลยวันแข่งขันแล้ว ไม่สามารถยกเลิกผ่านระบบได้' (isOnOrAfterEventDate compares todayBangkok >= eventDate). Direct action also blocked by RPC ('event date').
  - **DB:** tournaments.event_date <= today (Asia/Bangkok); registrations.status unchanged
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **CANCEL-06** · `P1` `negative` `player` — Already-cancelled/expired/rejected registrations show no cancel form
  - **Pre:**
    - Registrations in cancelled, expired, and rejected states
  - **Steps:**
    1. Open detail for each
  - **Expected:**
    - cancelled: red 'รายการนี้ถูกยกเลิกแล้ว' panel (cancelledAt branch)
    - expired: 'ยกเลิกผ่านระบบไม่ได้' with 'รายการนี้หมดเวลาแล้ว'
    - rejected: 'ยกเลิกผ่านระบบไม่ได้' with 'รายการนี้ไม่ผ่านการตรวจสอบ'
    - No cancel form in any case
  - **DB:** registrations.status in (cancelled, expired, rejected)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **CANCEL-07** · `P0` `negative` `player` — Non-related account cannot cancel another user's registration
  - **Pre:**
    - uat-other logged in; targets a registration of uat-player-self (uat-other reaches the page only if it 404s; test via direct server-action POST to confirm RPC guard)
  - **Steps:**
    1. As uat-other, attempt to submit a cancel for the other user's registrationId
  - **Expected:**
    - Action returns 'This account cannot cancel that registration.' (RPC raises 'Cannot cancel this registration'). Detail page itself 404s for uat-other (canAccessRegistration false).
  - **DB:** registrations.status unchanged
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **WAIT-01** · `P0` `happy` `player` — Cancelling a paid confirmed slot promotes the oldest PAID waiting-list row to pending_payment with a new order, in one transaction
  - **Pre:**
    - uat tournament B paid division at capacity: one confirmed/paid registration (owned by current user, cancellable, before event date) and one waiting_list paid registration (position 1) owned by uat-other
  - **Steps:**
    1. Log in as the owner of the confirmed slot
    2. Open /my-registrations/{confirmedRegId}
    3. Enter reason 'uat free the slot' and confirm cancel
  - **Expected:**
    - Success message 'Cancelled. The oldest waiting-list registration was promoted.' (waitingListPromotion.promoted true)
    - The previously waiting row is now pending_payment with a NEW payment order (24h default expiry)
  - **DB:** cancelled reg.status=cancelled; promoted reg (uat-other) status -> pending_payment, waiting_list_position cleared, a NEW payment_orders row pending_payment with future expires_at; promotion ran exactly once
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **WAIT-02** · `P0` `happy` `player` — Cancelling a FREE confirmed slot promotes the oldest free waiting-list row directly to confirmed (no payment order)
  - **Pre:**
    - uat tournament C free division at capacity: one confirmed free registration (current user, cancellable) and one waiting_list free registration (position 1, uat-other)
  - **Steps:**
    1. Open /my-registrations/{confirmedFreeRegId}
    2. Enter reason and confirm cancel
  - **Expected:**
    - Success 'Cancelled. The oldest waiting-list registration was promoted.'
    - Promoted free row becomes confirmed with NO payment order created
  - **DB:** promoted reg.status -> confirmed, payment_order_id stays NULL, confirmed_at set, waiting_list_position cleared; no new payment_orders row
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **WAIT-03** · `P1` `happy` `player` — Cancelling when there is no waiting list reports no promotion
  - **Pre:**
    - An eligible registration in a division with NO waiting-list rows
  - **Steps:**
    1. Cancel the registration with a reason
  - **Expected:**
    - Success 'Cancelled. No waiting-list promotion was needed.' (waitingListPromotion.promoted false or null)
  - **DB:** no registration in that division transitioned out of waiting_list; only the cancelled reg changed
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **WAIT-04** · `P1` `happy` `player` — Promoted waiting-list player's new pending_payment order is payable end-to-end (QR + slip)
  - **Pre:**
    - After WAIT-01, the promoted account (uat-other) is logged in
  - **Steps:**
    1. As uat-other open /my-registrations -> the now pending_payment registration -> 'เปิดหน้าชำระเงิน'
    2. On /payments/{newOrderId} confirm QR + countdown render
    3. Upload valid.jpg
  - **Expected:**
    - New order shows QR for its amount_due and a future deadline
    - Slip upload moves the new order + registration to pending_verify
  - **DB:** the new payment_orders row -> pending_verify after upload; promoted registration -> pending_verify
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **WAIT-05** · `P2` `edge` `player` — No double promotion: second slot-opening for an already-filled division does not re-promote
  - **Pre:**
    - A division where the single waiting-list row was already promoted (WAIT-01) and no further waiting rows remain
  - **Steps:**
    1. Cancel another registration in the same division (if one exists and is eligible) OR re-run a promotion path
  - **Expected:**
    - Promotion returns promoted=false; success message 'Cancelled. No waiting-list promotion was needed.' (RPC promotes exactly once; repeated calls return promoted=false)
  - **DB:** no second waiting_list row exists to promote; no extra confirmed/pending_payment transitions
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **TIMEOUT-01** · `P0` `edge` `admin` — Admin timeout sweep expires an overdue pending_payment order + registration and promotes the next paid waiting-list row
  - **Pre:**
    - A pending_payment order with expires_at in the PAST and a paid waiting_list row (position 1) behind that division's full quota. Admin pages are not route-protected in dev.
  - **Steps:**
    1. Open http://127.0.0.1:3000/admin/payments
    2. Click the 'Run timeout sweep' button (limit 1)
  - **Expected:**
    - Sweep reports the expired order/registration and one promotion (calls expire_pending_payment_orders)
    - On /my-registrations the expired registration now shows สถานะ หมดเวลา; the promoted row shows รอชำระ (paid) or ยืนยันแล้ว (free)
  - **DB:** old payment_orders.status -> expired, expired_at set; expired registration.status -> expired; oldest waiting_list row promoted once (paid -> new pending_payment order; free -> confirmed)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **TIMEOUT-02** · `P1` `edge` `player` — Expired-but-not-swept order: user-facing page already treats it as expired
  - **Pre:**
    - An order with status still pending_payment in DB but expires_at in the past (sweep not yet run)
  - **Steps:**
    1. Open /payments/{orderId} and /my-registrations/{linkedRegId}
  - **Expected:**
    - /payments shows expired banner + no QR/upload (PAY-06)
    - /my-registrations detail shows 'เหลือเวลา: หมดเวลาแล้ว' on the payment panel (isPaymentExpired true). Status badge may still read รอชำระ until the sweep runs — record any mismatch in notes.
  - **DB:** payment_orders.status=pending_payment AND expires_at < now() (until sweep flips it to expired)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

> ⚠️ **ข้อสังเกตจากโค้ด (อ่านก่อนเทส suite นี้):**
> - AUTH SCOPE: User-facing payment/registration pages have NO dev-mode auth bypass (unlike /admin*). getCurrentAccount() relies on supabase.auth.getUser(). A logged-out tester gets 404 on /payments/[id] (notFound, NOT a /login redirect) and a /login redirect on /my-registrations. The tester must hold a real Supabase session cookie for every user-side case.
> - TITLE COLUMN MISMATCH: src/lib/registrations/payment.ts fetchTournament() selects 'id,title,title_en,event_date,event_starts_at,promptpay_id,promptpay_name' (no title_th) yet TournamentRow/getTournamentTitle reference title_th. If the tournaments table has no 'title' column the select will error; if it does, title_th fallback is dead. Verify the actual tournaments schema (title vs title_th/title_en) before trusting the displayed tournament title. my-registrations.ts has the same pattern.
> - MIME VALIDATION IS TYPE-BASED, NOT MAGIC-BYTE: both client (validateSlip) and server (validateSlipFile) check File.type against {image/jpeg,image/png}. A real JPEG/PNG with a tampered/empty type, or a non-image whose type is spoofed to image/jpeg, would bypass the check (the RPC does not re-validate content). This is a potential security gap worth flagging for hardening (content sniffing).
> - STORAGE ORPHAN ON RPC FAILURE: submitPaymentSlip uploads to Storage FIRST, then calls submit_payment_slip RPC; on RPC error it best-effort removes the object (.catch(()=>undefined)). If the remove fails, an orphaned slips object can linger. For the expiry/status guards that throw BEFORE upload, no object is created. Cleanup: check bucket 'slips' under {tournament_id}/{orderId}/ after negative SLIP tests.
> - EVENT-DATE DISPLAY vs CANCEL CUTOFF: list/detail formatEventDate renders eventDate as '{eventDate}T00:00:00.000Z' (UTC) via th-TH, which can show the previous calendar day for UTC+7 users, while the cancel cutoff isOnOrAfterEventDate compares the raw eventDate string against today's Bangkok date (en-CA). The cutoff logic is correct (Bangkok), but the displayed date may look off by one day — note for CANCEL-05 so testers compare against the DB event_date, not the rendered label.
> - SIGNED SLIP URL EXPIRY: createSignedUrl uses 600s (10 min). A slip link opened from a page loaded >10 min earlier may 400/expire; reload the page to regenerate. Applies to /payments/[id] and /my-registrations/[id].
> - WAITING-LIST SETUP IS THE HARD PART: capacity/quota and waiting_list_position are produced by create_registration_transaction (S5.1/S5.2), not by these pages. To get a deterministic waiting_list row, fill the paid/free division to its quota first, then register the next player. Promotion (S5.7) is FIFO by waiting_list_position, then created_at, then id; ensure the intended 'oldest' row truly has the lowest ordering.
> - PAYMENT-PAGE STATUS PANEL: when status is rejected/cancelled/expired/confirmed the page renders PaymentStatePanel (not QR). 'rejected' shows 'สลิปนี้ไม่ผ่านการตรวจสอบ...'. These states are produced by Admin actions (S5.6), so to exercise them the tester must drive /admin/payments first.
> - DEV PORT NOTE: the handoff smoke logs used port 3100, but the assigned base URL for this UAT is http://127.0.0.1:3000 (npm run dev -- --hostname 127.0.0.1 --port 3000). Use 3000.
> - TEST DATA HYGIENE: every write lands in the REAL linked Supabase dev project. Prefix all tournaments/accounts with uat-, and after testing delete created registrations, payment_orders, and slips Storage objects. Negative SLIP cases should leave NO slips object (validation precedes upload); verify and remove any strays.

---

<a id="suite-6"></a>
## 6. Admin Operations Queues + Referee Invite

**44 cases** — P0 `19` / P1 `12` / P2 `13` · happy `18` / negative `15` / edge `11`

<sub>Admin Operations Queues + Referee invite redeem (/admin dashboard, /admin/payments, /admin/ranks, /admin/roles, /admin/registrations + CSV export, /admin/users, /referee/invite)</sub>

**Routes:** `http://127.0.0.1:3000/admin` · `http://127.0.0.1:3000/admin/payments` · `http://127.0.0.1:3000/admin/ranks` · `http://127.0.0.1:3000/admin/roles` · `http://127.0.0.1:3000/admin/registrations` · `http://127.0.0.1:3000/admin/registrations/export.csv?tournamentId=...&divisionId=...&status=...` · `http://127.0.0.1:3000/admin/users` · `http://127.0.0.1:3000/referee/invite`

**Preconditions (suite-level):**
- Local dev server running: npm run dev -- --hostname 127.0.0.1 --port 3000 (base URL http://127.0.0.1:3000).
- All /admin* routes are NOT route-protected in dev mode; open them directly with no admin login. Admin pages render desktop (not the mobile frame).
- /referee/invite is a user-facing page inside the mobile frame and requires a logged-in account (redirects to /login if not).
- Supabase env present: NEXT_PUBLIC_SUPABASE_URL, publishable key, SUPABASE_SECRET_KEY/SERVICE_ROLE_KEY, and IDENTITY_HASH_SALT (referee invite hashing throws 'Missing IDENTITY_HASH_SALT' without it).
- Required Supabase migrations applied (else pages show 'Migration pending'/'RPC migration pending' banners): 202606080006_admin_payment_verification, 202606090001_waiting_list_promotion_timeout, 202606100001_pending_rank_approval, 202606110001_referee_invite_revoke, role-management + referee_invite_codes tables.
- Test data uses an obvious uat- prefix (e.g. uat-player-...@example.com) and is cleaned up after; all writes hit the REAL linked Supabase dev project.
- To exercise payment queue: at least one payment_order with status=pending_verify (created by submitting a slip on a real pending_payment order). To exercise waiting-list promotion on reject-cancel/timeout: a full paid division with a waiting_list registration behind the order under review.
- To exercise rank queue: at least one player_profiles row with rank_status=pending (a freshly registered uat player).
- To exercise referee redeem: a logged-in uat account that does NOT yet have an active referee role, plus a raw invite code captured once from /admin/roles.

<details><summary><b>Test data ที่ต้องเตรียม</b></summary>

- uat player account with rank_status=pending (for RANK-01..06).
- uat account that submitted a Coach role_request in pending state (for ROLE-COACH-01..03).
- A pending_verify payment_order with submitted slip on a single registration (for PAY-01..03, PAY-07).
- A pending_verify payment_order in a FULL paid division that also has a waiting_list registration behind it (for PAY-04 waiting-list promotion).
- An overdue pending_payment payment_order (expires_at in the past), ideally on a full division with a waiting_list row (for PAY-08).
- Fresh active referee invite raw code(s) captured once from /admin/roles (for REF-REDEEM-01/07 and ROLE-INV cases).
- A revoked invite (create then revoke) with its raw code (REF-REDEEM-02).
- An expired/unused invite with a past expires_at and its raw code (REF-REDEEM-03, ROLE-INV-04).
- An already-redeemed invite plus a second uat account without referee role (REF-REDEEM-04).
- A logged-in uat account WITHOUT an active referee role (REF-REDEEM-01..07).
- A tournament with divisions and registrations of mixed statuses incl. waiting_list (REG-01..07).
- A valid tournament UUID, a random non-existent UUID, and a known divisionId for export tests (REG-04..06).
- uat accounts spanning player/coach/referee/admin roles, some with player profiles and coach links (USER-01..05).

</details>

### Test cases

- [ ] **ADMIN-DASH-01** · `P0` `happy` `admin` — Dashboard shows LIVE queue counts for all four queues
  - **Pre:**
    - At least one pending_verify payment order, one pending rank profile, one pending coach request, and one active referee invite exist.
  - **Steps:**
    1. Open /admin
    2. Read the four OverviewWidget cards: 'Payment Verify', 'Rank Review', 'Coach Requests', 'Referee Invites'
    3. Read the 'Operation Queues' link cards lower on the page
  - **Expected:**
    - 'Payment Verify' value equals the count of payment_orders.status=pending_verify; detail line reads 'pending_verify slip queue'
    - 'Rank Review' value equals count of player_profiles.rank_status=pending
    - 'Coach Requests' value equals count of role_requests with requested_role=coach AND status=pending
    - 'Referee Invites' value = active invite count; detail shows '<redeemed> redeemed, <revoked> revoked'
    - Operation Queues 'Referee tools' card shows '<active> active invite(s), <expired> expired'
    - Counts are formatted with th-TH locale digits
  - **DB:** payment_orders.status=pending_verify; player_profiles.rank_status=pending; role_requests(requested_role=coach,status=pending); referee_invite_codes status buckets
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **ADMIN-DASH-02** · `P2` `edge` `admin` — Dashboard count cards degrade to '-' when a queue source errors (migration pending)
  - **Pre:**
    - Reproduce only if a relevant migration is intentionally unapplied; otherwise treat as observation-only.
  - **Steps:**
    1. Open /admin while a queue's table/RPC is missing (PGRST205 / 42703 / 42883)
  - **Expected:**
    - The affected widget value renders as '-' (not 0) and its detail line shows the error/'Migration pending' text instead of crashing the page
    - Other queue widgets still render their real counts (Promise.allSettled isolation)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **PAY-01** · `P0` `happy` `admin` — Payments queue lists only pending_verify orders with slip preview and registrations
  - **Pre:**
    - At least one payment_order with status=pending_verify and a uploaded slip in the private slips bucket.
  - **Steps:**
    1. Open /admin/payments
    2. Inspect the order card header, amount-due panel, registrations table, and the slip preview aside
  - **Expected:**
    - Header 'Pending verify' count equals number of pending_verify orders; total THB awaiting shown
    - Each card shows a 'pending_verify' badge, short order id, tournament title, payer email/phone, paid-at, amount due (or 'free' when 0)
    - Registrations table lists each linked registration with player name (first+last TH), rank, division, status badge, net fee
    - Slip aside shows storage path and an 'Open' link plus inline image when a signed URL was generated (10-min signed URL); if storage path missing it shows 'Signed URL unavailable'
  - **DB:** payment_orders.status=pending_verify; registrations.payment_order_id linkage
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **PAY-02** · `P0` `happy` `admin` — Approve payment confirms order + linked registrations
  - **Pre:**
    - A pending_verify order with one or more linked registrations.
  - **Steps:**
    1. Open /admin/payments
    2. On the target order, click 'Approve payment'
  - **Expected:**
    - Success status message: 'Payment approved. Confirmed N registration(s).' (N = updatedRegistrations, must be >=1)
    - Buttons become disabled after success (isComplete)
    - After reload the order disappears from the pending_verify queue and the /admin dashboard Payment Verify count drops by 1
  - **DB:** payment_orders.status -> confirmed; linked registrations.status -> confirmed (via approve_payment_order RPC)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **PAY-03** · `P0` `happy` `admin` — Reject, send new returns order + registrations to pending_payment and clears slip
  - **Pre:**
    - A pending_verify order with a submitted slip.
  - **Steps:**
    1. Open /admin/payments
    2. In the 'Reject, send new' form, type a reason (e.g. 'uat wrong amount')
    3. Click 'Reject, send new'
  - **Expected:**
    - Success message: 'Payment rejected. Returned N registration(s) to pending payment.'
    - Order leaves the pending_verify queue
  - **DB:** payment_orders.status -> pending_payment, slip fields cleared, rejection_reason recorded; linked registrations.status -> pending_payment (reject_payment_order_send_new RPC)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **PAY-04** · `P0` `happy` `admin` — Reject, cancel cancels both and promotes waiting list once
  - **Pre:**
    - A pending_verify order in a FULL paid division that has at least one waiting_list registration behind it.
  - **Steps:**
    1. Open /admin/payments
    2. In the 'Reject, cancel' form, type a reason (e.g. 'uat fraud')
    3. Click 'Reject, cancel'
  - **Expected:**
    - Success message: 'Payment rejected and cancelled. Cancelled N registration(s); completed M waiting-list promotion(s).'
    - When a waiting-list row existed, M is 1 for the opened division (FIFO by waiting_list_position then created_at then id)
  - **DB:** payment_orders.status -> cancelled with rejection/cancellation audit; linked registrations.status -> cancelled; oldest waiting_list registration in that division promoted exactly once (paid -> new pending_payment order; free -> confirmed) via reject_payment_order_cancel RPC
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **PAY-05** · `P1` `negative` `admin` — Reject requires a non-empty reason (validation)
  - **Pre:**
    - A pending_verify order exists.
  - **Steps:**
    1. Open /admin/payments
    2. Leave the 'Reject, send new' reason textarea empty
    3. Attempt to submit 'Reject, send new'
  - **Expected:**
    - Browser blocks submit because the textarea has required; if bypassed, server action returns error 'Reason is required for rejection.'
    - No status change occurs on the order
  - **DB:** payment_orders.status unchanged (still pending_verify)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **PAY-06** · `P2` `edge` `admin` — Reject reason over 500 chars is rejected
  - **Pre:**
    - A pending_verify order exists.
  - **Steps:**
    1. Open /admin/payments
    2. Paste a >500 character reason into a reject form (textarea maxLength=500 caps typed input; use paste/devtools to exceed)
    3. Submit
  - **Expected:**
    - If length still exceeds 500 server-side, action returns error 'Reason must be 500 characters or fewer.' and no change occurs
    - Within 500 chars the reject succeeds normally
  - **DB:** payment_orders.status unchanged on validation failure
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **PAY-07** · `P1` `negative` `admin` — Approving an order that is no longer pending_verify fails cleanly
  - **Pre:**
    - Open /admin/payments in two tabs (or approve, then re-submit before reload) so the same order is acted on twice.
  - **Steps:**
    1. Approve the order in tab 1 (succeeds)
    2. Without reloading tab 2, click 'Approve payment' on the same order in tab 2
  - **Expected:**
    - Tab 2 shows an error message surfaced from the RPC (order is no longer pending_verify); the controls show the error alert styling
    - No double-confirm side effects
  - **DB:** payment_orders.status stays confirmed; registrations not re-mutated (approve_payment_order requires pending_verify)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **PAY-08** · `P0` `happy` `admin` — Run timeout sweep expires overdue pending_payment orders and promotes waiting list
  - **Pre:**
    - At least one pending_payment payment_order whose expires_at is in the past, ideally on a full division with a waiting_list row.
  - **Steps:**
    1. Open /admin/payments
    2. In the 'Pending verify' summary panel, click 'Run timeout sweep'
  - **Expected:**
    - Success message: 'Timeout sweep complete: X expired order(s), Y registration(s), Z promotion(s).'
    - Pluralization is correct for 1 vs many
    - Expired order(s) leave the pending_payment state
  - **DB:** expire_pending_payment_orders RPC: overdue payment_orders -> expired with expired_at; linked registrations -> expired; oldest waiting_list per opened division promoted once
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **PAY-09** · `P2` `edge` `admin` — Run timeout sweep with nothing overdue reports zeros
  - **Pre:**
    - No pending_payment orders are past expires_at.
  - **Steps:**
    1. Open /admin/payments
    2. Click 'Run timeout sweep'
  - **Expected:**
    - Success message reads 'Timeout sweep complete: 0 expired orders, 0 registrations, 0 promotions.'
    - No rows change
  - **DB:** No payment_orders/registrations transition; no promotions
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **PAY-10** · `P2` `edge` `admin` — Empty payments queue shows the empty state
  - **Pre:**
    - No payment_orders.status=pending_verify.
  - **Steps:**
    1. Open /admin/payments
  - **Expected:**
    - Shows 'No payment slips waiting' empty card
    - 'Pending verify' count is 0
    - 'Run timeout sweep' control still available
  - **DB:** count of payment_orders.status=pending_verify = 0
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **RANK-01** · `P0` `happy` `admin` — Pending rank queue lists self-declared pending ranks oldest-first
  - **Pre:**
    - At least one player_profiles.rank_status=pending row (a fresh uat player).
  - **Steps:**
    1. Open /admin/ranks
    2. Inspect the card list and the 'Oldest request' metric
  - **Expected:**
    - 'Pending ranks' metric equals count of rank_status=pending
    - Cards are ordered created_at ascending (oldest first); 'Oldest request' equals first card's created time
    - Each card shows name TH/EN, declared rank, power level, institute, account email/phone, status 'pending' badge
  - **DB:** player_profiles.rank_status=pending ordered by created_at asc
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **RANK-02** · `P0` `happy` `admin` — Approve rank as-is verifies without changing rank
  - **Pre:**
    - A pending rank profile with a known declared rank (e.g. '5 Kyu').
  - **Steps:**
    1. Open /admin/ranks
    2. On the target card click 'Approve as-is'
  - **Expected:**
    - Success message: 'Rank approved: <rank> -> <rank> (power <powerLevel>).' with original == final
    - Card disappears from the queue after reload and dashboard Rank Review count drops by 1
  - **DB:** player_profiles.rank_status -> verified; rank unchanged; power_level matches rank_to_power_level; rank review audit fields (reviewed_at, etc.) populated via approve_player_profile_rank RPC
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **RANK-03** · `P0` `happy` `admin` — Edit rank then approve recalculates power_level
  - **Pre:**
    - A pending rank profile.
  - **Steps:**
    1. Open /admin/ranks
    2. In the edit form, change 'Final rank' to a different valid option (e.g. '1 Dan'); observe the 'Power N' pill updates to 17
    3. Optionally add a review note
    4. Click 'Save edited rank'
  - **Expected:**
    - Power pill shows the recalculated power for the selected rank before submit (e.g. 1 Dan -> Power 17; 1 Kyu -> 16; 15 Kyu -> 2)
    - Success message: 'Rank approved: <original> -> <newRank> (power <newPower>).'
    - Card leaves the queue
  - **DB:** player_profiles.rank -> newRank; power_level recalculated; rank_status -> verified; admin_note stored when provided
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **RANK-04** · `P1` `negative` `admin` — Edit-rank with empty final rank is rejected
  - **Pre:**
    - A pending rank profile; the select normally always has a value, so use devtools to clear the finalRank field before submit.
  - **Steps:**
    1. On a card, clear the finalRank select value (devtools) and submit 'Save edited rank'
  - **Expected:**
    - Action returns error 'Choose a final rank.' (superRefine) and no change occurs
  - **DB:** player_profiles.rank_status unchanged (still pending)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **RANK-05** · `P1` `negative` `admin` — Approving an already-verified rank fails
  - **Pre:**
    - Open /admin/ranks in two tabs, or approve then immediately re-submit the same card before reload.
  - **Steps:**
    1. Approve a card in tab 1 (rank_status becomes verified)
    2. Without reloading tab 2, click 'Approve as-is' on the same profile in tab 2
  - **Expected:**
    - Tab 2 shows an error alert surfaced from the RPC because the profile is no longer rank_status=pending; the message renders with the CircleAlert error styling
    - No second audit write
  - **DB:** approve_player_profile_rank requires rank_status=pending; profile stays verified, no re-verification
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **RANK-06** · `P2` `edge` `admin` — Empty rank queue shows empty state
  - **Pre:**
    - No player_profiles.rank_status=pending.
  - **Steps:**
    1. Open /admin/ranks
  - **Expected:**
    - Shows 'No pending ranks' empty card; 'Pending ranks' metric is 0; 'Oldest request' shows '-'
  - **DB:** count of player_profiles.rank_status=pending = 0
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **ROLE-COACH-01** · `P0` `happy` `admin` — Approve Coach request grants active coach role
  - **Pre:**
    - A pending coach role_request exists (uat account submitted a coach request).
  - **Steps:**
    1. Open /admin/roles
    2. In the 'Coach approval queue', find the pending request and click 'Approve'
  - **Expected:**
    - Request row updates to status approved (badge turns green); 'Coach pending' metric drops by 1 after reload
    - The Approve/Reject buttons are only shown while status=pending
  - **DB:** role_requests.status -> approved; account_roles for that account gains role=coach status=active (review_coach_request RPC)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **ROLE-COACH-02** · `P1` `happy` `admin` — Reject Coach request keeps player-only (no coach role)
  - **Pre:**
    - A pending coach role_request exists.
  - **Steps:**
    1. Open /admin/roles
    2. Click 'Reject' on the pending coach request
  - **Expected:**
    - Request row updates to rejected; account does NOT gain a coach role
    - 'Coach pending' metric drops by 1
  - **DB:** role_requests.status -> rejected; account_roles has no active coach role for that account
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **ROLE-COACH-03** · `P2` `edge` `admin` — Empty coach queue shows empty text
  - **Pre:**
    - No coach role_requests at all.
  - **Steps:**
    1. Open /admin/roles
  - **Expected:**
    - Coach approval queue shows 'ยังไม่มีคำขอ Coach ในระบบ'
    - 'Coach pending' metric is 0
  - **DB:** count of role_requests(requested_role=coach) = 0
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **ROLE-INV-01** · `P0` `happy` `admin` — Create Referee invite shows the raw code exactly once
  - **Pre:**
    - None beyond admin page access; IDENTITY_HASH_SALT set.
  - **Steps:**
    1. Open /admin/roles
    2. In 'Create invite code' choose an 'Expires' option (1 / 7 / 14 / 30 days)
    3. Click 'Create'
    4. Note the displayed REF-XXXX-XXXX-XX code, use 'Copy', then RELOAD the page
  - **Expected:**
    - A success panel shows the raw code in REF-XXXX-XXXX-XX format with a Copy button and 'Invite created. Expires <date>.' message
    - After reload the raw code is NOT shown again (only status badges in 'Recent invites'); the new invite appears as 'active' with 'Expires <datetime>'
    - 'Active invites' metric increments by 1
  - **DB:** referee_invite_codes gains a row with status=unused and a salted sha256 code_hash (raw code NOT stored); expires_at = now + chosen days (create_referee_invite RPC)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **ROLE-INV-02** · `P2` `negative` `admin` — Create invite rejects out-of-range expiry
  - **Pre:**
    - The select only offers 1/7/14/30; use devtools to send expiresInDays=0 or 31.
  - **Steps:**
    1. Open /admin/roles
    2. Force the expiresInDays form value to 0 (or 31) via devtools and submit Create
  - **Expected:**
    - Action returns an error (invite expiry must be int 1..30); no invite is created
    - Error alert renders under the form
  - **DB:** no new referee_invite_codes row
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **ROLE-INV-03** · `P0` `happy` `admin` — Revoke is shown only for active invites and revokes one
  - **Pre:**
    - At least one active (unused, not expired) referee invite in 'Recent invites'.
  - **Steps:**
    1. Open /admin/roles
    2. On an 'active' invite, click 'Revoke'
  - **Expected:**
    - Success message 'Invite revoked at <datetime>.'; after reload the invite badge becomes 'revoked' and no longer offers a Revoke button
    - Redeemed/expired/revoked invites never show a Revoke button
    - Dashboard Referee Invites detail revoked count increments
  - **DB:** referee_invite_codes.status -> revoked, revoked_at/revoked_by set (revoke_referee_invite RPC)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **ROLE-INV-04** · `P1` `edge` `admin` — Recent invites display correct status buckets including expired-by-time
  - **Pre:**
    - Have at least one unused invite whose expires_at is already in the past (e.g. created with 1-day expiry and time elapsed, or a seeded past expiry).
  - **Steps:**
    1. Open /admin/roles and review the 'Recent invites' list (limit 20, newest first)
  - **Expected:**
    - An unused invite whose expires_at < now displays as 'expired' (computed display status) with 'Expired <datetime>', even though its stored status is still unused
    - Redeemed invites show 'Redeemed <datetime>' and the redeemer email; revoked show 'Revoked <datetime>' and revoker email
    - Status buckets here match the /admin dashboard Referee Invite counts
  - **DB:** referee_invite_codes status + expires_at; display 'expired' derived when status=unused and expires_at<=now
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REF-REDEEM-01** · `P0` `happy` `player` — Redeem a valid active invite grants active referee role
  - **Pre:**
    - Logged-in uat account WITHOUT an active referee role; a fresh active invite raw code captured from /admin/roles.
  - **Steps:**
    1. Log in as the uat account
    2. Open /referee/invite (mobile frame)
    3. Type the REF-XXXX-XXXX-XX code into 'Invite code'
    4. Click 'Redeem invite'
  - **Expected:**
    - Success status box: 'เพิ่ม role Referee สำเร็จแล้ว'
    - On reload /referee/invite now shows 'บัญชีนี้มี role Referee แล้ว' instead of the form (because the account has an active referee role)
  - **DB:** account_roles gains role=referee status=active for the account; referee_invite_codes.status -> redeemed, redeemed_at/redeemed_by set (redeem_referee_invite RPC)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REF-REDEEM-02** · `P0` `negative` `player` — Redeeming a REVOKED invite fails and grants no role
  - **Pre:**
    - Create an invite, capture its raw code, then revoke it from /admin/roles. Use a logged-in uat account without referee role.
  - **Steps:**
    1. Open /referee/invite logged in
    2. Enter the revoked invite's raw code
    3. Click 'Redeem invite'
  - **Expected:**
    - Error alert renders with the RPC error message; no success
    - Account does NOT gain a referee role; form remains (no 'มี role Referee แล้ว')
  - **DB:** redeem_referee_invite rejects revoked code; account_roles unchanged (no active referee)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REF-REDEEM-03** · `P1` `negative` `player` — Redeeming an EXPIRED invite fails and grants no role
  - **Pre:**
    - An invite whose expires_at is in the past (unused) and its raw code; logged-in uat account without referee role.
  - **Steps:**
    1. Open /referee/invite logged in
    2. Enter the expired invite code
    3. Click 'Redeem invite'
  - **Expected:**
    - Error alert from the RPC; no referee role granted
    - Form stays visible
  - **DB:** redeem_referee_invite rejects expired code; account_roles unchanged
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REF-REDEEM-04** · `P1` `negative` `player` — Redeeming an already-redeemed invite fails
  - **Pre:**
    - An invite already redeemed by another account (status=redeemed); a second logged-in uat account without referee role, holding the same raw code.
  - **Steps:**
    1. Open /referee/invite as the second account
    2. Enter the already-redeemed code
    3. Click 'Redeem invite'
  - **Expected:**
    - Error alert; second account does NOT gain referee role
  - **DB:** redeem_referee_invite rejects already-redeemed code; second account_roles unchanged
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REF-REDEEM-05** · `P1` `negative` `guest` — Redeem requires login
  - **Pre:**
    - No active session.
  - **Steps:**
    1. Open /referee/invite while logged out
  - **Expected:**
    - Page redirects to /login (server-side getCurrentAccount null guard)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REF-REDEEM-06** · `P2` `negative` `player` — Too-short / empty code is rejected before any RPC
  - **Pre:**
    - Logged-in uat account without referee role.
  - **Steps:**
    1. Open /referee/invite
    2. Enter a code under 6 characters (e.g. 'REF')
    3. Click 'Redeem invite'
  - **Expected:**
    - Error alert: 'กรุณากรอก invite code' (min 6 chars zod validation); no RPC call, no role granted
  - **DB:** account_roles unchanged
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REF-REDEEM-07** · `P2` `edge` `player` — Code normalization tolerates dashes/lowercase
  - **Pre:**
    - A fresh active invite with known raw code; logged-in uat account without referee role.
  - **Steps:**
    1. Open /referee/invite
    2. Enter the code WITHOUT dashes and in lowercase (e.g. refabcdwxyz12 form of REF-ABCD-WXYZ-12)
    3. Click 'Redeem invite'
  - **Expected:**
    - Redeem still succeeds because hashRefereeInviteCode strips non-alphanumerics and uppercases before hashing
    - Success message and referee role granted
  - **DB:** referee_invite_codes.status -> redeemed; account_roles gains active referee
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-01** · `P0` `happy` `admin` — Registrations list filters by tournament, division, and status
  - **Pre:**
    - At least one tournament with divisions and several registrations of mixed statuses.
  - **Steps:**
    1. Open /admin/registrations
    2. Select a tournament in the toolbar and click 'Open list'
    3. Click a division filter link, then a status filter link (e.g. waiting_list)
  - **Expected:**
    - Table shows rows for the selected tournament; selecting a division narrows to that division; selecting a status narrows to that status
    - Status filter chips show per-status counts; 'Shown rows' metric matches the table row count
    - Waiting-list rows show a '#position' suffix on the status badge
    - Each row shows order no, player TH/EN name, institute, division, status, source (Self/Coach/Admin), registered-by email/name/role, rank+power, registered-at
  - **DB:** registrations filtered by tournament_id (+ division_id, status) — staff-safe read only
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-02** · `P0` `happy` `admin` — CSV export downloads staff-safe columns only
  - **Pre:**
    - A tournament with at least one registration.
  - **Steps:**
    1. Open /admin/registrations for a tournament
    2. Click 'Download CSV' (or open /admin/registrations/export.csv?tournamentId=<id>)
    3. Open the downloaded file
  - **Expected:**
    - File downloads as tesuji-registrations-<tournament>-<division|all-divisions>.csv with UTF-8 BOM
    - Header row is exactly: Order No, Tournament, Division, Player Name TH, Player Name EN, Rank, Power Level, Institute, Status, Registered At, Source, Registered By Email, Registered By Name TH, Registered By Name EN, Registered By Role, Registered By Roles, Waiting List Position
    - Filtered export (divisionId/status query) contains only matching rows
  - **DB:** Export rows mirror registrations for the scope
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-03** · `P0` `negative` `admin` — CSV export EXCLUDES identity/national-id/passport/document hashes and private slip fields
  - **Pre:**
    - A registration whose player profile and payment order have identity/slip data populated.
  - **Steps:**
    1. Download the CSV for that tournament
    2. Search the file content for sensitive markers
  - **Expected:**
    - CSV contains NONE of: national id, passport, identity/document hash columns, slip URL, slip storage path, or any payment slip field — only the 17 staff-safe headers from REG-02
    - No phone or email of the player profile beyond the registered-by email column defined in the header set
  - **DB:** exportAdminRegistrationCsv selects only staff-safe columns (no identity/document hashes, no private slip fields)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-04** · `P1` `negative` `admin` — CSV export with missing tournamentId returns 400
  - **Pre:**
    - None.
  - **Steps:**
    1. Open /admin/registrations/export.csv with no query params
  - **Expected:**
    - HTTP 400 JSON: { error: 'tournamentId is required.' }
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-05** · `P1` `negative` `admin` — CSV export with invalid status returns 400
  - **Pre:**
    - A valid tournamentId.
  - **Steps:**
    1. Open /admin/registrations/export.csv?tournamentId=<id>&status=bogus_status
  - **Expected:**
    - HTTP 400 JSON error 'Invalid registration status: bogus_status'
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-06** · `P2` `negative` `admin` — CSV export with unknown tournamentId returns 404
  - **Pre:**
    - A well-formed UUID that is not a real tournament.
  - **Steps:**
    1. Open /admin/registrations/export.csv?tournamentId=<random-uuid>
  - **Expected:**
    - HTTP 404 JSON error containing 'not found' (Tournament not found.)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **REG-07** · `P2` `edge` `admin` — Registrations page empty/edge states
  - **Pre:**
    - A tournament with a division but no registrations (or no divisions).
  - **Steps:**
    1. Open /admin/registrations and select that tournament
    2. Apply a status filter that matches nothing
  - **Expected:**
    - No tournaments at all -> 'No tournaments yet' state with New tournament CTA
    - Tournament with no divisions -> 'No divisions in this tournament' state
    - Scope with no matching rows -> 'No registrations for this view' state describing current division/status scope
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **USER-01** · `P0` `happy` `admin` — Users page read-only search by email/name/uuid
  - **Pre:**
    - At least one uat account exists with a player profile and roles.
  - **Steps:**
    1. Open /admin/users
    2. Type a uat email fragment in Search and click Search
    3. Repeat with a name fragment and with a full account UUID
  - **Expected:**
    - Matching account rows render with account email/phone, active-role pill, profile name/rank/power/institute, role badges (role:status), Coach link counts (as coach / as player), pending coach requests, created/last-login
    - Table header shows a 'read-only' pill; no edit/delete controls exist
    - Filter summary line echoes Query / Role scope / Result limit
  - **DB:** accounts + account_roles + role_requests + player_profiles + coach_player_links read only
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **USER-02** · `P1` `happy` `admin` — Users role filter and limit selectors apply
  - **Pre:**
    - Accounts spanning multiple roles (player/coach/referee/admin).
  - **Steps:**
    1. Open /admin/users
    2. Set Role to 'coach' and Limit to 25, click Search
    3. Change Role to 'all'
  - **Expected:**
    - Role=coach shows only accounts that have a coach role row; 'Active coaches' metric reflects active coaches in view
    - Limit caps the number of rows to 25; Role scope and Result limit shown in the summary line
  - **DB:** account_roles filtered by role; accounts limited to selected limit
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **USER-03** · `P2` `edge` `admin` — Users invalid limit/role params fall back to defaults
  - **Pre:**
    - None.
  - **Steps:**
    1. Open /admin/users?limit=999&role=wizard
    2. Open /admin/users?limit=37
  - **Expected:**
    - Unknown role falls back to 'all'; limit not in {25,50,100} falls back to 50 (so 999 and 37 both render as 50)
    - Page does not error on junk params
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **USER-04** · `P0` `negative` `admin` — Users page EXCLUDES identity/national-id/passport/document hashes and slip fields
  - **Pre:**
    - A uat account whose profile/payment data include identity hashes and a submitted slip.
  - **Steps:**
    1. Open /admin/users and search that account
    2. Inspect rendered cells and page source/DOM (data-* attributes too)
  - **Expected:**
    - No national id, passport, identity/document hash, private slip URL, slip storage path, or payment slip field is selected or rendered anywhere on the page
    - Only staff-safe account/profile/role/coach-link fields appear (email, phone, names, rank, power, institute, role:status, link counts, request status, timestamps)
  - **DB:** getAdminUsers selects only staff-safe columns; no identity-hash/slip columns selected
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **USER-05** · `P2` `edge` `admin` — Users search with no matches shows empty state
  - **Pre:**
    - None.
  - **Steps:**
    1. Open /admin/users
    2. Search a string that matches no account (e.g. zzz-uat-nomatch)
  - **Expected:**
    - 'No users for this view' empty card describing the current search and role scope; 'Shown users' metric is 0
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

> ⚠️ **ข้อสังเกตจากโค้ด (อ่านก่อนเทส suite นี้):**
> - Admin mutation seam ensureAdminMutationAllowedForDevMode()/getAdminActorAccountIdForDevMode() pass null in dev mode, so all approve/reject/revoke/rank/timeout RPCs run with p_admin_account_id=null and no Admin-role check — the tester needs no admin login. This is intentional dev behavior, not a bug, but means anyone reaching /admin* can mutate real data; flag for production hardening before launch.
> - POTENTIAL BUG (PAY-02): reviewPaymentResultSchema requires updatedRegistrations to be a positive int (z.coerce.number().int().positive()). If approve_payment_order ever returns 0 updated registrations, the Zod parse throws AFTER the DB transaction commits, surfacing a confusing client error even though the approval succeeded. Worth a tester note if approve shows an error but the order still becomes confirmed on reload.
> - The PaymentReviewControls share one useActionState across approve + both reject forms, and disable ALL controls once any action succeeds (isComplete). After one action on a card the other buttons are intentionally locked until reload — expected, but note it so testers do not mis-read it as a bug.
> - Rank edit-rank validation differs slightly by layer: the page select only offers selfDeclaredRankOptions (15 Kyu..1 Kyu, 1 Dan..9 Dan), the action requires finalRank within that set, and the lib re-validates via rankToPowerLevel. 9x9/13x13 map to power 0/1 in rankToPowerLevel but are NOT in selfDeclaredRankOptions, so they cannot be chosen as a final rank.
> - Referee invite display 'expired' is computed client/server-side from status=unused AND expires_at<=now (getRefereeInviteDisplayStatus); the stored row may still be status=unused until a redeem attempt marks it expired. Dashboard counts and /admin/roles use the same derivation so they should agree.
> - Slip preview uses a 10-minute signed URL from the private slips bucket; if the page sits open longer than 10 minutes the inline image/Open link may 403 — reload to regenerate. Not a defect.
> - redeem/create/revoke referee invite all require IDENTITY_HASH_SALT; without it hashRefereeInviteCode throws 'Missing IDENTITY_HASH_SALT' and create/redeem fail. Confirm the env var before running referee tests.
> - After a successful redeem the user already holds an active referee role, so re-opening /referee/invite shows the 'already has role' panel and the form is hidden — to retest redemption use a different uat account.
> - Registrations CSV and /admin/users are the two surfaces explicitly required to exclude identity/national-id/passport/document hashes and private slip fields; both were verified in code to select only staff-safe columns (registrations.ts csvHeaders/select lists; users.ts select lists). USER-04 and REG-03 are the targeted leak checks.
> - Clean up all uat- rows after testing: created referee_invite_codes, role_requests, granted account_roles (coach/referee), and any registrations/payment_orders mutated by approve/reject/timeout. These are REAL writes to the linked Supabase dev project.

---

<a id="suite-7"></a>
## 7. Manual Notifications

**24 cases** — P0 `10` / P1 `10` / P2 `4` · happy `12` / negative `7` / edge `5`

<sub>Manual Notifications (Admin compose at /admin/notifications + user inbox at /notifications, unread-count entry points on Home and /profile)</sub>

**Routes:** `/admin/notifications` · `/admin/notifications?accountQ=<query>` · `/notifications` · `/ (Home notifications tile)` · `/profile (Notifications unread pill)` · `/login (redirect target when /notifications hit while logged out)`

**Preconditions (suite-level):**
- Dev server running: npm run dev -- --hostname 127.0.0.1 --port 3000 (base http://127.0.0.1:3000)
- Migration 202606120001_manual_notifications.sql is applied to the linked Supabase project (tables manual_notifications, manual_notification_recipients, RPC create_manual_notification, RLS policies). If missing, /admin/notifications shows the 'Notifications unavailable / tables or RPC are not ready' panel.
- /admin/* is NOT route-protected in dev (ensureAdminMutationAllowedForDevMode() is a no-op), so open /admin/notifications directly with no admin login; Admin sends use the service-role client (bypass RLS).
- At least one uat- test player account exists and can log in to view /notifications via authenticated RLS.
- For tournament-audience tests, at least one uat- tournament exists with registrations in mixed statuses (confirmed/pending + at least one cancelled/expired/rejected), where some registrations have a distinct registered_by_account_id (e.g. coach-registered) vs the player owner account.
- All test rows use an obvious uat- prefix (titles, account emails, tournament titles) and are cleaned up afterward.

<details><summary><b>Test data ที่ต้องเตรียม</b></summary>

- uat-notif-player1@... : a player account with a known accounts.id (auth.uid) used as a single selected recipient and to log in to /notifications.
- uat-notif-player2@... : a second player account used to confirm one user cannot read/mark another user's recipient row (RLS).
- uat-notif-tour : a tournament with: (a) >=1 confirmed/pending registration whose player_profiles.account_id differs from registered_by_account_id (coach/admin-registered) to exercise dedupe of owner + registered_by, and (b) >=1 registration in cancelled OR expired OR rejected status that must be EXCLUDED.
- A valid but NON-EXISTENT account UUID (e.g. 00000000-0000-0000-0000-000000000000) to test silent drop / zero-recipient rejection.
- A malformed/non-UUID token (e.g. 'not-a-uuid') to test form UUID validation on pasted IDs.
- An https link (e.g. https://example.com/uat) and a relative link (e.g. /my-registrations) for safe-link tests; an unsafe link (e.g. javascript:alert(1) or ftp://x) for link validation negative test.

</details>

### Test cases

- [ ] **MNOT-01** · `P0` `happy` `admin` — Admin compose page loads with metrics, compose form, and recent sends
  - **Pre:**
    - Migration applied
    - At least 1 tournament and >=1 account exist
  - **Steps:**
    1. Open http://127.0.0.1:3000/admin/notifications directly (no login).
    2. Observe header metrics: 'Accounts', 'Tournaments', 'Recent sends'.
    3. Observe the 'Compose notification' section with Recipient mode cards (All accounts / Tournament / Selected), a 'Preview recipients' number, Title, Body, Optional link fields, and a 'Send notification' button.
    4. Observe the right-hand 'Account search' and 'Send guardrails' panels and the 'Recent sends' section below.
  - **Expected:**
    - Page renders desktop layout (not mobile frame).
    - 'Accounts' metric equals the real accounts row count; 'Tournaments' equals number of tournaments listed (<=100).
    - 'All accounts' card count equals the Accounts metric; default selected recipient mode is 'All accounts' and Preview recipients equals that count.
    - No 'Notifications unavailable' panel is shown (would only appear if migration/RPC missing).
  - **DB:** accounts (count = Accounts metric); tournaments (count = Tournaments metric)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **MNOT-02** · `P0` `happy` `admin` — Send to all_accounts creates one recipient row per account
  - **Pre:**
    - Migration applied
    - Known total accounts count N
  - **Steps:**
    1. On /admin/notifications select recipient mode 'All accounts'.
    2. Enter Title 'uat-all-accounts' and Body 'uat all accounts body'.
    3. Leave Optional link empty.
    4. Click 'Send notification'.
  - **Expected:**
    - Green result line 'Notification sent to N recipient(s).' where N equals the Accounts metric.
    - Result sub-line shows 'Notification <shortId> / all_accounts'.
    - Recent sends gains a row: Audience 'All accounts', Recipients = N, Read = 0, 'N unread'.
  - **DB:** manual_notifications: 1 new row audience_type='all_accounts', tournament_id NULL, created_by NULL, link_url NULL. manual_notification_recipients: exactly N rows for that notification_id (one per accounts.id), all read_at NULL.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **MNOT-03** · `P0` `happy` `admin` — Send to a single selected account (checkbox) creates exactly one recipient
  - **Pre:**
    - uat-notif-player1 account exists
  - **Steps:**
    1. In the 'Account search' panel enter uat-notif-player1's email in 'Search accounts' and click Search.
    2. Back in compose, select recipient mode 'Selected'.
    3. Tick the checkbox for the uat-notif-player1 result under 'Selected account IDs'.
    4. Confirm the 'Selected' card count and Preview recipients show 1.
    5. Enter Title 'uat-selected-one' and Body 'uat selected body', then click 'Send notification'.
  - **Expected:**
    - Green result 'Notification sent to 1 recipient.' and sub-line '... / selected_accounts'.
    - Recent sends shows a 'Selected' row with Recipients = 1, Read = 0.
  - **DB:** manual_notifications: audience_type='selected_accounts', tournament_id NULL. manual_notification_recipients: exactly 1 row with account_id = uat-notif-player1 accounts.id, read_at NULL.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **MNOT-04** · `P0` `edge` `admin` — Selected audience dedupes checked + pasted duplicate UUIDs to one recipient
  - **Pre:**
    - uat-notif-player1 account exists; know its accounts.id UUID
  - **Steps:**
    1. Select recipient mode 'Selected'.
    2. Search and tick the checkbox for uat-notif-player1.
    3. In 'Paste account UUIDs' paste uat-notif-player1's accounts.id twice separated by a comma and a newline (e.g. '<uuid>, <uuid>').
    4. Observe the live 'Selected' card count / Preview recipients.
    5. Enter Title 'uat-dedupe' and Body 'uat dedupe body' and click Send.
  - **Expected:**
    - Live preview count shows 1 (Set dedupe of checked + 2 pasted duplicates).
    - Result line 'Notification sent to 1 recipient.'
  - **DB:** manual_notification_recipients: exactly 1 row for this notification (unique(notification_id, account_id) + DISTINCT prevents duplicates), not 3.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **MNOT-05** · `P1` `edge` `admin` — Selected audience drops well-formed but non-existent UUIDs
  - **Pre:**
    - uat-notif-player1 account exists
  - **Steps:**
    1. Select recipient mode 'Selected'.
    2. Search and tick uat-notif-player1.
    3. In 'Paste account UUIDs' add a valid-format but non-existent UUID 00000000-0000-0000-0000-000000000000.
    4. Note the Preview recipients shows 2 (client cannot know the UUID is fake).
    5. Enter Title 'uat-ghost-uuid' and Body, click Send.
  - **Expected:**
    - Preview shows 2 but result line shows 'Notification sent to 1 recipient.' (RPC drops the non-existent UUID via join to accounts).
    - No error is shown for the dropped UUID.
  - **DB:** manual_notification_recipients: exactly 1 row (only the real account), none for 0000...0000.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **MNOT-06** · `P0` `negative` `admin` — Selected audience with only non-existent UUIDs is rejected (zero recipients, no row kept)
  - **Pre:**
    - None
  - **Steps:**
    1. Select recipient mode 'Selected'.
    2. Tick no checkboxes; paste ONLY a valid-format non-existent UUID 11111111-1111-1111-1111-111111111111.
    3. Enter Title 'uat-zero' and Body, click Send.
  - **Expected:**
    - Red error result line 'Notification audience has no recipients' (RPC raises and rolls back).
    - No 'Recent sends' row is added for this title.
  - **DB:** manual_notifications: NO row with title 'uat-zero' (inserted row was deleted by RPC). manual_notification_recipients: none added.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **MNOT-07** · `P1` `negative` `admin` — Pasting a malformed (non-UUID) account id is rejected by form validation before send
  - **Pre:**
    - None
  - **Steps:**
    1. Select recipient mode 'Selected'.
    2. Paste a non-UUID token 'not-a-uuid' in 'Paste account UUIDs' (no checkboxes).
    3. Enter Title 'uat-bad-uuid' and Body, click Send.
  - **Expected:**
    - Red error result line indicating an invalid uuid (first zod issue from accountIds: z.array(z.string().uuid())).
    - RPC is never called; no notification created.
  - **DB:** manual_notifications: no row created for this attempt.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **MNOT-08** · `P1` `negative` `admin` — Selected mode with no checkbox and empty paste is rejected
  - **Pre:**
    - None
  - **Steps:**
    1. Select recipient mode 'Selected'.
    2. Leave all checkboxes unticked and the paste box empty.
    3. Enter Title 'uat-empty-selected' and Body, click Send.
  - **Expected:**
    - Red error result line 'Choose or paste at least one account ID.' (form superRefine).
    - No notification created.
  - **DB:** manual_notifications: no row created.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **MNOT-09** · `P0` `happy` `admin` — Tournament audience recipients = registered player owner + registered_by, deduped
  - **Pre:**
    - uat-notif-tour has a coach/admin-registered registration where player_profiles.account_id != registered_by_account_id, plus a self-registered one
  - **Steps:**
    1. Select recipient mode 'Tournament'.
    2. In 'Tournament recipient source' select uat-notif-tour (note the '- N recipients' shown in the option and the card/Preview count).
    3. Enter Title 'uat-tournament' and Body, click Send.
  - **Expected:**
    - Result 'Notification sent to N recipient(s).' where N matches the preview recipient count for that tournament.
    - Recipients include BOTH the player owner account and the distinct registered_by account; a self-registered player counted once.
    - Recent sends shows a 'Tournament' row with the tournament title and Recipients = N.
  - **DB:** manual_notifications: audience_type='tournament_registrants', tournament_id = uat-notif-tour id. manual_notification_recipients: one distinct row per unique recipient account (player_profiles.account_id UNION registered_by_account_id), no duplicates.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **MNOT-10** · `P0` `edge` `admin` — Tournament audience excludes cancelled / expired / rejected registrations
  - **Pre:**
    - uat-notif-tour has at least one registration in cancelled OR expired OR rejected whose account is NOT also in any active registration
  - **Steps:**
    1. Note the account of a cancelled/expired/rejected-only registrant in uat-notif-tour.
    2. Select recipient mode 'Tournament', choose uat-notif-tour, send Title 'uat-tour-exclude' + Body.
  - **Expected:**
    - Result recipient count does NOT include the cancelled/expired/rejected-only account.
    - Preview recipient count for the tournament matches the sent count (current enum: inclusion list = exclusion-list complement).
  - **DB:** manual_notification_recipients: NO row for the cancelled/expired/rejected-only account; rows only for accounts tied to registrations with status NOT IN ('cancelled','expired','rejected').
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **MNOT-11** · `P1` `happy` `admin` — Optional safe link (https) is stored and rendered as external link in inbox
  - **Pre:**
    - uat-notif-player1 exists and can log in
  - **Steps:**
    1. Compose a Selected send to uat-notif-player1, Title 'uat-link-https', Body, Optional link 'https://example.com/uat'.
    2. Click Send.
    3. Log in as uat-notif-player1 and open /notifications, find this card and click 'Open link'.
  - **Expected:**
    - Send succeeds; Recent sends row shows the link_url under the Notification cell.
    - In the inbox the card shows an 'Open link' button that opens https://example.com/uat in a new tab (target=_blank, rel=noreferrer).
  - **DB:** manual_notifications.link_url = 'https://example.com/uat' for this row.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **MNOT-12** · `P2` `happy` `admin` — Optional relative link (/path) renders as in-app link
  - **Pre:**
    - uat-notif-player1 exists
  - **Steps:**
    1. Compose a Selected send to uat-notif-player1, Title 'uat-link-rel', Optional link '/my-registrations'.
    2. Send, then as uat-notif-player1 open /notifications and click 'Open link'.
  - **Expected:**
    - Send succeeds.
    - Inbox card 'Open link' navigates in-app to /my-registrations (Next Link, same tab).
  - **DB:** manual_notifications.link_url = '/my-registrations'.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **MNOT-13** · `P1` `negative` `admin` — Unsafe link scheme (javascript:/ftp:/mailto:) is rejected
  - **Pre:**
    - None
  - **Steps:**
    1. Compose any valid audience (e.g. All accounts), Title 'uat-bad-link', Body, Optional link 'javascript:alert(1)'.
    2. Click Send.
  - **Expected:**
    - Red error result line 'Link must be a relative URL or HTTP(S) URL.' (form schema refine).
    - No notification created.
  - **DB:** manual_notifications: no row created for 'uat-bad-link'.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **MNOT-14** · `P1` `negative` `admin` — Empty title and empty body are rejected
  - **Pre:**
    - None
  - **Steps:**
    1. Select All accounts. Leave Title empty, type only spaces in Body.
    2. Attempt to click Send (note Title has HTML required attribute).
    3. If browser allows submit (e.g. body whitespace), observe server result.
  - **Expected:**
    - Title required is enforced (HTML required blocks empty; if bypassed, server returns 'Title is required.').
    - Whitespace-only Body returns 'Body is required.' (zod trim+min(1)).
  - **DB:** manual_notifications: no row created.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **MNOT-15** · `P0` `happy` `player` — User inbox lists only the logged-in user's own recipient rows (RLS)
  - **Pre:**
    - MNOT-03 sent a notification to uat-notif-player1 only
    - uat-notif-player2 was NOT a recipient of that send
  - **Steps:**
    1. Log in as uat-notif-player1, open /notifications.
    2. Observe the 'Inbox summary' (Unread / Shown) and the notification list.
    3. Log out, log in as uat-notif-player2, open /notifications.
  - **Expected:**
    - player1 sees the 'uat-selected-one' card (unread, blue border, 'unread' badge).
    - player2 does NOT see player1's 'uat-selected-one' card (RLS: recipients select own only).
    - Each user's 'Shown' count equals their own recipient rows; 'No notifications yet' empty state appears for a user with none.
  - **DB:** manual_notification_recipients: player1 has a row for the notification, player2 does not; inbox query is scoped by RLS account_id = auth.uid().
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **MNOT-16** · `P0` `happy` `player` — Mark a notification read updates read_at and persists after reload
  - **Pre:**
    - uat-notif-player1 has at least one unread notification
  - **Steps:**
    1. Log in as uat-notif-player1, open /notifications.
    2. On an unread card click 'Mark read'.
    3. Observe the button state and any status text.
    4. Reload /notifications.
  - **Expected:**
    - On success the 'Mark read' button becomes disabled and a green 'Marked as read.' message appears.
    - After reload the card shows the green 'read' badge, '— border' un-highlighted style, and a 'Read <date>' line; the Mark read button is gone.
    - Inbox summary 'Unread' decreases by 1.
  - **DB:** manual_notification_recipients.read_at for that row changes from NULL to a timestamp and stays set after reload.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **MNOT-17** · `P0` `negative` `player` — A user cannot mark another user's notification recipient row read (RLS)
  - **Pre:**
    - A notification N exists where uat-notif-player1 is a recipient but uat-notif-player2 is NOT
    - Know N's manual_notifications.id
  - **Steps:**
    1. Log in as uat-notif-player2.
    2. Attempt to invoke mark-read for notification N's id (e.g. via the markNotificationReadAction with N's notificationId — player2 has no card for it in the UI, so this simulates a forged request).
    3. Observe the result.
  - **Expected:**
    - Action returns error 'Notification not found.' (RLS update matches no row for player2; maybeSingle returns null -> thrown).
    - player1's recipient row read_at is unchanged.
  - **DB:** manual_notification_recipients: player1's row for N keeps its original read_at (no update by player2); the mark_own_read RLS policy (account_id = auth.uid()) blocks cross-user update.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **MNOT-18** · `P1` `happy` `player` — Home Notifications tile shows unread count and links to /notifications
  - **Pre:**
    - uat-notif-player1 has K>0 unread notifications
  - **Steps:**
    1. Log in as uat-notif-player1, open / (Home).
    2. Locate the 'Notifications' tile.
    3. Read its subtitle, then click the tile.
  - **Expected:**
    - Subtitle reads 'K unread Admin message(s)' (th-TH formatted) when K>0, or 'Admin messages and tournament follow-up' when K=0.
    - Clicking navigates to /notifications.
  - **DB:** Count K = manual_notification_recipients with account_id=player1 and read_at IS NULL (getMyUnreadNotificationCount).
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **MNOT-19** · `P1` `happy` `player` — Profile shows unread pill that decrements after marking read
  - **Pre:**
    - uat-notif-player1 has K>0 unread notifications
  - **Steps:**
    1. Log in as uat-notif-player1, open /profile and note the 'Notifications' row pill value 'K unread'.
    2. Open /notifications, mark one unread notification read.
    3. Return to /profile (reload).
  - **Expected:**
    - Profile pill initially shows 'K unread'.
    - After marking one read the pill shows 'K-1 unread'.
  - **DB:** manual_notification_recipients unread count for player1 drops by 1 after read_at is set.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **MNOT-20** · `P1` `happy` `admin` — Recent sends list shows accurate recipient / read / unread totals
  - **Pre:**
    - A notification was sent to >=2 recipients and at least 1 of them has marked it read
  - **Steps:**
    1. Send a Selected notification to two accounts (or use an existing multi-recipient send).
    2. Have one recipient log in and mark it read.
    3. Reload /admin/notifications and find the row in 'Recent sends'.
  - **Expected:**
    - Recipients column shows the total recipient rows (e.g. 2).
    - Read column shows the number marked read (e.g. 1) and 'N unread' shows the remainder (e.g. '1 unread').
    - Audience pill and (if tournament) title are correct; Created shows Asia/Bangkok time.
  - **DB:** Recipients = count of manual_notification_recipients for the notification_id; Read = count with read_at NOT NULL; unread = total - read.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **MNOT-21** · `P1` `negative` `guest` — /notifications requires login (redirect to /login when logged out)
  - **Pre:**
    - No active session
  - **Steps:**
    1. Ensure logged out.
    2. Navigate to http://127.0.0.1:3000/notifications.
  - **Expected:**
    - Redirected to /login (page calls getCurrentAccount(); if null -> redirect('/login')).
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **MNOT-22** · `P2` `happy` `admin` — Account search filters the selectable account checkboxes
  - **Pre:**
    - uat-notif-player1 exists with a distinctive email
  - **Steps:**
    1. On /admin/notifications use the 'Account search' panel: type uat-notif-player1's email and click Search.
    2. Observe the URL and the 'Selected account IDs' checkbox list.
  - **Expected:**
    - URL becomes /admin/notifications?accountQ=<query>.
    - Checkbox list shows matching account(s) (up to 25). For a no-match query it shows 'No account options for the current search.'
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **MNOT-23** · `P2` `edge` `admin` — Title length boundary (120 chars accepted, 121 truncated/blocked)
  - **Pre:**
    - uat-notif-player1 exists
  - **Steps:**
    1. Compose a Selected send to uat-notif-player1.
    2. Paste a 120-character title into Title (note maxLength=120 attribute) and a normal Body; Send.
    3. Attempt to paste a 121-character title and observe truncation to 120.
  - **Expected:**
    - 120-char title is accepted and stored fully.
    - Input limits entry to 120 chars (maxLength); server/DB also enforce <=120 so an over-length value via bypass returns 'Notification title is too long' / 'Title is too long.'
  - **DB:** manual_notifications.title length = 120 for the accepted send; CHECK char_length(btrim(title)) between 1 and 120 enforced.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **MNOT-24** · `P2` `edge` `admin` — Migration-pending fallback panel when tables/RPC are absent
  - **Pre:**
    - Only run if the manual_notifications migration is NOT applied; otherwise SKIP
  - **Steps:**
    1. On an environment without the 202606120001 migration, open /admin/notifications.
  - **Expected:**
    - Instead of the compose form, the page shows the 'Notifications unavailable / Manual notification tables or RPC are not ready' panel with an 'Apply pending Supabase migrations' message (triggered by PGRST205 / 42703 / 42883 error codes).
    - Header metrics are hidden.
  - **DB:** manual_notifications / manual_notification_recipients tables or create_manual_notification RPC do not exist.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

> ⚠️ **ข้อสังเกตจากโค้ด (อ่านก่อนเทส suite นี้):**
> - DIVERGENCE RISK (not a current bug): Admin 'Preview recipients' count for tournament mode is computed in src/lib/admin/notifications.ts getTournamentRecipientCounts() using an INCLUSION list ['pending_payment','pending_verify','confirmed','waiting_list'], while the actual send RPC (202606120001_manual_notifications.sql) uses an EXCLUSION list status NOT IN ('cancelled','expired','rejected'). Today these are exact complements of the 7-value registrations status enum, so the preview equals the sent count. If a new registration status is ever added, the preview and the real recipient count would silently diverge. Worth a regression note.
> - The Admin 'Preview recipients' number in the compose form is purely CLIENT-SIDE (manual-notification-form.tsx useMemo). all_accounts uses the page's allAccountCount, tournament uses the selected tournament's precomputed recipientCount, selected uses new Set([checked..., pastedSplit...]).size (dedupe shown live). The authoritative recipient count is what the RPC returns and what 'Recent sends' shows after submit.
> - Pasted account IDs are validated as UUIDs by the FORM action schema (actions.ts: accountIds: z.array(z.string().uuid())). A malformed token (non-UUID) fails parse and returns the first zod issue message (e.g. 'Invalid uuid') with status=error BEFORE the RPC is called. A well-formed but NON-EXISTENT UUID passes the form, is sent to the RPC, then silently dropped by the RPC's join to public.accounts.
> - If selected_accounts resolves to zero real accounts (all UUIDs nonexistent), the RPC raises 'Notification audience has no recipients' and DELETES the just-inserted manual_notifications row (rolled back) — no notification or recipient rows persist. The form shows status=error with that message.
> - Dedupe happens at three layers: (1) client preview Set, (2) server unique() in parseAccountIds/sendManualNotification, (3) RPC SELECT DISTINCT + unique(notification_id, account_id) constraint with ON CONFLICT DO NOTHING. Pasting the same UUID twice, or pasting a UUID also checked in the list, must yield exactly ONE recipient row.
> - markMyNotificationRead (user-notifications.ts) updates by .eq('notification_id', ...).maybeSingle() and relies on RLS to scope to the caller's own recipient row. For another user's notification the RLS update returns no row -> throws 'Notification not found.' shown as red error text under the Mark read button. There is no per-user filter in the query itself; correctness depends entirely on the manual_notification_recipients_mark_own_read RLS policy (account_id = auth.uid()).
> - The 'Mark read' button is disabled after a successful mark (disabled={isPending || state.status==='success'}) without a reload; the card visually flips to 'read' only after the revalidatePath-driven re-render / reload. After reload the recipient row's read_at persists and the card shows the 'read' badge + 'Read <date>'.
> - Unread count entry points both call getMyUnreadNotificationCount() (counts manual_notification_recipients with read_at IS NULL via the user's session/RLS): Home (src/app/page.tsx) renders a Notifications tile whose subtitle is 'N unread Admin message(s)' (th-TH formatted) linking to /notifications; /profile (src/app/profile/page.tsx) renders a pill 'N unread'. Both must drop by 1 after marking one notification read.
> - Recent sends table on /admin/notifications shows columns Notification (title + short id + optional link), Audience (All accounts / Tournament / Selected, plus tournament title), Recipients (total recipient rows), Read (read count + 'N unread'), Created (Asia/Bangkok formatted). Audience label mapping: all_accounts->'All accounts', tournament_registrants->'Tournament', selected_accounts->'Selected'.
> - Link validation: linkUrl must start with '/' or match ^https?:// (enforced in form schema actions.ts, lib schema notifications.ts, and the SQL CHECK + RPC). The user inbox renders an external https link as <a target=_blank rel=noreferrer>, and a relative '/...' link as a Next <Link>; both render the 'Open link' button. javascript:/ftp:/mailto: links are rejected at send time.
> - Account search form on /admin/notifications submits GET to /admin/notifications with field name 'accountQ' (label 'Search accounts'); it searches via getAdminUsers (email/name/phone/rank/UUID), limit 25 options. Checkboxes have name='accountIds'; the paste textarea has name='pastedAccountIds' (split on whitespace/comma/semicolon).
> - Title maxLength=120 and Body maxLength=2000 are enforced by the input maxLength attribute (UI truncation) AND server zod (.max) AND SQL CHECK. Title/Body are required (HTML required + zod min(1)). Empty/whitespace-only title or body returns 'Title is required.' / 'Body is required.'
> - There is no explicit success toast beyond the inline result line: on success the form shows green 'Notification sent to N recipient(s).' plus 'Notification <shortId> / <audienceType>'. The compose form fields are NOT auto-cleared after a successful send (only the action state changes), so re-submitting without editing would send a duplicate — note this for the tester.

---

<a id="suite-8"></a>
## 8. Admin Database Upload + Search

**27 cases** — P0 `7` / P1 `13` / P2 `7` · happy `8` / negative `11` / edge `8`

<sub>Admin Database upload + search APIs (go_player_database DAN/KYU/AWARD, school_database, rank/school search, database_import_runs audit)</sub>

**Routes:** `GET /admin/database (src/app/admin/database/page.tsx) — admin dashboard; NOT route-protected in dev, open directly` · `POST /admin/database/upload (src/app/admin/database/upload/route.ts) — multipart form fields: source (dan|kyu|award) + file (.xlsx)` · `POST /admin/database/school/upload (src/app/admin/database/school/upload/route.ts) — multipart form field: file (.xlsx)` · `POST /api/rank/search (src/app/api/rank/search/route.ts) — JSON body {firstNameTh, lastNameTh}` · `GET /api/schools/search?q=&limit= (src/app/api/schools/search/route.ts)`

**Preconditions (suite-level):**
- Dev server running: npm run dev -- --hostname 127.0.0.1 --port 3000 ; base URL http://127.0.0.1:3000
- REAL linked Supabase project (ref jiweobnsxpmgexipqzbx). Current baseline rows (2026-06-13): go_player_database DAN=1142, KYU=1635, AWARD=985; school_database=3; database_import_runs=5; player_profiles verified=2.
- /admin pages are desktop layout and NOT route-protected in dev — tester opens /admin/database directly with no admin login.
- Tester needs a few small obvious test .xlsx workbooks they can build/keep (uat-*.xlsx). DAN headers: seq,prefix,firstname,lastname,year,rank,diamond,gat. KYU headers: seq,prefix,firstname,lastname,rank,date. AWARD headers: seq,prefix,firstname,lastname,phone,category,rank_in_category,rank_award,event_name,date,organizer. SCHOOL headers: seq,name,keywords (case-insensitive). Header row must be row 1; data from row 2.
- WARNING: a successful DAN/KYU/AWARD upload REPLACES that whole source via RPC replace_go_player_database_source (delete+insert for that source), and a successful SCHOOL upload REPLACES the entire school_database. Do NOT run a real production-replacing upload unless you intend to, or you have the canonical workbooks to restore. Use the search/validation/negative cases (which fail before the replace) for most coverage; isolate destructive replace tests.

<details><summary><b>Test data ที่ต้องเตรียม</b></summary>

- uat-dan-2rows.xlsx: DAN workbook, 2 data rows. Row A firstname=uatดาบ lastname=uatทดสอบ rank=3 year=2560 gat=1500 diamond=A. Row B firstname=uatดาบ lastname=uatทดสอบ rank=5 (same name, higher dan) year=2561 gat=1600. Used to verify DAN power_level math and re-sync best-match (dan priority + highest power_level).
- uat-dan-badrank.xlsx: DAN workbook, 1 row rank=12 (out of 1-9 range) → expected skip reason invalid_or_empty_dan_rank.
- uat-dan-missingcol.xlsx: DAN workbook missing the gat column → expected 422 'DAN missing columns: gat'.
- uat-kyu-dupe.xlsx: KYU workbook, 2 rows same normalized name, rank=8 (date 2023-01-01) and rank=5 (date 2024-01-01) → expected dedupe keeps the stronger kyu (lower kyu number = higher power_level), so 1 importable row.
- uat-award-mixed.xlsx: AWARD workbook 3 rows. Row1 rank_award=1, rank_in_category='13 Kyu', category='ประถม'. Row2 rank_award=4 (invalid). Row3 rank_award=2, rank_in_category='99x99' (unmapped). Expected: 1 importable, skips rank_award_not_1_2_3 (x1) and unmapped_rank_in_category (x1).
- uat-school-3rows.xlsx: SCHOOL workbook columns seq,name,keywords. Row1 name='uat-โรงเรียนทดสอบ' keywords='UAT|test'. Row2 name='uat-โรงเรียนทดสอบ' (duplicate name) keywords='extra'. Row3 name blank, keywords='x'. Expected 1 importable, skips duplicate_school_name_merged (x1) and missing_school_name (x1).
- uat-big.xlsx: any .xlsx padded to > 10MB (10,485,760 bytes) to trigger the pre-parse size guard.
- uat-not-xlsx.csv (or .txt) renamed/kept with non-.xlsx extension to trigger extension guard.
- Real existing search data (read-only, safe): DAN player firstNameTh='ก่อศักดิ์' lastNameTh='ไชยรัศมีศักดิ์' (7 Dan, rating 1700). School name 'อัสสัมชัญสมุทรปราการ' with keyword 'ACSP'.

</details>

### Test cases

- [ ] **DBADM-01** · `P0` `happy` `admin` — /admin/database dashboard loads live Supabase counts, samples, and latest upload audit
  - **Pre:**
    - Dev server running
    - Supabase reachable
  - **Steps:**
    1. Open http://127.0.0.1:3000/admin/database directly (no login)
    2. Observe the four cards: DAN, KYU, AWARD, SCHOOL
    3. On each go-player card read the 'Supabase ปัจจุบัน' value and the 'ตัวอย่างข้อมูลจาก Supabase' table
    4. Read the 'อัปโหลดผ่านหน้า Admin ล่าสุด' panel (date + original file name) and 'ผล import ล่าสุด' panel
  - **Expected:**
    - Page renders desktop layout with header 'อัปโหลดฐานข้อมูลผู้เล่นและสถาบัน'
    - DAN shows 1,142 rows, KYU 1,635 rows, AWARD 985 rows, SCHOOL 3 schools (matches live DB baseline)
    - Each card shows up to 4 sample rows (name + Rank + Power for go, name + Keywords for school) pulled from Supabase, ordered newest uploaded first
    - Latest-upload panel shows a real date/time and original_file_name from database_import_runs (NOT 'ยังไม่เคยอัปโหลด' since 5 runs exist), confirming audit comes from DB not a local file
    - Status pill on each loaded card is green 'พร้อมใช้งานจาก Supabase'
  - **DB:** go_player_database count by source + school_database count must equal the numbers shown; latest database_import_runs row per source matches the date/filename panel
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **DBADM-02** · `P0` `happy` `admin` — DAN upload happy path: import, power_level math, audit row, success message
  - **Pre:**
    - uat-dan-2rows.xlsx prepared
    - Intend to REPLACE the dan source (have canonical DAN_Database.xlsx to restore afterward)
  - **Steps:**
    1. On /admin/database DAN card, click the dashed 'เลือกไฟล์ Excel .xlsx' area and choose uat-dan-2rows.xlsx
    2. Confirm helper text shows 'พร้อมอัปโหลด uat-dan-2rows.xlsx ...'
    3. Click the DAN card 'Upload' button
    4. Wait for completion; read the green status message; the page auto-refreshes
  - **Expected:**
    - Success pill 'ready' appears with message like 'เข้า Supabase แล้ว: N rows, M skip, sync K profiles'
    - After auto-refresh the DAN 'Supabase ปัจจุบัน' count now reflects only the uploaded rows for source=dan (the prior 1,142 dan rows are REPLACED, not appended)
    - Latest-upload panel shows uat-dan-2rows.xlsx with a fresh timestamp
  - **DB:** go_player_database where source='dan' replaced; for the uploaded name, power_level = 16 + dan (rank=5 → 21, '5 Dan'); database_import_runs gets a new status='success' row with original_file_name='uat-dan-2rows.xlsx', supabase_imported_rows and synced_profiles populated
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **DBADM-03** · `P1` `edge` `admin` — DAN dedupe / re-sync best-match favors highest power_level for same person
  - **Pre:**
    - uat-dan-2rows.xlsx has two rows with same normalized name, dan=3 and dan=5
  - **Steps:**
    1. Upload uat-dan-2rows.xlsx via the DAN card (as in DBADM-02)
    2. After refresh, inspect the uploaded person in the sample table or via dbCheck
  - **Expected:**
    - Both DAN rows are imported (DAN parser does NOT dedupe within a file, unlike KYU), so importableRows reflects 2
    - If a verified player_profiles row shares that normalized name, re-sync picks the 5 Dan (power 21) over 3 Dan because of DAN-priority-then-highest-power rule
  - **DB:** go_player_database source='dan' contains both the '3 Dan' and '5 Dan' rows for the name; any matching verified player_profiles.power_level updates to 21 and matched_go_player_id set to the 5 Dan row id
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **DBADM-04** · `P1` `negative` `admin` — DAN upload with invalid rank is skipped with reason invalid_or_empty_dan_rank
  - **Pre:**
    - uat-dan-badrank.xlsx has a single row with rank=12 (outside 1-9)
  - **Steps:**
    1. Upload uat-dan-badrank.xlsx via the DAN card
  - **Expected:**
    - Because the only row is skipped there are 0 importable rows, so the route returns 422 and the form shows error 'Parser did not find any importable rows in this file.'
    - The DAN dan source is NOT replaced (no importable rows means the RPC replace is not reached in this all-skipped case)
    - Skip-reason panel after refresh / the recorded run shows reason invalid_or_empty_dan_rank count 1
  - **DB:** database_import_runs gets a status='error' row for source='dan' with skip_reasons containing {reason:'invalid_or_empty_dan_rank',count:1}; go_player_database dan count unchanged
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **DBADM-05** · `P1` `negative` `admin` — Upload workbook missing a required column returns a clear 422 schema error
  - **Pre:**
    - uat-dan-missingcol.xlsx omits the gat column
  - **Steps:**
    1. Upload uat-dan-missingcol.xlsx via the DAN card
  - **Expected:**
    - Form shows red 'check file' pill with error message 'DAN missing columns: gat' (HTTP 422)
    - No rows imported; dan source unchanged
  - **DB:** database_import_runs gets a status='error' row for source='dan' with error_message 'DAN missing columns: gat'; go_player_database dan count unchanged
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **DBADM-06** · `P1` `edge` `admin` — KYU upload dedupes same person within the file, keeping the stronger kyu
  - **Pre:**
    - uat-kyu-dupe.xlsx: same normalized name twice, rank=8 (older date) and rank=5 (newer date)
  - **Steps:**
    1. Upload uat-kyu-dupe.xlsx via the KYU card
    2. Read success message importable/skip counts and dbCheck the stored rank
  - **Expected:**
    - Only 1 row is kept for that person (KYU parser dedupes by normalized name); the kept row is 5 Kyu because lower kyu number = higher power_level (12) wins over 8 Kyu (power 9)
    - kyu source is replaced with the deduped set
  - **DB:** go_player_database source='kyu' for that name has exactly one row, rank='5 Kyu', power_level=12 (17-5)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **DBADM-07** · `P2` `edge` `admin` — KYU rank >=16 clamps to 15 Kyu (power 2)
  - **Pre:**
    - A KYU workbook row with rank=20
  - **Steps:**
    1. Upload a KYU workbook containing a row with rank=20
    2. Inspect the stored rank for that row
  - **Expected:**
    - Row imports as '15 Kyu' with power_level 2 (raw kyu >=16 is clamped to 15)
  - **DB:** go_player_database source='kyu' row shows rank='15 Kyu', power_level=2
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **DBADM-08** · `P0` `happy` `admin` — AWARD upload: rank from rank_in_category only; rank_award gate; category is audit-only
  - **Pre:**
    - uat-award-mixed.xlsx with one valid award row rank_award=1, rank_in_category='13 Kyu', category='ประถม'
  - **Steps:**
    1. Upload uat-award-mixed.xlsx via the AWARD card
    2. Read counts and dbCheck the imported row
  - **Expected:**
    - The valid row imports; rank is derived from rank_in_category '13 Kyu' → single kyu min(15,max(1,13-1))=12 → stored rank '12 Kyu' power_level 5
    - category 'ประถม' is stored on the row for display/audit but does NOT change the rank
    - rank_award=1 is stored on the row
  - **DB:** go_player_database source='award' valid row: rank='12 Kyu', power_level=5, rank_award=1, category='ประถม', rank_in_category='13 Kyu'
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **DBADM-09** · `P1` `negative` `admin` — AWARD rows with rank_award not in {1,2,3} or unmapped rank_in_category are skipped
  - **Pre:**
    - uat-award-mixed.xlsx contains row2 rank_award=4 and row3 rank_award=2 with rank_in_category='99x99'
  - **Steps:**
    1. Upload uat-award-mixed.xlsx via the AWARD card
    2. After refresh read the skip-reason panel on the AWARD card
  - **Expected:**
    - row2 skipped with reason rank_award_not_1_2_3 (rank_award outside 1/2/3)
    - row3 skipped with reason unmapped_rank_in_category (99x99 has no mapping)
    - Skip-reason panel shows both reasons each count 1; only the 1 valid row is importable
  - **DB:** database_import_runs newest award row skip_reasons contains {reason:'rank_award_not_1_2_3',count:1} and {reason:'unmapped_rank_in_category',count:1}; supabase_imported_rows=1
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **DBADM-10** · `P2` `negative` `admin` — Missing first or last name skips row with missing_first_or_last_name
  - **Pre:**
    - Any go-player workbook with one valid row plus one row missing lastname
  - **Steps:**
    1. Upload a DAN/KYU/AWARD workbook where one row has firstname but blank lastname plus at least one valid row
    2. Read the skip-reason panel
  - **Expected:**
    - The nameless row is skipped with reason missing_first_or_last_name; the valid row still imports
  - **DB:** database_import_runs newest run for that source has skip_reasons including {reason:'missing_first_or_last_name', count>=1}
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **DBADM-11** · `P0` `happy` `admin` — SCHOOL upload happy path: import to school_database, replaces whole table
  - **Pre:**
    - uat-school-3rows.xlsx prepared
    - Intend to REPLACE school_database (have canonical SCHOOL_Database.xlsx to restore the 3 production schools)
  - **Steps:**
    1. On the SCHOOL card choose uat-school-3rows.xlsx
    2. Click the SCHOOL card 'Upload' button
    3. Read the success message; page auto-refreshes
  - **Expected:**
    - Success message like 'เข้า Supabase แล้ว: N schools, M skip'
    - After refresh SCHOOL 'Supabase ปัจจุบัน' count reflects ONLY the uploaded schools (prior 3 production schools are REPLACED)
    - Sample table shows the uploaded school names + keywords
  - **DB:** school_database fully replaced; row 'uat-โรงเรียนทดสอบ' present with keywords ['UAT','test']; database_import_runs gets status='success' source='school' row
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **DBADM-12** · `P1` `edge` `admin` — SCHOOL duplicate name merge + blank name skip
  - **Pre:**
    - uat-school-3rows.xlsx has duplicate name row and a blank-name row
  - **Steps:**
    1. Upload uat-school-3rows.xlsx via the SCHOOL card
    2. Read the skip-reason panel and the stored keywords for the merged school
  - **Expected:**
    - Duplicate-name row is skipped with reason duplicate_school_name_merged and its keywords are merged into the first occurrence
    - Blank-name row is skipped with reason missing_school_name
    - Only 1 distinct school row is importable for that name; merged keywords include both original and 'extra'
  - **DB:** school_database 'uat-โรงเรียนทดสอบ' keywords contain the merged set; database_import_runs newest school run skip_reasons includes duplicate_school_name_merged and missing_school_name
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **DBADM-13** · `P0` `negative` `admin` — Oversize file (>10MB) rejected BEFORE parse with no DB write
  - **Pre:**
    - uat-big.xlsx larger than 10,485,760 bytes
  - **Steps:**
    1. Choose uat-big.xlsx on any card (e.g. DAN)
    2. Click Upload
    3. Note record count of database_import_runs before and after
  - **Expected:**
    - Form shows red 'check file' pill with error 'Excel files must be 10MB or smaller.' (HTTP 400)
    - Upload is rejected before the workbook is parsed; no source is replaced
    - NO database_import_runs row is created (size guard returns before tryRecordDatabaseImportRun)
  - **DB:** database_import_runs count UNCHANGED; go_player_database/school_database unchanged
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **DBADM-14** · `P1` `negative` `admin` — Non-.xlsx extension rejected by filename guard
  - **Pre:**
    - uat-not-xlsx.csv (or a real xlsx renamed to .csv)
  - **Steps:**
    1. Attempt to upload a file whose name does not end in .xlsx via any card (the picker accept may filter it; if so, drag or use a renamed file)
    2. Click Upload
  - **Expected:**
    - Error 'Only .xlsx files are supported.' (HTTP 400)
    - No DB write; no database_import_runs row
  - **DB:** database_import_runs count unchanged
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **DBADM-15** · `P2` `negative` `admin` — Corrupt/non-Excel bytes with .xlsx name fail in parser (422, error audit row recorded)
  - **Pre:**
    - A text/binary file that is NOT a valid xlsx but is named uat-bad.xlsx
  - **Steps:**
    1. Upload uat-bad.xlsx via the DAN card
  - **Expected:**
    - Extension guard passes (name ends .xlsx) but the parser throws; form shows a 422 error message from the parser (e.g. workbook/zip error)
    - Source NOT replaced
  - **DB:** database_import_runs gets a status='error' row for source='dan' with a non-null error_message; go_player_database dan count unchanged
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **DBADM-16** · `P2` `negative` `admin` — Upload route rejects unknown source / missing file (API guards)
  - **Pre:**
    - Ability to send a raw multipart POST (browser devtools/curl) to /admin/database/upload
  - **Steps:**
    1. POST /admin/database/upload with source='referee' and a valid file → expect rejection
    2. POST /admin/database/upload with source='dan' but no file part → expect rejection
  - **Expected:**
    - Unknown source → 400 JSON {error:'Unknown database source.'}
    - Missing file → 400 JSON {error:'Please choose an .xlsx file.'}
    - Neither writes to the DB
  - **DB:** database_import_runs count unchanged for both attempts
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **RANK-01** · `P0` `happy` `guest` — POST /api/rank/search returns a DAN match with full evidence fields
  - **Pre:**
    - go_player_database has the real DAN player 'ก่อศักดิ์ ไชยรัศมีศักดิ์'
  - **Steps:**
    1. POST http://127.0.0.1:3000/api/rank/search with JSON {"firstNameTh":"ก่อศักดิ์","lastNameTh":"ไชยรัศมีศักดิ์"} (use devtools/curl)
  - **Expected:**
    - HTTP 200 with status 'matched' (or 'multiple' if name collides)
    - Top candidate source='dan', rank='7 Dan', powerLevel=23
    - Candidate includes evidence-related fields: rating (1700) and (when present) year_promoted/diamond, plus category/rank_in_category/rank_award/event_name/event_date keys (null for dan)
    - evidence[] array contains a rating string (e.g. 'rating 1700')
  - **DB:** Returned candidate matches go_player_database row for that name (source='dan', power_level=23, rating=1700)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **RANK-02** · `P1` `edge` `guest` — DAN-first short-circuit: kyu/award are NOT returned when a DAN row matches
  - **Pre:**
    - A name that exists in both DAN and KYU/AWARD (or use the DAN player above)
  - **Steps:**
    1. POST /api/rank/search with a name that has at least one dan row
  - **Expected:**
    - Response contains ONLY dan-source candidates; no kyu/award candidate appears even if the same person exists there (matchGoPlayerRank returns dan results immediately when danCandidates.length>0)
  - **DB:** Cross-check: that person may also exist in kyu/award in go_player_database, yet the API response source is exclusively 'dan'
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **RANK-03** · `P1` `happy` `guest` — KYU/AWARD fallback returns award evidence fields when no DAN match
  - **Pre:**
    - A name present only in award/kyu (pick one from go_player_database where source in ('award','kyu') and not in dan)
  - **Steps:**
    1. POST /api/rank/search with that kyu/award-only name
  - **Expected:**
    - HTTP 200, candidate source 'kyu' or 'award'
    - For an award candidate, evidence-bearing fields rank_award, category, rank_in_category, event_name, event_date are present (non-null where data exists); evidence[] includes strings like 'ได้อันดับ N', 'รุ่น ...', 'งาน ...'
    - Strongest candidate per person is kept (highest power_level, then exact>normalized>fuzzy)
  - **DB:** Returned fields match the go_player_database award/kyu row (rank_award, category, rank_in_category, event_name, event_date)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **RANK-04** · `P1` `negative` `guest` — rank/search not_found for a clearly fake name
  - **Steps:**
    1. POST /api/rank/search with {"firstNameTh":"uatไม่มีจริง","lastNameTh":"uatไม่มีจริง"}
  - **Expected:**
    - HTTP 200 with status 'not_found' and candidates: []
  - **DB:** No go_player_database row matches that normalized name
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **RANK-05** · `P1` `negative` `guest` — rank/search validation: empty/blank name → 400
  - **Steps:**
    1. POST /api/rank/search with {"firstNameTh":"","lastNameTh":"x"}
    2. POST /api/rank/search with an empty/invalid JSON body
  - **Expected:**
    - Both return HTTP 400 JSON {error:'กรุณากรอกชื่อและนามสกุลไทย'} (zod requires non-empty trimmed first AND last name)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **RANK-06** · `P2` `edge` `guest` — Thai name normalization makes search variant-insensitive
  - **Pre:**
    - Pick a name containing a normalizable char (e.g. ศ/ษ, ณ, ญ, ภ, ใ, or a ก์ mark) from go_player_database
  - **Steps:**
    1. Search the canonical name, then search a spelling that differs ONLY by a normalized substitution (e.g. swap ศ↔ส) and compare results
  - **Expected:**
    - Both queries return the same matched person because normalizeThaiName collapses these variants before matching
  - **DB:** Matched candidate id identical for both spellings
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **SCH-01** · `P0` `happy` `guest` — GET /api/schools/search returns schools by name query
  - **Pre:**
    - school_database contains 'อัสสัมชัญสมุทรปราการ' (or run after restoring production schools)
  - **Steps:**
    1. GET http://127.0.0.1:3000/api/schools/search?q=อัสสัมชัญ
  - **Expected:**
    - HTTP 200 with {results:[...]} containing the matching school
    - Each result has id, seq, name, keywords[], matchType (exact|keyword|fuzzy), similarityScore
  - **DB:** Returned name matches a school_database.name row
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **SCH-02** · `P1` `happy` `guest` — schools/search matches on keyword, not just name
  - **Pre:**
    - school 'อัสสัมชัญสมุทรปราการ' has keyword 'ACSP'
  - **Steps:**
    1. GET /api/schools/search?q=ACSP
  - **Expected:**
    - HTTP 200; the parent school is returned with matchType 'keyword' (or 'fuzzy'), demonstrating keyword search via the keywords[] column
  - **DB:** school_database row whose keywords array contains 'ACSP' is the returned result
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **SCH-03** · `P1` `edge` `guest` — schools/search empty q short-circuits to empty results (no error)
  - **Steps:**
    1. GET /api/schools/search (no q)
    2. GET /api/schools/search?q=
  - **Expected:**
    - Both return HTTP 200 {results:[]} with no DB call and no error
    - Status is 200, NOT 400 (empty q is allowed and returns empty list)
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **SCH-04** · `P2` `edge` `guest` — schools/search limit clamping and over-long query rejection
  - **Pre:**
    - school_database has at least a couple of rows
  - **Steps:**
    1. GET /api/schools/search?q=โรงเรียน&limit=50 (over max 20)
    2. GET /api/schools/search?q=โรงเรียน&limit=0 (under min 1)
    3. GET /api/schools/search?q=<a string longer than 120 chars>
  - **Expected:**
    - limit=50 and limit=0 still return 200 (limit is coerced/clamped to the 1-20 range; result count never exceeds 20)
    - A q longer than 120 chars returns HTTP 400 {error:'คำค้นหาไม่ถูกต้อง'} (zod max(120))
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **DBADM-17** · `P2` `negative` `admin` — Card error state when a Supabase read fails (resilience)
  - **Pre:**
    - Ability to temporarily break Supabase connectivity (e.g. wrong service key in .env.local) — optional/destructive to config, do last
  - **Steps:**
    1. With Supabase unreachable, load /admin/database
  - **Expected:**
    - Affected card(s) show red 'ต้องตรวจสอบ' status pill and a red error banner with the Supabase error message
    - Counts/samples fall back to 0 / empty rather than crashing the page
  - **DB:** No DB change; verify normal green state returns once connectivity is restored
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

> ⚠️ **ข้อสังเกตจากโค้ด (อ่านก่อนเทส suite นี้):**
> - DESTRUCTIVE REPLACE: A successful go-player upload calls RPC replace_go_player_database_source(p_source, p_rows) which replaces ALL rows of that one source; a successful school upload calls replace_school_database(p_rows) replacing the WHOLE school_database table. There is no append mode and no per-row dedupe against existing DB rows. Treat every successful upload as 'wipe + reload this source from the file'. This is the single biggest risk for the owner during UAT — flagged in preconditions.
> - Size guard order: file.size > 10*1024*1024 is checked BEFORE the workbook is parsed and BEFORE any DB write (upload routes lines 30-35 / 24-29), so an oversized file returns 400 'Excel files must be 10MB or smaller.' and writes NOTHING (not even a database_import_runs row).
> - Extension guard is by filename only: file.name must end with '.xlsx' (case-insensitive) else 400 'Only .xlsx files are supported.' A real .xlsx renamed to .csv is rejected; a non-Excel file renamed to .xlsx passes the extension check and then fails in the parser (422, and an 'error' row IS recorded in database_import_runs).
> - Validation/permission errors (400: unknown source, missing file, wrong extension, oversize) return BEFORE parse and do NOT write a database_import_runs row. Parser/RPC errors (422) and zero-importable-rows (422) DO write a database_import_runs row with status='error' via tryRecordDatabaseImportRun.
> - Power-level math (verify in go_player_database.power_level): DAN n→16+n (1 Dan=17 … 9 Dan=25, though DB caps at valid 1-9). KYU k→17-k with k clamped to 15 if raw>=16 (1 Kyu=16 … 15 Kyu=2). AWARD rank derived ONLY from rank_in_category via parseAwardRankFromRankInCategory (e.g. '13 Kyu' single → kyu=min(15,max(1,13-1))=12 → '12 Kyu' power 5; ranges like '5-7' use min then -1; literal '9x9'/'13x13' map to 12 Kyu). category column is stored for display/audit only and does NOT affect rank.
> - AWARD import requires BOTH: rank_award ∈ {1,2,3} (else skip 'rank_award_not_1_2_3') AND a mappable rank_in_category (else skip 'unmapped_rank_in_category'). Missing firstname/lastname on any source skips with 'missing_first_or_last_name'.
> - Re-sync of verified profiles (syncVerifiedProfilesFromGoDatabase) runs AFTER every successful go-player upload (all three sources), not just DAN. It rematches every rank_status='verified' player_profiles row by NORMALIZED Thai first/last name against the whole go_player_database, picking DAN over KYU/AWARD, then highest power_level, then highest rating, and writes rank/power_level/rating/matched_go_player_id back. syncedProfiles count is surfaced in the UI success message and stored in database_import_runs.synced_profiles. With only 2 verified profiles in the DB today, expect a small/zero number unless a verified profile's normalized name matches an uploaded row.
> - rank/search ordering: matchGoPlayerRank queries DAN first; if ANY dan candidate exists it returns only dan results and NEVER falls back to kyu/award. Only when zero dan rows match does it search kyu+award and keep the strongest candidate per normalized person. Response status is 'matched' (exactly 1 candidate), 'multiple' (2-5), or 'not_found'. Each candidate carries evidence[] built from year_promoted/rating/diamond (dan), event_date (kyu), or rank_award/category/rank_in_category/event_name/event_date (award) — these are the documented evidence fields.
> - Name matching is accent/variant-insensitive via normalizeThaiName (e.g. ศ/ษ→ส, ณ→น, ญ→ย, ภ→พ, ใ→ไ, strips ก์ mark and collapses spaces). A search that differs only by these substitutions should still match — useful edge case.
> - schools/search: GET with empty/missing q short-circuits to {results:[]} with HTTP 200 (no DB call, no error). limit is coerced and clamped to 1-20 (default 8); q is trimmed and capped at 120 chars (over-120 → 400 'คำค้นหาไม่ถูกต้อง'). Results come from RPC search_school_database and include match_type exact|keyword|fuzzy and similarity_score; keyword hits ('ACSP') should surface the parent school.
> - rank/search validation: body must have non-empty trimmed firstNameTh AND lastNameTh (zod min(1)); otherwise 400 'กรุณากรอกชื่อและนามสกุลไทย'. Malformed/empty JSON body also yields this 400.
> - /admin/database page is force-dynamic and reads everything live from Supabase: per-source row COUNTS (count exact head) and 4 SAMPLE rows come from go_player_database/school_database directly; the 'อัปโหลดผ่านหน้า Admin ล่าสุด' / skip-reason / synced-profiles panels come from the LATEST database_import_runs row per source (getLatestDatabaseImportRun). It does not read any local .tesuji-upload-status.json file. If Supabase read fails, the card shows a red 'ต้องตรวจสอบ' status and an error banner.
> - MINOR/POTENTIAL ISSUE: the AWARD '9x9'/'13x13' rank_in_category map to '12 Kyu' (power 5) in the importer, but ranks.ts rankToPowerLevel treats literal '9x9'→0 and '13x13'→1. These are different code paths (import vs. generic rank parsing) so award rows are stored as '12 Kyu', not '9x9'. Not a bug for this flow but worth noting if a tester expects a literal 9x9 award rank.
> - EDGE: KYU raw rank >=16 is clamped to 15 Kyu (power 2). KYU rank <1 or non-integer is skipped 'invalid_or_empty_kyu_rank'. DAN must be integer 1-9 inclusive; 0, 10, decimals, or blank are skipped 'invalid_or_empty_dan_rank'.
> - Cleanup: after any destructive replace test, re-upload the canonical DAN/KYU/AWARD/SCHOOL workbooks to restore the production counts (DAN 1142 / KYU 1635 / AWARD 985 / SCHOOL 3). The database_import_runs table only grows (one row per attempt) and has no UI delete; uat-* runs can be left as audit history or removed directly in Supabase if desired.

---

<a id="suite-9"></a>
## 9. Home / Digital ID + Navigation

**22 cases** — P0 `10` / P1 `9` / P2 `3` · happy `12` / negative `4` / edge `6`

<sub>Authenticated Home / Digital ID + global redirects & navigation (src/app/page.tsx and its lib/components)</sub>

**Routes:** `/` · `/login` · `/notifications` · `/profile` · `/tournaments` · `/my-registrations` · `/admin` · `/api/auth/logout`

**Preconditions (suite-level):**
- Dev server running: npm run dev -- --hostname 127.0.0.1 --port 3000 (base URL http://127.0.0.1:3000).
- User-facing pages render inside the mobile frame (MobileShell: centered card, max-width 430px) even on a desktop browser. Verify all Home checks INSIDE that frame.
- All writes hit the REAL linked Supabase project (ref jiweobnsxpmgexipqzbx). Every test account/profile/tournament must use an obvious uat- prefix and be cleaned up after.
- Register can only choose player or coach; referee needs an Admin invite code; admin role is seeded manually in account_roles. To test the active-admin Quick Access tile you need an account with account_roles.role='admin', status='active'.
- There is NO middleware.ts in the repo: the unauthenticated redirect to /login is performed in-page by redirect('/login') inside the Home server component when getCurrentAccount() returns null.
- Home reads live data: getCurrentAccount() (accounts/account_roles/role_requests/player_profiles), getCoachLinkDashboard() (coach_player_links), createDigitalIdQrDataUrl() (qrcode), getMyUnreadNotificationCount() (manual_notification_recipients via RLS).
- A test account that completed signup normally will have a player_profiles row (QR present). To exercise the no-profile branch you need an account row WITHOUT a matching player_profiles row, which normal signup does not produce — may require manual DB setup or is otherwise not reachable via the UI.

<details><summary><b>Test data ที่ต้องเตรียม</b></summary>

- uat-player-01: standard Player account created via /register (player role) with a complete player_profiles row, rank_status verified or pending.
- uat-coach-01: account that registered as coach (active player role + active coach role after Admin approval, OR coach role still pending) to test the coach branches; needs at least one approved coach_player_links row to a uat player to test the Linked Players section, plus one pending incoming link as a player to test the profile-tile badge.
- uat-admin-01: account manually seeded with account_roles admin=active to test the Admin Quick Access tile.
- At least one manual_notification + manual_notification_recipients row addressed to uat-player-01 with read_at NULL (send via /admin/notifications) to test the unread badge/count.
- Optional: an account row with no player_profiles row (manual DB insert) to test the QR-missing branch — flag if not feasible via UI.

</details>

### Test cases

- [ ] **HOME-01** · `P0` `happy` `guest` — Unauthenticated request to / redirects to /login
  - **Pre:**
    - No active session: open a fresh/incognito window or clear cookies (no Supabase auth cookies set).
  - **Steps:**
    1. Navigate to http://127.0.0.1:3000/
    2. Observe the resulting URL and page.
  - **Expected:**
    - Browser ends up at /login (the mobile-frame login page renders).
    - Home/Digital ID content (TESUJI Digital ID card, Quick Access) is NOT shown.
    - Redirect is server-side from the Home component (no middleware exists), so it happens before any Home markup paints.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **HOME-02** · `P0` `happy` `player` — Authenticated Home renders real account, profile, role and Digital ID data
  - **Pre:**
    - Logged in as uat-player-01 (has a player_profiles row).
  - **Steps:**
    1. Navigate to http://127.0.0.1:3000/
    2. Inspect the Digital ID card at the top of the mobile frame.
    3. Read the Rank fact, Role fact, institute line and Player ID line.
  - **Expected:**
    - Header shows title 'หน้าแรก' and subtitle 'Digital ID และทางลัดของบัญชี TESUJI'.
    - Digital ID card shows the account's real Thai name (first_name_th + last_name_th) as the large heading and English name below it.
    - Rank fact shows the profile rank (or '-' if empty); Role fact shows the active role label in Thai (player=นักกีฬา, coach=โค้ช, referee=กรรมการ, admin=ผู้ดูแล).
    - Institute line shows institute_name or 'ยังไม่ได้ระบุสถาบัน'; 'Player ID' shows the first 8 chars of player_profiles.id uppercased.
    - A QR image is rendered in the white tile (QR is present because profile exists).
  - **DB:** accounts.active_role and player_profiles (first_name_th/en, last_name_th/en, rank, institute_name, id) for the logged-in account.id match what is displayed.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **HOME-03** · `P1` `happy` `player` — Rank verified vs pending banner reflects player_profiles.rank_status
  - **Pre:**
    - Logged in as uat-player-01.
  - **Steps:**
    1. Open / and read the small status banner with the shield icon below the Rank/Role facts.
    2. If the account rank_status is verified, expect 'Rank verified'; if pending, expect 'Rank pending review'.
    3. Optionally repeat with a second account whose rank_status differs.
  - **Expected:**
    - When player_profiles.rank_status = 'verified', the banner text reads 'Rank verified'.
    - When player_profiles.rank_status = 'pending', the banner text reads 'Rank pending review'.
  - **DB:** player_profiles.rank_status for the account matches the verified/pending banner text.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **HOME-04** · `P0` `edge` `player` — Digital ID QR is generated from a NON-secret payload
  - **Pre:**
    - Logged in as uat-player-01.
    - Have a QR-decoding tool ready (phone camera, online QR decoder, or screenshot decode).
  - **Steps:**
    1. Open / and locate the QR image on the Digital ID card.
    2. Click the QR to open the full-screen overlay, then decode the large QR image.
    3. Inspect the decoded JSON payload.
  - **Expected:**
    - Decoded payload is JSON with exactly: type='TESUJI_PLAYER_ID', version=1, profileId, nameTh, nameEn, rank, rankStatus, instituteName, activeRole, activeRoles[], issuedAt.
    - Payload contains NO secret/sensitive fields: no email, no phone, no national ID/passport, no password, no auth token.
    - profileId equals the account's player_profiles.id; activeRoles lists only roles with status='active'.
  - **DB:** player_profiles.id == decoded profileId; account_roles with status='active' match decoded activeRoles.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **HOME-05** · `P1` `edge` `player` — QR issuedAt is rounded down to the hour
  - **Pre:**
    - Logged in as uat-player-01.
  - **Steps:**
    1. Open / and decode the QR payload (as in HOME-04).
    2. Read the issuedAt ISO timestamp.
    3. Compare its minutes/seconds/milliseconds to zero.
  - **Expected:**
    - issuedAt is an ISO-8601 timestamp whose minutes, seconds and milliseconds are all 00:00.000 (rounded down to the start of the current hour via setMinutes(0,0,0)).
    - Re-loading the page within the same clock hour yields the same issuedAt value (so the QR data URL is stable within the hour).
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **HOME-06** · `P0` `happy` `player` — QR expands to a full-screen overlay and closes via X, Escape, and backdrop click
  - **Pre:**
    - Logged in as uat-player-01 (QR present).
  - **Steps:**
    1. Open / and click the QR tile (button labeled 'ขยาย QR Code Digital ID').
    2. Confirm the overlay appears, then click the X button (aria-label 'ปิด QR Code').
    3. Re-open the overlay and press the Escape key.
    4. Re-open the overlay and click on the dark backdrop area outside the white card.
    5. While the overlay is open once more, try scrolling the page behind it.
  - **Expected:**
    - Clicking the QR opens a fixed full-screen overlay (role='dialog', aria-modal='true') showing the large QR plus TESUJI Digital ID heading, Thai name, and a line 'nameEn · rank · roleLabel'.
    - The X button closes the overlay.
    - Pressing Escape closes the overlay.
    - Clicking the backdrop (outside the white card) closes the overlay; clicking inside the white card does NOT close it.
    - While open, the underlying page body is scroll-locked (document.body overflow hidden) and restores after close.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **HOME-07** · `P0` `happy` `player` — Quick Access shows exactly 6 tiles, all linking to existing real routes
  - **Pre:**
    - Logged in as a NON-admin player (uat-player-01).
  - **Steps:**
    1. Open / and scroll to the 'Quick Access' section.
    2. Read the count badge in the section header.
    3. Click each tile in turn and verify it navigates to a real page (use back to return).
  - **Expected:**
    - Section header 'Quick Access' with subtitle 'ทางลัดที่เชื่อมกับ route จริงแล้ว' and a count badge showing 6 (rendered in th-TH digits).
    - Tiles present: Notifications -> /notifications, โปรไฟล์ -> /profile, ดูรายการ -> /tournaments, รายการสมัคร -> /my-registrations, บทบาทของฉัน -> /profile (non-admin), and Coach Link/Linked Players -> /profile.
    - Every tile navigates to a route that exists and renders (none 404).
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **HOME-08** · `P0` `happy` `player` — Notifications Quick Access tile shows unread count badge and unread description
  - **Pre:**
    - Logged in as uat-player-01 who has at least 1 unread manual_notification_recipients row (read_at NULL). Send one via /admin/notifications targeting this account.
  - **Steps:**
    1. Confirm via DB the unread recipient count for this account (e.g. N=2).
    2. Open / and look at the Notifications tile.
    3. Read the badge and the description text.
    4. Click the tile to confirm it opens /notifications.
  - **Expected:**
    - Notifications tile shows a numeric badge equal to the unread count (th-TH locale formatting) when count > 0.
    - Description reads '<count> unread Admin message(s)' (count in th-TH digits) when there are unread items.
    - Tile click opens the /notifications inbox.
  - **DB:** Count of manual_notification_recipients where the recipient account = logged-in account AND read_at IS NULL equals the badge number.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **HOME-09** · `P1` `negative` `player` — Notifications tile with zero unread shows no badge and default description
  - **Pre:**
    - Logged in as an account with NO unread notifications (all manual_notification_recipients.read_at set, or none exist).
  - **Steps:**
    1. Open / and inspect the Notifications tile.
  - **Expected:**
    - No numeric badge is rendered on the Notifications tile.
    - Description reads 'Admin messages and tournament follow-up' (the default, non-unread copy).
  - **DB:** manual_notification_recipients for this account have read_at NOT NULL (or zero rows), i.e. unread count = 0.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **HOME-10** · `P0` `happy` `admin` — Fifth Quick Access tile is 'Admin' for an active-admin account
  - **Pre:**
    - Logged in as uat-admin-01 with account_roles admin=active.
  - **Steps:**
    1. Open / and inspect the fifth Quick Access tile.
    2. Click it.
  - **Expected:**
    - The fifth tile is labeled 'Admin' with description 'เปิดหน้าจัดการหลังบ้าน' and a shield icon.
    - Clicking it navigates to /admin (the Admin dashboard, which is reachable in dev mode without a separate admin login).
  - **DB:** account_roles for this account has role='admin' AND status='active'.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **HOME-11** · `P1` `edge` `player` — Fifth tile is 'บทบาทของฉัน' for a non-admin and shows pending Coach text when coach role is pending
  - **Pre:**
    - Logged in as an account that registered as coach but whose coach role is still pending (role_requests.requested_role='coach', status='pending') and is NOT an active admin.
  - **Steps:**
    1. Open / and inspect the fifth Quick Access tile.
  - **Expected:**
    - The fifth tile is labeled 'บทบาทของฉัน' (not 'Admin') and links to /profile.
    - Because a pending coach role request exists, the description reads 'Coach role รอ Admin อนุมัติ'.
    - If no pending coach request existed, the description would instead be the comma-joined Thai labels of the account's active roles (e.g. 'นักกีฬา').
  - **DB:** role_requests has requested_role='coach', status='pending' for this account; account_roles has no active admin row.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **HOME-12** · `P0` `happy` `coach` — Sixth tile is 'Linked Players' with approved-count description for an active Coach
  - **Pre:**
    - Logged in as uat-coach-01 with an active coach role and at least one approved coach_player_links row (status='approved') to a uat player profile.
  - **Steps:**
    1. Open / and inspect the sixth Quick Access tile.
  - **Expected:**
    - The sixth tile label is 'Linked Players' (because the user is an active coach).
    - Description reads '<N> linked players ที่อนุมัติแล้ว' where N is the number of coach_player_links with status='approved' (and a resolvable player) for this coach.
    - Tile links to /profile.
  - **DB:** Count of coach_player_links where coach_account_id = this account AND status='approved' equals N shown.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **HOME-13** · `P1` `happy` `player` — Sixth tile is 'Coach Link' for a non-coach account
  - **Pre:**
    - Logged in as a plain player with no active coach role.
  - **Steps:**
    1. Open / and inspect the sixth Quick Access tile.
  - **Expected:**
    - The sixth tile label is 'Coach Link' (not 'Linked Players').
    - Description reads 'อนุมัติหรือปฏิเสธคำขอเชื่อมจาก Coach'.
    - Tile links to /profile.
  - **DB:** account_roles has no row with role='coach' AND status='active' for this account.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **HOME-14** · `P1` `edge` `player` — Profile tile shows pending Coach-Link-request count when there are incoming pending links
  - **Pre:**
    - Logged in as a player whose player_profiles.id is the target of one or more pending coach_player_links (status='pending', incoming as the player).
  - **Steps:**
    1. Open / and inspect the 'โปรไฟล์' tile (second tile) description.
  - **Expected:**
    - With at least one incoming pending coach link, the profile tile description reads 'มีคำขอ Coach Link รออยู่ <N> รายการ' where N is the count of incoming links with status='pending'.
    - With zero incoming pending links, the description instead reads 'ดูข้อมูลโปรไฟล์และจัดการ Coach Link'.
  - **DB:** Count of coach_player_links where player_profile_id = this account's player_profiles.id AND status='pending' equals N.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **HOME-15** · `P0` `happy` `coach` — Active Coach sees the 'Linked Players' section listing only approved links with a resolvable player
  - **Pre:**
    - Logged in as uat-coach-01 (active coach) with one approved coach_player_links to uat-player-01 and at least one pending/rejected link to another player.
  - **Steps:**
    1. Open / and scroll below Quick Access to the 'Linked Players' section.
    2. Read the count badge and the player cards.
  - **Expected:**
    - A 'Linked Players' section appears (only because the user is an active coach) with subtitle 'เฉพาะผู้เล่นที่ approve Coach Link แล้ว' and a count badge equal to the number of approved links.
    - Each card shows the linked player's Thai name, English name, an 'approved' chip, and a 'rank · institute (or ยังไม่ได้ระบุสถาบัน)' line.
    - Pending/rejected/revoked links do NOT appear as cards in this section.
  - **DB:** coach_player_links rows with coach_account_id=this account, status='approved' map 1:1 to the rendered cards; pending/rejected rows are absent from the list.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **HOME-16** · `P1` `negative` `coach` — Active Coach with no approved links sees the Linked Players empty state
  - **Pre:**
    - Logged in as an active coach who has NO approved coach_player_links (only pending/rejected or none).
  - **Steps:**
    1. Open / and scroll to the 'Linked Players' section.
  - **Expected:**
    - The section still renders (active coach), count badge shows 0.
    - An empty state appears titled 'ยังไม่มี linked players ที่ approved' with description 'ส่งคำขอจากหน้า Profile และรอให้ Player เจ้าของบัญชีอนุมัติก่อน'.
  - **DB:** No coach_player_links with coach_account_id=this account AND status='approved'.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **HOME-17** · `P1` `negative` `player` — Non-coach account does NOT see the Linked Players section
  - **Pre:**
    - Logged in as a plain player (no active coach role).
  - **Steps:**
    1. Open / and scroll through the page between Quick Access and Tournament Snapshot.
  - **Expected:**
    - No 'Linked Players' section is rendered (it is gated to active coaches only).
    - The page goes from Quick Access directly to the Tournament Snapshot section.
  - **DB:** account_roles has no role='coach' status='active' for this account.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **HOME-18** · `P2` `happy` `player` — Tournament Snapshot shows static empty states and links to /tournaments
  - **Pre:**
    - Logged in as any account.
  - **Steps:**
    1. Open / and scroll to the 'Tournament Snapshot' section.
    2. Click the Trophy icon button in the section header (aria-label 'Open tournaments').
  - **Expected:**
    - Section header 'Tournament Snapshot' with subtitle 'อ่านรายการแข่งขันที่เผยแพร่จริงจาก Supabase'.
    - Two dashed empty-state cards render: 'รายการแข่งขัน' (mentions /tournaments and that drafts are hidden) and 'การสมัครที่รอดำเนินการ' (mentions Sprint 5).
    - Clicking the Trophy button navigates to /tournaments (the public mobile list).
    - Note: these two cards are STATIC placeholders, not live data.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **HOME-19** · `P0` `happy` `player` — Logout button signs the user out and returns to /login; revisiting / redirects to /login
  - **Pre:**
    - Logged in as any account.
  - **Steps:**
    1. Open / and scroll to the bottom; click the 'ออกจากระบบ' (Logout) button.
    2. Observe the navigation result.
    3. After logout completes, manually navigate to http://127.0.0.1:3000/ again.
  - **Expected:**
    - Clicking Logout posts to /api/auth/logout, then routes to /login (button shows a disabled/pending state during the transition).
    - After logout, the Supabase auth session/cookies are cleared.
    - Re-navigating to / now redirects to /login (confirming the session is gone).
  - **DB:** After logout, getUser() has no session; no DB row changes expected (sign-out only clears the client session/cookies).
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **HOME-20** · `P1` `edge` `player` — QR-missing branch: account without a player profile shows disabled QR and '-' Player ID
  - **Pre:**
    - Logged in as an account that has an accounts row but NO player_profiles row. This is not produced by normal signup; it likely requires a manual DB setup. If not feasible, record in notes rather than skipping silently.
  - **Steps:**
    1. Open / and inspect the Digital ID card.
  - **Expected:**
    - The QR tile shows the text 'QR ยังไม่พร้อม' and the QR button is disabled (cursor-not-allowed, reduced opacity) so clicking does nothing.
    - The large name falls back to 'ยังไม่มีโปรไฟล์' / 'Player profile required'; Rank fact shows '-'; Player ID line shows '-'.
    - createDigitalIdQrDataUrl returns null when account.profile is null, so no QR image is generated and the overlay cannot be opened.
  - **DB:** accounts row exists for this user but player_profiles has no row with account_id = this user.id.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **HOME-21** · `P2` `edge` `player` — Roles shown are only ACTIVE roles (status filter)
  - **Pre:**
    - Logged in as an account that has at least one non-active role row (e.g. a coach role that is pending/inactive in account_roles) plus active roles.
  - **Steps:**
    1. Open / and inspect the Role fact on the Digital ID card and the QR payload activeRoles[].
    2. If the account is a non-admin with a non-active coach role, inspect the fifth tile's role label text too.
  - **Expected:**
    - Only roles with status='active' influence isActiveAdmin / isActiveCoach branching and the QR activeRoles[] list; non-active roles are excluded.
    - The fifth tile's joined role-label text (when no pending coach request) lists only active roles' Thai labels.
  - **DB:** QR activeRoles[] equals the set of account_roles rows with status='active' for this account; any status!='active' role does not appear.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

- [ ] **HOME-22** · `P2` `negative` `player` — Active session but missing accounts row is treated as unauthenticated (redirect to /login)
  - **Pre:**
    - A valid Supabase auth.users session exists but there is no matching row in public.accounts (e.g. signup DB completion failed / accounts row deleted while the auth user remains). May require manual DB setup; record in notes if not reproducible.
  - **Steps:**
    1. With such a session active, navigate to http://127.0.0.1:3000/.
  - **Expected:**
    - getCurrentAccount() returns null because the accounts query yields no row, so the Home component calls redirect('/login').
    - User lands on /login even though an auth session technically exists.
  - **DB:** auth.users has the user but public.accounts has no row with id = that user id.
  - **Result:** ⬜ pass · ⬜ fail — บันทึก: 

> ⚠️ **ข้อสังเกตจากโค้ด (อ่านก่อนเทส suite นี้):**
> - NO middleware.ts exists in the repo (Glob for **/middleware.ts returned nothing). The unauthenticated -> /login redirect for Home is implemented ONLY by redirect('/login') inside the Home server component (src/app/page.tsx:25-27) when getCurrentAccount() returns null. There is no app-wide route guard; other routes implement their own auth handling separately.
> - getCurrentAccount() returns null in TWO cases: (a) supabase.auth.getUser() has no user, OR (b) there is no matching public.accounts row even when an auth user exists (current-account.ts:54-78). Both cause the Home redirect to /login. HOME-22 covers case (b) but may need manual DB setup to reproduce.
> - Potential bug / observation: getMyUnreadNotificationCount() (user-notifications.ts:82-96) selects from manual_notification_recipients with read_at IS NULL and NO explicit account_id filter; it relies entirely on RLS to scope rows to the current user. If RLS on manual_notification_recipients is ever misconfigured, the Home Notifications badge could leak/over-count notifications across accounts. Worth verifying RLS actually restricts the count to the logged-in account during UAT (compare badge to a direct admin-side count for that account).
> - createDigitalIdQrDataUrl returns null when account.profile is null, which makes the QR tile disabled and the overlay unreachable (HOME-20). A normally-registered account always has a player_profiles row, so the no-profile branch is an edge case that likely needs manual DB intervention to exercise.
> - The QR payload is intentionally non-secret: it includes profileId, names, rank, rankStatus, instituteName, activeRole, activeRoles, issuedAt, type, version — and deliberately does NOT include email, phone, national ID/passport, or any token (qr.ts:23-37; CurrentAccount carries email/phone but they are not passed into the payload). HOME-04 verifies this by decoding the QR.
> - issuedAt uses local server time rounded down to the hour via new Date() + setMinutes(0,0,0), then toISOString() (qr.ts:50-54). The emitted ISO string is in UTC; testers should confirm minutes/seconds are zero rather than asserting a specific local hour, since toISOString() converts to UTC.
> - Quick Access always renders exactly 6 tiles. Tile 5 toggles Admin (active admin) vs 'บทบาทของฉัน', and tile 6 toggles 'Linked Players' (active coach) vs 'Coach Link'. The count badge in the header is hardcoded to quickActions.length (6), so it will read 6 regardless of role.
> - The Linked Players section (page.tsx:150-198) and the 'Linked Players' tile description both depend on isActiveCoach (account_roles coach=active). A coach whose role is still pending (role_requests) is NOT an active coach and will see the non-coach variants.
> - Tournament Snapshot's two cards are STATIC placeholder EmptyStates (page.tsx:216-225), not live tournament/registration data. Only the Trophy header link is functional (-> /tournaments). Do not expect real tournament rows here.
> - All Home content renders inside MobileShell (mobile frame, max-w-[430px]); the global RootLayout loads Noto Sans Thai so Thai labels render correctly. The Admin Quick Access tile target /admin is desktop and not route-protected in dev mode, so it opens without an admin login even though the tile only appears for active-admin accounts.
> - Logout is client-side (logout-button.tsx): POST /api/auth/logout then router.push('/login') + router.refresh(). It clears the session; HOME-19 confirms a subsequent visit to / redirects to /login.

---

<a id="appendix-a"></a>
## ภาคผนวก A — ช่องโหว่ความครอบคลุม & เคสเสริมจาก Critic

| Area | สิ่งที่ยังขาด | เคสที่แนะนำเพิ่ม | Pri |
|------|--------------|------------------|-----|
| Routes not exercised — /payments/[id]/slip GET method | The route map lists /payments/[id]/slip but src/app/payments/[id]/slip/route.ts implements ONLY POST (runtime nodejs). A GET/PUT/DELETE to this path returns Next's default 405 Method Not Allowed. No suite verifies the route rejects non-POST verbs, and none confirms the POST returns {ok:true,result} JSON shape on success (the SLIP cases assert UI side-effects but never the route's 200 JSON envelope). | SLIP-ROUTE-METHODS: Direct GET /payments/{validOrderId}/slip while logged in -> expect 405 (no body parsing, no DB write). Then POST a valid jpg with the session cookie -> expect HTTP 200 JSON {ok:true,result:{...}} (not a redirect), confirming the slip route's success envelope, and that result mirrors submitPaymentSlip's return. | `P2` |
| Registration server-action defense-in-depth (status/window) — submitTournamentRegistration | REG-02/REG-03 (registration suite) only assert the register PAGE renders a 'closed' panel. But submitTournamentRegistration (src/app/tournaments/[id]/register/actions.ts) does NOT re-validate tournament status or the registration window itself — it relies entirely on create_registration_transaction RPC (202606080003 lines 167-178), which raises 'Tournament is not open for registration' / 'Registration has not opened yet' / closed. No case forces a POST against a draft/closed/future-window/past-window tournament to confirm the server rejects it (mapped via toFriendlyRegistrationError to 'รายการนี้ยังไม่เปิดรับสมัคร'/'รายการนี้ปิดรับสมัครแล้ว'). | REG-SRV-WINDOW: With a valid logged-in player session, craft a POST to submitTournamentRegistration for (a) a DRAFT tournament id, (b) an open tournament whose registration_opens_at is future, (c) one whose registration_closes_at is past. Expect each rejected with the mapped Thai error and ZERO registrations/payment_orders rows — proving the RPC status/window guard, not just the page gate. | `P1` |
| Cross-tournament division injection guard — createRegistrationTransaction | transaction.ts (lines 112-126) counts divisions matching BOTH tournament_id AND the submitted division ids, raising 'รุ่นที่เลือกไม่ตรงกับรายการแข่งขันนี้' if a division id does not belong to the tournament. No suite tests submitting a division id from a DIFFERENT tournament (DOM-tampered hidden tournamentId vs divisionIds mismatch). This is the only client-supplied-id cross-entity guard in the register flow and is completely uncovered. | REG-XTOUR-DIV: On the register form for tournament A, tamper a divisionIds value to a real division id belonging to tournament B (same logged-in player), submit. Expect error 'รุ่นที่เลือกไม่ตรงกับรายการแข่งขันนี้' and no rows written. | `P1` |
| Payment page Admin-driven terminal states (rejected / cancelled / confirmed) on /payments/[id] | src/app/payments/[id]/page.tsx renders PaymentStatePanel branches for rejected ('สลิปนี้ไม่ผ่านการตรวจสอบ...'), cancelled, expired, and confirmed (page.tsx lines 86-89, 183-345). The Payment suite notes these exist but has NO dedicated test case that an order driven to 'rejected' (via /admin/payments Reject-send-new) shows the rejected panel WITH a re-upload path, nor that a 'confirmed' order shows the confirmed state with a working signed slip link and NO QR/upload. Only pending_payment/pending_verify/expired are concretely covered. | PAY-REJECTED-PANEL: Drive an order to 'rejected' via /admin/payments Reject-send-new (note: reject_send_new actually returns it to pending_payment per PAY-03 — verify whether a truly 'rejected' status panel is reachable at all from current admin actions; if rejected is unreachable, flag the dead UI branch). PAY-CONFIRMED-PANEL: After admin Approve, open /payments/{orderId} as owner -> confirmed PaymentStatePanel, no QR, no upload card, 'เปิดสลิปที่ส่งแล้ว' signed link still works. | `P2` |
| PromptPay merchant-name non-ASCII stripping (QR payload correctness) | sanitizeMerchantName (promptpay.ts lines 115-125) strips ALL non-ASCII chars, uppercases, and caps at 25 chars; a Thai promptpay_name (e.g. 'สมชาย ใจดี') becomes empty -> falls back to literal 'TESUJI' in QR tag 59. The PAY suite asserts 'ชื่อบัญชี shows promptpay_name' on screen but never checks what name is ENCODED IN THE QR. A banking app scanning the QR will show TESUJI, not the configured Thai name — a real UX/correctness gap worth a dedicated decode check. | PAY-QR-MERCHANTNAME: Configure tournament.promptpay_name with a Thai-only name, open /payments/{pendingOrderId}, decode the QR -> tag 59 merchant name resolves to 'TESUJI' (all Thai stripped). Confirm the on-screen ชื่อบัญชี still shows the Thai name (display vs encoded divergence). Repeat with an ASCII name to confirm it survives, uppercased, truncated to 25. | `P2` |
| PromptPay ID normalization branches (11-digit 66-prefixed, 13-digit 0066-prefixed, 15-digit e-wallet) | normalizePromptPayIdentifier (promptpay.ts lines 60-99) has FIVE accepted formats: 10-digit 0-prefixed phone, 11-digit 66-prefixed, 13-digit 0066-prefixed (tag 01), plain 13-digit national ID (tag 02), 15-digit e-wallet (tag 03). PAY suite only exercises the common phone/13-digit-ID path and the malformed-reject (PAY-05). The 11-digit-66, 0066-13-digit, and 15-digit e-wallet branches are untested, as is the masking display (first-3 + bullets + last-4) for a 15-digit id. | PAY-PROMPTPAY-FORMATS: For tournaments configured with each of promptpay_id = 11-digit '66812345678', 13-digit '0066812345678', and 15-digit e-wallet, open /payments/{order} -> QR renders (no error), masked id displays sensibly. Confirm a 12-digit or 14-digit value hits the 'PromptPay ID must be...' error (already PAY-05 for '123', extend to length boundaries 12/14/16). | `P2` |
| Tournament detail page (/tournaments/[id]) as registration entry — CTA navigation + non-existent/cancelled id | The Home and Tournament-Admin suites cover the public detail render and CTA gating, but no suite explicitly tests the navigation handoff: clicking 'สมัครแข่งขัน' on /tournaments/[id] actually lands on /tournaments/[id]/register AND that the register page resolves the same tournament. Also a non-UUID/random-UUID /tournaments/[id] (not just draft) 404 path is only covered for draft (TRN-NEG-11), not for a well-formed-but-unknown UUID or a malformed id. | TRN-DETAIL-NAV: From an open tournament's public detail, click the enabled CTA -> verify URL is /tournaments/{sameId}/register and the register form (not a 'wrong tournament' state) renders. TRN-DETAIL-404: Open /tournaments/{random-but-valid-uuid} and /tournaments/not-a-uuid -> both notFound() 404. | `P2` |
| Coach-link RLS / cross-user read isolation on /my-registrations and /payments/[id] | NEG/SLIP suites cover that an UNRELATED account 404s on another user's payment/registration. But there is no positive+negative pairing proving a coach who had a link REVOKED (status revoked, previously approved) can NO LONGER see/act on that player's registrations or payment order. getAccessibleProfileIds / canAccessPaymentOrder require status='approved'; a transition from approved->revoked must immediately cut access. This RLS-adjacent boundary (link lifecycle vs access) is untested. | COACH-REVOKE-ACCESS: Coach B has approved link to player A and can see A's registration at /my-registrations and A's order at /payments/{id}. Player A (or admin) sets the link to revoked/rejected. Re-load both pages as B -> A's registration disappears from /my-registrations and /payments/{A-order} now 404s for B (only approved links grant access). | `P1` |
| Concurrent / race conditions on quota and waiting-list position | REG-21/22 cover sequential waitlist position increment, but no case probes the concurrency boundary: two players submitting to the LAST available slot of a capped division near-simultaneously. create_registration_transaction computes available_slots from reserved counts; without row locking, both could read slot=1 and both confirm/pending, over-filling max_players. Worth at least a manual best-effort double-submit to document actual behavior (and whether a unique/locking guard exists). | REG-RACE-LASTSLOT: Division with max_players where reserved = max_players - 1 (one slot left). In two browser sessions, submit two different eligible players to that division as close to simultaneously as possible. Expect exactly ONE to get the reserved slot (pending_payment/confirmed) and the other to be waiting_list #1 — flag if both are reserved (quota overrun). | `P2` |
| Admin payments approve when 0 registrations updated (Zod-after-commit bug noted but not tested) | The Admin-Ops suite NOTES the reviewPaymentResultSchema requires updatedRegistrations positive int, so if approve_payment_order commits but returns 0 updated registrations the Zod parse throws AFTER commit (confusing 'error' UI on a succeeded approval). This is flagged as a potential bug but has no dedicated test to confirm/repro (e.g. an order whose linked registrations were already cancelled before approve). | PAY-APPROVE-ZEROUPD: Construct a pending_verify order whose linked registrations were all moved out of pending_verify (e.g. cancelled) just before clicking Approve. Click Approve -> observe whether the UI shows an error while the order still flips to confirmed on reload (confirming the post-commit Zod-throw bug), or whether the RPC guards it. Record exact behavior. | `P2` |
| Manual notification tournament-audience preview vs send divergence (status enum) | The Notifications suite NOTES getTournamentRecipientCounts uses an INCLUSION list while the RPC uses an EXCLUSION list, equal only for the current 7-status enum. MNOT-09/10 verify equality today but there is no explicit regression-marker case asserting preview == sent for a tournament containing EVERY one of the 7 registration statuses (incl. a waiting_list and a pending_verify registrant), which is the exact scenario that would surface drift if the enum changes. | MNOT-PREVIEW-PARITY: Build uat-notif-tour with at least one registrant in each of pending_payment, pending_verify, confirmed, waiting_list (included) and cancelled, expired, rejected (excluded). Note the compose 'Preview recipients' number, send, and assert the RPC-returned recipient count EQUALS the preview and EQUALS the count of distinct accounts across the 4 included statuses (owner+registered_by deduped). | `P2` |
| Reset-password / forgot-password rate-limit & callback error states | AUTH-11/13 cover the happy reset and missing-session 401, but no case covers /auth/callback with an INVALID or already-consumed code (exchangeCodeForSession failure) — what the user sees when a reset link is clicked twice or is malformed (?code=garbage). Also no boundary for an expired recovery link landing on /reset-password. | AUTH-CALLBACK-BADCODE: Open /auth/callback?code=invalid-garbage&next=/reset-password -> verify the error/redirect behavior (does it land on /login with an error, or /reset-password with no session so AUTH-13's 401 applies?). Click a valid reset link a SECOND time after the first consumed it -> confirm graceful failure, not a crash. | `P2` |
| Admin DB upload concurrency / partial-failure rollback on go-player replace | The Admin-DB suite covers happy replace, all-skipped (no replace), and parser errors, but not the destructive-replace ROLLBACK boundary: if replace_go_player_database_source deletes the source rows then the insert fails mid-batch, is the source left empty? And the re-sync (syncVerifiedProfilesFromGoDatabase) running after a PARTIAL import — does a verified profile lose its match if the new file omits its name? No case verifies a verified player_profiles row's rank is downgraded/cleared when a DAN re-upload no longer contains their name. | DBADM-RESYNC-DROP: With a verified profile matched to a DAN row, upload a NEW dan workbook that does NOT contain that player's name. After the post-upload re-sync, check whether that verified profile's matched_go_player_id / rank / rating are left stale, cleared, or re-matched to a weaker KYU/AWARD row — document the actual behavior as it affects real verified users. | `P1` |
| Logout endpoint and session-expiry mid-action | HOME-19 covers logout via the Home button, but no case covers POST /api/auth/logout while NOT logged in (idempotency -> still 200 {ok:true}?) nor the behavior when a server action (e.g. submit registration, upload slip) is invoked with a session that expired between page-load and submit (getCurrentAccount null mid-action). The user-side mid-action auth-loss path is unspecified. | AUTH-LOGOUT-IDEMPOTENT: POST /api/auth/logout with no session -> expect 200 {ok:true} (no error). AUTH-MIDACTION-EXPIRE: Load the register form, clear auth cookies in DevTools, then submit -> expect the createRegistrationTransaction 'กรุณาเข้าสู่ระบบก่อนสมัครแข่งขัน' error surfaced, not a crash. | `P2` |
| Referee invite: self-redeem when already a referee, and admin-side create when IDENTITY_HASH_SALT missing | REF-REDEEM cases cover revoked/expired/already-redeemed, but not: (a) a logged-in account that ALREADY has active referee role hitting /referee/invite sees the 'already has role' panel (the form is hidden) — only implied by REF-REDEEM-01's reload, never tested as its own precondition; (b) create/redeem invite when IDENTITY_HASH_SALT is unset throws 'Missing IDENTITY_HASH_SALT' (noted in preconditions but no negative env case). | REF-ALREADY: Log in as an account that already holds active referee role, open /referee/invite -> 'บัญชีนี้มี role Referee แล้ว' panel, no form. REF-ENV-MISSING (env sanity, optional): temporarily unset IDENTITY_HASH_SALT, attempt create at /admin/roles -> error surfaced, no invite row. | `P2` |
| Profile editing / read-only confirmation | There IS a src/app/profile/actions.ts (server actions exist on /profile beyond coach-link). The Profile suite treats /profile as view + coach-link only, but does not enumerate or test whatever other actions profile/actions.ts exposes (e.g. any profile field edit, or it may be only the coach search/request/respond actions). If profile/actions.ts contains mutations beyond coach-link, they are entirely uncovered. | PROF-ACTIONS-AUDIT: Read src/app/profile/actions.ts and enumerate every exported server action; for any not already covered by COACH-*/PLAYER-* cases (e.g. profile field updates), add a happy + a permission-negative case. If it is purely coach-link actions, document that explicitly so the suite's scope claim is verified. | `P2` |

---

<a id="appendix-b"></a>
## ภาคผนวก B — ข้อสังเกต/บั๊กที่อาจพบ (รวมจากทุก suite)

> รวมรายการ `notes` ที่ reader แต่ละตัว flag ไว้จากการอ่านโค้ด — จุดที่กำกวม อาจเป็นบั๊ก หรือควรยืนยันด้วยตาตอนเทส

**1. Auth & Registration**
- Referee role cannot be chosen in the register wizard at all: RoleStep only renders Player and Coach. Referee is granted separately via an Admin invite code at /referee/invite (redeem_referee_invite). Admin role is seeded manually. So no AUTH/REG case can self-register as referee or admin — this matches the spec.
- POSSIBLE GAP: client-side validateProfile() only checks that identityDocumentValue is non-empty (.trim()), but the server schema requires min 6 chars. A 1-5 char value passes Step 1 and only fails at the final /api/auth/signup with 'กรุณากรอกเลขเอกสาร' (covered by REG-12). There is also no national-ID format/length/checksum validation beyond maxLength=13 on the input element — a 5-digit national ID is accepted as long as it is >=6 chars overall... note 13-digit IDs are >6 so fine; the gap is only the 1-5 char window.
- POSSIBLE UX GAP: in the rank step, for status 'matched'/'multiple' the wizard always preselects candidates[0] (setSelectedCandidateId to first id). The guard 'กรุณาเลือก record ที่ตรงกับคุณ' in goToRoleStep can only fire if selectedCandidateId is empty, which won't happen for a non-empty candidate list. The radios have no native deselect, so REG-20's empty-selection branch is effectively unreachable from the UI; documented as designed.
- Forgot-password endpoint returns {ok:true} success for ANY syntactically valid email (Supabase resetPasswordForEmail does not error on unknown emails by design), so AUTH-09 success text appears even for a non-existent address — this is intended anti-enumeration behavior, not a bug.
- Identity privacy confirmed in code: hashIdentityDocument() salts with IDENTITY_HASH_SALT and stores SHA-256 hex in player_profiles.identity_document_hash (unique). The raw national ID / passport number is never persisted; migration 202606010004 also revokes direct client updates to accounts/player_profiles. Testers should verify in Supabase that identity_document_hash is a 64-char hex string and that no raw ID column exists.
- Self-declared rank power levels: Kyu power = 17 - kyu (15 Kyu=2 ... 1 Kyu=16); Dan power = 16 + dan (1 Dan=17 ... 9 Dan=25). selfDeclaredRankOptions = 15 Kyu..1 Kyu then 1 Dan..9 Dan. Self path always sets rank_status='pending', rating=NULL, matched_go_player_id=NULL regardless of how high the declared rank is (REG-04).
- Cookie persistence: createSupabaseRouteHandlerClient applies maxAge=30 days only when remember=true; otherwise session cookie. Login default remember=true (LoginForm), signup default remember=true (RegisterWizard). update-password and auth/callback always use remember=true.
- Signup is atomic with rollback: if complete_account_signup RPC fails (e.g. duplicate hash/email), the just-created auth.users row is deleted via adminClient.auth.admin.deleteUser. Verify no orphan auth user remains after duplicate tests.
- If SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY is missing, /api/auth/signup returns HTTP 500 with a Thai 'ยังไม่ได้ตั้งค่า...' message before any user is created; if IDENTITY_HASH_SALT is missing, hashIdentityDocument throws (unhandled) -> 500. Worth a one-off env sanity check before running REG cases.
- Cleanup guidance: each REG-* signup creates rows in auth.users, accounts, account_roles, player_profiles (and role_requests for coach). Delete the auth.users row (cascades to accounts -> account_roles/role_requests/player_profiles via ON DELETE CASCADE) to fully clean up a uat- test account. Use uat- email prefixes and obvious test names to find them.
- DB write summary for verification (from complete_account_signup RPC + migration 202606010003/...0005): accounts(active_role='player'), account_roles(player/active), player_profiles(all profile fields + rank snapshot + pdpa_consent/pdpa_consent_at), and for coach an extra role_requests(coach/pending). Coach never gets account_roles.coach at signup — only a pending role_requests row.

**2. Profile & Coach Link**
- Coach activation is a hard precondition not satisfiable from /register alone: registering as coach only inserts a pending role_requests row. The Coach Links tools (search + request) require account_roles.coach with status='active', which an Admin must grant (review_coach_request, surfaced at /admin/roles). Plan the coach test account around an Admin approval step first.
- Self-link has defense in depth: the search RPC excludes the coach's own profile (pp.account_id <> p_coach_account_id), so NEG-02 cannot be reached via the normal UI at all — the 'Send link request' path for one's own profile is only reachable by forcing requestCoachPlayerLink with the coach's own profile id, where the RPC raises 'Coach cannot link to their own player profile'. Tester should note the UI never surfaces this case.
- Duplicate-request idempotency is enforced at three layers: UI disables the button when existingLinkStatus is 'pending' or 'approved'; the RPC returns the existing row id without inserting for pending/approved; and a UNIQUE(coach_account_id, player_profile_id) DB constraint guarantees a single row per pair. There is no way to create two rows for the same coach+player.
- Re-request after rejected/revoked is allowed and resets the SAME row to pending (requested_at refreshed, responded_at/revoked_at cleared) — it does not create a new row. UI reflects this because rejected/revoked are not treated as alreadyLinked, so the 'Send link request' button is enabled again.
- Notifications subsystem here is only the unread-count entry point on /profile and the /notifications inbox. getMyUnreadNotificationCount and getMyNotifications run under the user's RLS client (createSupabaseServerComponentClient) and rely on manual_notification_recipients RLS to scope to the current user; the count is NOT filtered by an explicit user-id column in the query, so correct scoping depends on RLS — worth a deliberate check that one user never sees another's count.
- Coach/player link notifications: there is NO automatic notification generated when a coach requests a link or a player approves/rejects (request_coach_player_link / respond_coach_player_link only mutate coach_player_links). The only notifications shown anywhere are manual Admin notifications. Do not expect a 'new coach request' notification to appear automatically.
- /profile and the coach search depend on real player_profiles rows with all of first_name_th/last_name_th/first_name_en/last_name_en/rank/rank_status populated; a player account without a completed profile will not appear in coach search (RPC joins player_profiles) and getCoachLinkDashboard returns empty (account.profile null short-circuits).
- The 'pending' count badge in 'Coach requests' and the unread notification pill use Thai-locale digit formatting (toLocaleString('th-TH')); /notifications uses en-US. Numbers may render as Thai numerals on /profile — not a bug.
- Admin route /admin/users is read-only and a convenient way to verify Coach Link status counts and pending coach role requests without querying the DB directly, but it is not part of this subsystem's user flow.
- Cleanup after testing: delete the coach_player_links rows, the player_profiles rows, role_requests, account_roles, accounts, and the underlying auth users for every uat- account created, plus any manual_notification_recipients/manual_notifications used for PROF-04.

**3. Tournament — Admin CRUD + Public**
- VERIFIED: The main TournamentForm always submits each division with status='active' (hardcoded in actions.ts parseDivisionJson, line ~235) and timeSlotLabel defaulting to 'เช้า'. There is NO control in the bulk create/edit form to set a division to 'closed'/'cancelled'. The standalone DivisionForm component (which has a Status dropdown) is defined in tournament-forms.tsx but is NOT rendered anywhere on /admin/tournaments/[id] (the detail page only renders TournamentStatusActions, TournamentForm, PromoCodeForm). Consequence: to test the 'open blocked when no active division' rule you must either remove ALL divisions (not possible via UI — the form blocks removing the last division: the remove button is disabled when divisions.length===1) or set a division status to non-active directly in the DB. So OPEN-NO-ACTIVE-DIV is effectively only reachable via a DB edit. Flagged as a gap in TC TRN-NEG-04.
- VERIFIED: Editing an existing tournament via TournamentForm REPLACES divisions (replaceTournamentDivisions). Divisions present in the form are kept/updated by id; any existing division whose id is NOT in the submitted JSON is DELETED. Because the edit form re-derives status='active' for every division on save, re-saving the edit form will reset any division previously set to closed/cancelled (e.g. via DB) back to active. Tester should be aware editing wipes manual division-status changes.
- VERIFIED: Division status='active' is what both the public registration CTA (getIsRegistrationOpen requires divisions.some(status==='active')) and the open-status guard (setTournamentStatus counts status='active' divisions) rely on. Public detail DivisionCard shows division.status text but does NOT hide non-active divisions.
- VERIFIED: Banner size is enforced in TWO places — Supabase bucket file_size_limit=2097152 AND server code maybeUploadTournamentBanner (>2MB -> 'Banner image must be 2MB or smaller.'). Also Next serverActions.bodySizeLimit='3mb' will reject the whole request before the action runs if the multipart body exceeds 3MB, giving a different/generic error rather than the friendly 2MB message. So a 2-3MB file yields the friendly message; a >3MB file yields a body-size/runtime error.
- VERIFIED: Banner mime is restricted by the file input accept='image/jpeg,image/png,image/webp' AND server validation (non-allowed type -> 'Banner image must be JPG, PNG, or WebP.'). The accept attribute is only a filter; if the picker is switched to 'All files' a disallowed type still gets rejected server-side.
- VERIFIED: googleMapsUrl must start with http:// or https:// else action error 'Google Maps URL must start with http:// or https://.' (parseTournamentInput). Banner URL (existingBannerUrl hidden field) must start with /, http://, or https:// — but this is a hidden field populated from the existing record, not directly tester-editable.
- VERIFIED: Open/NULL bounds — leaving a power or age dropdown on the 'Open' option submits '' which parses to null; DB stores NULL; public detail formatNumberRange renders 'Open' for null min/max. RangePreview in the form shows 'Open' live.
- VERIFIED: Registration window validation — registrationClosesAt must be >= registrationOpensAt or action error 'Registration close must be after open.' Also a DB CHECK constraint tournaments_registration_window_check enforces the same.
- VERIFIED: Numeric window — division max power < min power (or max age < min age) is blocked client-impossible-to-trigger via dropdowns in normal order but enforced server-side: 'Division N max power must be at least min power.' / 'Division N max age must be at least min age.' Power dropdown values are derived from rank power levels (9x9=0, 13x13=1, then ranks); age dropdown is 0..100.
- VERIFIED: Promo code is uppercased on save (toUpperCase) and DB has a generated code_normalized with a UNIQUE(tournament_id, code_normalized). A second promo with the same code (case/space-insensitive) in the same tournament will fail with a Postgres unique-violation surfaced as a generic action error (not a friendly message).
- VERIFIED: Promo discount validation — percentage must be 1..100 ('Percentage discount must be between 1 and 100.'), fixed must be >0 ('Fixed discount must be greater than 0.'), free forces discountValue=0. DB CHECK promo_codes_discount_check mirrors this.
- VERIFIED: setTournamentStatus sets published_at=now() and clears cancelled_at when going to 'open'; sets cancelled_at=now() when going to 'cancelled'. Status buttons available on detail: open, closed, in_progress, completed, cancelled. The current status button is disabled. Delete draft button is disabled unless status==='draft'.
- VERIFIED: deleteDraftTournament refuses non-draft ('Only draft tournaments can be deleted.') and missing id ('Tournament not found.'); cascade deletes divisions/promo_codes via FK on delete cascade. The UI also disables the Delete button for non-draft, so the negative path is only reachable by editing the disabled attribute or a stale page.
- VERIFIED: Public list getPublicTournaments filters status<>'draft'; ordering is by event_starts_at asc then created_at desc. event_starts_at is derived from event_date at +07:00. Public detail getPublicTournamentDetail also excludes draft (returns 404/notFound for draft id). Public detail promoCodes is always [] (promo codes never shown publicly).
- POTENTIAL ISSUE: Public list/detail StatusBadge has no explicit style for 'closed'/'in_progress'/'completed'; they fall through to the default amber style. Not a bug, just cosmetic — all non-open/non-cancelled statuses look the same. Worth a visual note when testing closed tournaments.
- POTENTIAL ISSUE: Public list date formatting uses new Date(`${eventDate}T00:00:00.000Z`) (UTC) while toTournamentMutation stored event_starts_at at +07:00. The displayed event date on the public list/detail is interpreted as UTC midnight, so for Thailand timezone the displayed calendar date should still match event_date, but admin card formatEventDate also uses UTC — confirm the date shown equals the date picked in the wheel picker (no off-by-one).
- VERIFIED: Removing the last division is impossible in the form (remove button disabled when divisions.length===1); the bulk form requires >=1 division ('Add at least one division.' if divisionsJson is empty/invalid).
- Banner is uploaded under path `${tournamentId}/${uuid}.{ext}` in bucket tournament-banners and banner_url stores the public URL. On create, if any step fails the uploaded banner and the tournament row are rolled back/removed. On update, a failed save removes the newly uploaded banner.

**4. Tournament Registration**
- The on-page 'สรุปยอด' box never previews promo discounts; the discount only appears in the post-submit 'ผลการสมัคร' panel. Subtotal there counts only payable divisions (waiting_list and free are excluded from ยอดก่อนส่วนลด). Verify testers do not expect a live discounted total before submitting.
- toFriendlyRegistrationError (actions.ts) has NO mapping for age errors ('Player is below/above the division minimum/maximum age'). For age-out-of-bounds the raw English RPC message is shown to the user (REG-25/26). All age cases are also pre-blocked client-side as ineligible cards, so this only surfaces if the client guard is bypassed — still an inconsistency worth flagging.
- The client form pre-filters ineligibility: ineligible divisions (wrong power/age, already registered, time conflict, inactive division) render disabled checkboxes, so the negative server paths (REG-09, REG-20, REG-23..26, REG-29) are reachable in normal use only by DOM tampering of the hidden playerProfileId input or the disabled checkboxes. They are included to test server-side defense-in-depth, which matches the RPC raises in migration 202606080003.
- Quota: division_registration_summary.available_slots and the QuotaBadge derive 'full' from reserved = pending_payment + pending_verify + confirmed (NOT waiting_list). A division at max_players shows badge 'waiting list' even though new submits still succeed as waiting_list rows. max_players NULL => badge 'ไม่จำกัด' and availableSlots null, so it never routes to waiting_list.
- Promo atomicity: every promo rejection (invalid/expired/inactive/over-used/already-used/wrong-division/no-payable-target/no-discount) raises inside the single RPC transaction, so the ENTIRE registration is rolled back — including any waiting_list/free rows that would otherwise have been created. Confirm zero rows in registrations/payment_orders/promo_code_usages and unchanged promo_codes.used_count after each promo-negative case.
- Promo-on-non-payable (REG-19): selecting only full/free divisions plus a promo blocks the whole submission ('does not apply to any payable registration'). Without a promo, the same selection would succeed (waiting_list/confirmed). This asymmetry is by design but easy to misread as a bug.
- Page renders the form only when data.players.length>0 AND data.divisions.length>0 AND getIsRegistrationOpen true. getIsRegistrationOpen requires tournament.status==='open' AND at least one division.status==='active' AND now within opens/closes window (NULL bounds treated as open-ended).
- Coach-linked players appear in 'เลือกผู้เล่น' only when the actor has an ACTIVE coach role (account_roles role='coach' status='active') AND coach_player_links.status='approved'. Pending/rejected links must NOT appear.
- promoCode is trimmed/length-validated (max 64) by both the action zod schema and the transaction.ts schema before the RPC; an empty/whitespace promo is sent as null (no promo path). code matching in the RPC uppercases and strips ALL whitespace, so 'uat 25' matches a stored code normalized to 'UAT25'.
- Cleanup: deleting a uat- tournament should also clear its divisions, promo_codes, registrations, payment_orders, promo_code_usages; also delete the uat- auth users/accounts. Verify follow-up counts are 0, matching the project's smoke-test cleanup discipline.

**5. Payment / Slip / My-Registrations / Cancel / Waiting-list**
- AUTH SCOPE: User-facing payment/registration pages have NO dev-mode auth bypass (unlike /admin*). getCurrentAccount() relies on supabase.auth.getUser(). A logged-out tester gets 404 on /payments/[id] (notFound, NOT a /login redirect) and a /login redirect on /my-registrations. The tester must hold a real Supabase session cookie for every user-side case.
- TITLE COLUMN MISMATCH: src/lib/registrations/payment.ts fetchTournament() selects 'id,title,title_en,event_date,event_starts_at,promptpay_id,promptpay_name' (no title_th) yet TournamentRow/getTournamentTitle reference title_th. If the tournaments table has no 'title' column the select will error; if it does, title_th fallback is dead. Verify the actual tournaments schema (title vs title_th/title_en) before trusting the displayed tournament title. my-registrations.ts has the same pattern.
- MIME VALIDATION IS TYPE-BASED, NOT MAGIC-BYTE: both client (validateSlip) and server (validateSlipFile) check File.type against {image/jpeg,image/png}. A real JPEG/PNG with a tampered/empty type, or a non-image whose type is spoofed to image/jpeg, would bypass the check (the RPC does not re-validate content). This is a potential security gap worth flagging for hardening (content sniffing).
- STORAGE ORPHAN ON RPC FAILURE: submitPaymentSlip uploads to Storage FIRST, then calls submit_payment_slip RPC; on RPC error it best-effort removes the object (.catch(()=>undefined)). If the remove fails, an orphaned slips object can linger. For the expiry/status guards that throw BEFORE upload, no object is created. Cleanup: check bucket 'slips' under {tournament_id}/{orderId}/ after negative SLIP tests.
- EVENT-DATE DISPLAY vs CANCEL CUTOFF: list/detail formatEventDate renders eventDate as '{eventDate}T00:00:00.000Z' (UTC) via th-TH, which can show the previous calendar day for UTC+7 users, while the cancel cutoff isOnOrAfterEventDate compares the raw eventDate string against today's Bangkok date (en-CA). The cutoff logic is correct (Bangkok), but the displayed date may look off by one day — note for CANCEL-05 so testers compare against the DB event_date, not the rendered label.
- SIGNED SLIP URL EXPIRY: createSignedUrl uses 600s (10 min). A slip link opened from a page loaded >10 min earlier may 400/expire; reload the page to regenerate. Applies to /payments/[id] and /my-registrations/[id].
- WAITING-LIST SETUP IS THE HARD PART: capacity/quota and waiting_list_position are produced by create_registration_transaction (S5.1/S5.2), not by these pages. To get a deterministic waiting_list row, fill the paid/free division to its quota first, then register the next player. Promotion (S5.7) is FIFO by waiting_list_position, then created_at, then id; ensure the intended 'oldest' row truly has the lowest ordering.
- PAYMENT-PAGE STATUS PANEL: when status is rejected/cancelled/expired/confirmed the page renders PaymentStatePanel (not QR). 'rejected' shows 'สลิปนี้ไม่ผ่านการตรวจสอบ...'. These states are produced by Admin actions (S5.6), so to exercise them the tester must drive /admin/payments first.
- DEV PORT NOTE: the handoff smoke logs used port 3100, but the assigned base URL for this UAT is http://127.0.0.1:3000 (npm run dev -- --hostname 127.0.0.1 --port 3000). Use 3000.
- TEST DATA HYGIENE: every write lands in the REAL linked Supabase dev project. Prefix all tournaments/accounts with uat-, and after testing delete created registrations, payment_orders, and slips Storage objects. Negative SLIP cases should leave NO slips object (validation precedes upload); verify and remove any strays.

**6. Admin Operations Queues + Referee Invite**
- Admin mutation seam ensureAdminMutationAllowedForDevMode()/getAdminActorAccountIdForDevMode() pass null in dev mode, so all approve/reject/revoke/rank/timeout RPCs run with p_admin_account_id=null and no Admin-role check — the tester needs no admin login. This is intentional dev behavior, not a bug, but means anyone reaching /admin* can mutate real data; flag for production hardening before launch.
- POTENTIAL BUG (PAY-02): reviewPaymentResultSchema requires updatedRegistrations to be a positive int (z.coerce.number().int().positive()). If approve_payment_order ever returns 0 updated registrations, the Zod parse throws AFTER the DB transaction commits, surfacing a confusing client error even though the approval succeeded. Worth a tester note if approve shows an error but the order still becomes confirmed on reload.
- The PaymentReviewControls share one useActionState across approve + both reject forms, and disable ALL controls once any action succeeds (isComplete). After one action on a card the other buttons are intentionally locked until reload — expected, but note it so testers do not mis-read it as a bug.
- Rank edit-rank validation differs slightly by layer: the page select only offers selfDeclaredRankOptions (15 Kyu..1 Kyu, 1 Dan..9 Dan), the action requires finalRank within that set, and the lib re-validates via rankToPowerLevel. 9x9/13x13 map to power 0/1 in rankToPowerLevel but are NOT in selfDeclaredRankOptions, so they cannot be chosen as a final rank.
- Referee invite display 'expired' is computed client/server-side from status=unused AND expires_at<=now (getRefereeInviteDisplayStatus); the stored row may still be status=unused until a redeem attempt marks it expired. Dashboard counts and /admin/roles use the same derivation so they should agree.
- Slip preview uses a 10-minute signed URL from the private slips bucket; if the page sits open longer than 10 minutes the inline image/Open link may 403 — reload to regenerate. Not a defect.
- redeem/create/revoke referee invite all require IDENTITY_HASH_SALT; without it hashRefereeInviteCode throws 'Missing IDENTITY_HASH_SALT' and create/redeem fail. Confirm the env var before running referee tests.
- After a successful redeem the user already holds an active referee role, so re-opening /referee/invite shows the 'already has role' panel and the form is hidden — to retest redemption use a different uat account.
- Registrations CSV and /admin/users are the two surfaces explicitly required to exclude identity/national-id/passport/document hashes and private slip fields; both were verified in code to select only staff-safe columns (registrations.ts csvHeaders/select lists; users.ts select lists). USER-04 and REG-03 are the targeted leak checks.
- Clean up all uat- rows after testing: created referee_invite_codes, role_requests, granted account_roles (coach/referee), and any registrations/payment_orders mutated by approve/reject/timeout. These are REAL writes to the linked Supabase dev project.

**7. Manual Notifications**
- DIVERGENCE RISK (not a current bug): Admin 'Preview recipients' count for tournament mode is computed in src/lib/admin/notifications.ts getTournamentRecipientCounts() using an INCLUSION list ['pending_payment','pending_verify','confirmed','waiting_list'], while the actual send RPC (202606120001_manual_notifications.sql) uses an EXCLUSION list status NOT IN ('cancelled','expired','rejected'). Today these are exact complements of the 7-value registrations status enum, so the preview equals the sent count. If a new registration status is ever added, the preview and the real recipient count would silently diverge. Worth a regression note.
- The Admin 'Preview recipients' number in the compose form is purely CLIENT-SIDE (manual-notification-form.tsx useMemo). all_accounts uses the page's allAccountCount, tournament uses the selected tournament's precomputed recipientCount, selected uses new Set([checked..., pastedSplit...]).size (dedupe shown live). The authoritative recipient count is what the RPC returns and what 'Recent sends' shows after submit.
- Pasted account IDs are validated as UUIDs by the FORM action schema (actions.ts: accountIds: z.array(z.string().uuid())). A malformed token (non-UUID) fails parse and returns the first zod issue message (e.g. 'Invalid uuid') with status=error BEFORE the RPC is called. A well-formed but NON-EXISTENT UUID passes the form, is sent to the RPC, then silently dropped by the RPC's join to public.accounts.
- If selected_accounts resolves to zero real accounts (all UUIDs nonexistent), the RPC raises 'Notification audience has no recipients' and DELETES the just-inserted manual_notifications row (rolled back) — no notification or recipient rows persist. The form shows status=error with that message.
- Dedupe happens at three layers: (1) client preview Set, (2) server unique() in parseAccountIds/sendManualNotification, (3) RPC SELECT DISTINCT + unique(notification_id, account_id) constraint with ON CONFLICT DO NOTHING. Pasting the same UUID twice, or pasting a UUID also checked in the list, must yield exactly ONE recipient row.
- markMyNotificationRead (user-notifications.ts) updates by .eq('notification_id', ...).maybeSingle() and relies on RLS to scope to the caller's own recipient row. For another user's notification the RLS update returns no row -> throws 'Notification not found.' shown as red error text under the Mark read button. There is no per-user filter in the query itself; correctness depends entirely on the manual_notification_recipients_mark_own_read RLS policy (account_id = auth.uid()).
- The 'Mark read' button is disabled after a successful mark (disabled={isPending || state.status==='success'}) without a reload; the card visually flips to 'read' only after the revalidatePath-driven re-render / reload. After reload the recipient row's read_at persists and the card shows the 'read' badge + 'Read <date>'.
- Unread count entry points both call getMyUnreadNotificationCount() (counts manual_notification_recipients with read_at IS NULL via the user's session/RLS): Home (src/app/page.tsx) renders a Notifications tile whose subtitle is 'N unread Admin message(s)' (th-TH formatted) linking to /notifications; /profile (src/app/profile/page.tsx) renders a pill 'N unread'. Both must drop by 1 after marking one notification read.
- Recent sends table on /admin/notifications shows columns Notification (title + short id + optional link), Audience (All accounts / Tournament / Selected, plus tournament title), Recipients (total recipient rows), Read (read count + 'N unread'), Created (Asia/Bangkok formatted). Audience label mapping: all_accounts->'All accounts', tournament_registrants->'Tournament', selected_accounts->'Selected'.
- Link validation: linkUrl must start with '/' or match ^https?:// (enforced in form schema actions.ts, lib schema notifications.ts, and the SQL CHECK + RPC). The user inbox renders an external https link as <a target=_blank rel=noreferrer>, and a relative '/...' link as a Next <Link>; both render the 'Open link' button. javascript:/ftp:/mailto: links are rejected at send time.
- Account search form on /admin/notifications submits GET to /admin/notifications with field name 'accountQ' (label 'Search accounts'); it searches via getAdminUsers (email/name/phone/rank/UUID), limit 25 options. Checkboxes have name='accountIds'; the paste textarea has name='pastedAccountIds' (split on whitespace/comma/semicolon).
- Title maxLength=120 and Body maxLength=2000 are enforced by the input maxLength attribute (UI truncation) AND server zod (.max) AND SQL CHECK. Title/Body are required (HTML required + zod min(1)). Empty/whitespace-only title or body returns 'Title is required.' / 'Body is required.'
- There is no explicit success toast beyond the inline result line: on success the form shows green 'Notification sent to N recipient(s).' plus 'Notification <shortId> / <audienceType>'. The compose form fields are NOT auto-cleared after a successful send (only the action state changes), so re-submitting without editing would send a duplicate — note this for the tester.

**8. Admin Database Upload + Search**
- DESTRUCTIVE REPLACE: A successful go-player upload calls RPC replace_go_player_database_source(p_source, p_rows) which replaces ALL rows of that one source; a successful school upload calls replace_school_database(p_rows) replacing the WHOLE school_database table. There is no append mode and no per-row dedupe against existing DB rows. Treat every successful upload as 'wipe + reload this source from the file'. This is the single biggest risk for the owner during UAT — flagged in preconditions.
- Size guard order: file.size > 10*1024*1024 is checked BEFORE the workbook is parsed and BEFORE any DB write (upload routes lines 30-35 / 24-29), so an oversized file returns 400 'Excel files must be 10MB or smaller.' and writes NOTHING (not even a database_import_runs row).
- Extension guard is by filename only: file.name must end with '.xlsx' (case-insensitive) else 400 'Only .xlsx files are supported.' A real .xlsx renamed to .csv is rejected; a non-Excel file renamed to .xlsx passes the extension check and then fails in the parser (422, and an 'error' row IS recorded in database_import_runs).
- Validation/permission errors (400: unknown source, missing file, wrong extension, oversize) return BEFORE parse and do NOT write a database_import_runs row. Parser/RPC errors (422) and zero-importable-rows (422) DO write a database_import_runs row with status='error' via tryRecordDatabaseImportRun.
- Power-level math (verify in go_player_database.power_level): DAN n→16+n (1 Dan=17 … 9 Dan=25, though DB caps at valid 1-9). KYU k→17-k with k clamped to 15 if raw>=16 (1 Kyu=16 … 15 Kyu=2). AWARD rank derived ONLY from rank_in_category via parseAwardRankFromRankInCategory (e.g. '13 Kyu' single → kyu=min(15,max(1,13-1))=12 → '12 Kyu' power 5; ranges like '5-7' use min then -1; literal '9x9'/'13x13' map to 12 Kyu). category column is stored for display/audit only and does NOT affect rank.
- AWARD import requires BOTH: rank_award ∈ {1,2,3} (else skip 'rank_award_not_1_2_3') AND a mappable rank_in_category (else skip 'unmapped_rank_in_category'). Missing firstname/lastname on any source skips with 'missing_first_or_last_name'.
- Re-sync of verified profiles (syncVerifiedProfilesFromGoDatabase) runs AFTER every successful go-player upload (all three sources), not just DAN. It rematches every rank_status='verified' player_profiles row by NORMALIZED Thai first/last name against the whole go_player_database, picking DAN over KYU/AWARD, then highest power_level, then highest rating, and writes rank/power_level/rating/matched_go_player_id back. syncedProfiles count is surfaced in the UI success message and stored in database_import_runs.synced_profiles. With only 2 verified profiles in the DB today, expect a small/zero number unless a verified profile's normalized name matches an uploaded row.
- rank/search ordering: matchGoPlayerRank queries DAN first; if ANY dan candidate exists it returns only dan results and NEVER falls back to kyu/award. Only when zero dan rows match does it search kyu+award and keep the strongest candidate per normalized person. Response status is 'matched' (exactly 1 candidate), 'multiple' (2-5), or 'not_found'. Each candidate carries evidence[] built from year_promoted/rating/diamond (dan), event_date (kyu), or rank_award/category/rank_in_category/event_name/event_date (award) — these are the documented evidence fields.
- Name matching is accent/variant-insensitive via normalizeThaiName (e.g. ศ/ษ→ส, ณ→น, ญ→ย, ภ→พ, ใ→ไ, strips ก์ mark and collapses spaces). A search that differs only by these substitutions should still match — useful edge case.
- schools/search: GET with empty/missing q short-circuits to {results:[]} with HTTP 200 (no DB call, no error). limit is coerced and clamped to 1-20 (default 8); q is trimmed and capped at 120 chars (over-120 → 400 'คำค้นหาไม่ถูกต้อง'). Results come from RPC search_school_database and include match_type exact|keyword|fuzzy and similarity_score; keyword hits ('ACSP') should surface the parent school.
- rank/search validation: body must have non-empty trimmed firstNameTh AND lastNameTh (zod min(1)); otherwise 400 'กรุณากรอกชื่อและนามสกุลไทย'. Malformed/empty JSON body also yields this 400.
- /admin/database page is force-dynamic and reads everything live from Supabase: per-source row COUNTS (count exact head) and 4 SAMPLE rows come from go_player_database/school_database directly; the 'อัปโหลดผ่านหน้า Admin ล่าสุด' / skip-reason / synced-profiles panels come from the LATEST database_import_runs row per source (getLatestDatabaseImportRun). It does not read any local .tesuji-upload-status.json file. If Supabase read fails, the card shows a red 'ต้องตรวจสอบ' status and an error banner.
- MINOR/POTENTIAL ISSUE: the AWARD '9x9'/'13x13' rank_in_category map to '12 Kyu' (power 5) in the importer, but ranks.ts rankToPowerLevel treats literal '9x9'→0 and '13x13'→1. These are different code paths (import vs. generic rank parsing) so award rows are stored as '12 Kyu', not '9x9'. Not a bug for this flow but worth noting if a tester expects a literal 9x9 award rank.
- EDGE: KYU raw rank >=16 is clamped to 15 Kyu (power 2). KYU rank <1 or non-integer is skipped 'invalid_or_empty_kyu_rank'. DAN must be integer 1-9 inclusive; 0, 10, decimals, or blank are skipped 'invalid_or_empty_dan_rank'.
- Cleanup: after any destructive replace test, re-upload the canonical DAN/KYU/AWARD/SCHOOL workbooks to restore the production counts (DAN 1142 / KYU 1635 / AWARD 985 / SCHOOL 3). The database_import_runs table only grows (one row per attempt) and has no UI delete; uat-* runs can be left as audit history or removed directly in Supabase if desired.

**9. Home / Digital ID + Navigation**
- NO middleware.ts exists in the repo (Glob for **/middleware.ts returned nothing). The unauthenticated -> /login redirect for Home is implemented ONLY by redirect('/login') inside the Home server component (src/app/page.tsx:25-27) when getCurrentAccount() returns null. There is no app-wide route guard; other routes implement their own auth handling separately.
- getCurrentAccount() returns null in TWO cases: (a) supabase.auth.getUser() has no user, OR (b) there is no matching public.accounts row even when an auth user exists (current-account.ts:54-78). Both cause the Home redirect to /login. HOME-22 covers case (b) but may need manual DB setup to reproduce.
- Potential bug / observation: getMyUnreadNotificationCount() (user-notifications.ts:82-96) selects from manual_notification_recipients with read_at IS NULL and NO explicit account_id filter; it relies entirely on RLS to scope rows to the current user. If RLS on manual_notification_recipients is ever misconfigured, the Home Notifications badge could leak/over-count notifications across accounts. Worth verifying RLS actually restricts the count to the logged-in account during UAT (compare badge to a direct admin-side count for that account).
- createDigitalIdQrDataUrl returns null when account.profile is null, which makes the QR tile disabled and the overlay unreachable (HOME-20). A normally-registered account always has a player_profiles row, so the no-profile branch is an edge case that likely needs manual DB intervention to exercise.
- The QR payload is intentionally non-secret: it includes profileId, names, rank, rankStatus, instituteName, activeRole, activeRoles, issuedAt, type, version — and deliberately does NOT include email, phone, national ID/passport, or any token (qr.ts:23-37; CurrentAccount carries email/phone but they are not passed into the payload). HOME-04 verifies this by decoding the QR.
- issuedAt uses local server time rounded down to the hour via new Date() + setMinutes(0,0,0), then toISOString() (qr.ts:50-54). The emitted ISO string is in UTC; testers should confirm minutes/seconds are zero rather than asserting a specific local hour, since toISOString() converts to UTC.
- Quick Access always renders exactly 6 tiles. Tile 5 toggles Admin (active admin) vs 'บทบาทของฉัน', and tile 6 toggles 'Linked Players' (active coach) vs 'Coach Link'. The count badge in the header is hardcoded to quickActions.length (6), so it will read 6 regardless of role.
- The Linked Players section (page.tsx:150-198) and the 'Linked Players' tile description both depend on isActiveCoach (account_roles coach=active). A coach whose role is still pending (role_requests) is NOT an active coach and will see the non-coach variants.
- Tournament Snapshot's two cards are STATIC placeholder EmptyStates (page.tsx:216-225), not live tournament/registration data. Only the Trophy header link is functional (-> /tournaments). Do not expect real tournament rows here.
- All Home content renders inside MobileShell (mobile frame, max-w-[430px]); the global RootLayout loads Noto Sans Thai so Thai labels render correctly. The Admin Quick Access tile target /admin is desktop and not route-protected in dev mode, so it opens without an admin login even though the tile only appears for active-admin accounts.
- Logout is client-side (logout-button.tsx): POST /api/auth/logout then router.push('/login') + router.refresh(). It clears the session; HOME-19 confirms a subsequent visit to / redirects to /login.

---

<a id="appendix-c"></a>
## ภาคผนวก C — ตาราง Sign-off (เติมหลังเทส)

| # | Suite | Cases | Pass | Fail | Blocked | ผู้เทส | วันที่ | หมายเหตุ |
|---|-------|------:|-----:|-----:|--------:|--------|--------|----------|
| 1 | Auth & Registration | 40 | | | | | | |
| 2 | Profile & Coach Link | 22 | | | | | | |
| 3 | Tournament — Admin CRUD + Public | 32 | | | | | | |
| 4 | Tournament Registration | 33 | | | | | | |
| 5 | Payment / Slip / My-Registrations / Cancel / Waiting-list | 44 | | | | | | |
| 6 | Admin Operations Queues + Referee Invite | 44 | | | | | | |
| 7 | Manual Notifications | 24 | | | | | | |
| 8 | Admin Database Upload + Search | 27 | | | | | | |
| 9 | Home / Digital ID + Navigation | 22 | | | | | | |
| | **รวม** | **288** | | | | | | |

**สถานะรวมก่อน launch:** ⬜ ผ่านทั้งหมด · ⬜ ผ่านแบบมีเงื่อนไข · ⬜ ไม่ผ่าน (มี P0 ค้าง)
