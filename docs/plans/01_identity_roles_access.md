# 01 Identity, Roles, And Access

## Objective

ทำระบบตัวตนให้ถูกก่อนทุกอย่าง เพราะ role model ใหม่เป็นฐานของ register, coach, referee, admin และ RLS ทั้งหมด

## Final Role Model

- Register page เลือกได้เฉพาะ `player` หรือ `coach`
- `player`: สร้าง account, granted role `player`, และสร้าง Player Profile ของตัวเอง 1 profile ทันที
- `coach`: สร้าง account, granted role `player`, สร้าง Player Profile ของตัวเอง 1 profile ทันที และสร้าง `role_requests.coach` เป็น `pending`; ยังไม่มีสิทธิ์ coach จนกว่า Admin approve
- `referee`: สมัครตรงไม่ได้ ต้อง redeem invite code ที่ Admin สร้าง
- `admin`: มีคนเดียว seed ผ่าน DB/Supabase Dashboard
- Account หนึ่งอาจมีหลาย granted roles และเลือก `active_role` ได้เฉพาะ role ที่ active

## Tables

- `accounts`
  - Auth mirror: `id = auth.users.id`, `email`, `phone`, `active_role`, `is_active`
  - ไม่ใช้ `accounts.role` เป็น source of truth

- `account_roles`
  - `account_id`, `role`, `status`, `granted_by`, `granted_at`, `revoked_at`
  - unique `(account_id, role)`
  - permission checks ใช้ table นี้เสมอ

- `role_requests`
  - ตอนนี้รองรับ `requested_role = coach`
  - states: `pending`, `approved`, `rejected`, `cancelled`
  - Admin approve แล้วสร้างหรือ activate `account_roles.coach`

- `referee_invite_codes`
  - เก็บ `code_hash` เท่านั้น ไม่เก็บ raw code
  - states: `unused`, `redeemed`, `expired`, `revoked`
  - redeem สำเร็จแล้วสร้าง `account_roles.referee`

## Services

- `getCurrentAccount()`
  - อ่าน auth session แล้ว join `accounts` + active roles
  - ถ้า auth user มีแต่ยังไม่มี account row ให้ repair หรือบังคับ onboarding ตาม flow

- `setActiveRole(role)`
  - ตรวจ `account_roles.status = active`
  - ห้าม set role ที่ยัง pending/revoked

- `requestCoachRole(reason)`
  - create pending request ถ้ายังไม่มี pending/active coach
  - ถ้ามี active coach แล้วคืน error ชัดเจน

- `reviewCoachRequest(requestId, decision, adminNote)`
  - admin only
  - approve: update request + upsert `account_roles.coach`
  - reject: update request only

- `createRefereeInvite(expiresAt)`
  - admin only
  - generate raw code ให้แสดงครั้งเดียว
  - store hash in DB

- `redeemRefereeInvite(rawCode)`
  - hash code, lock row, validate unused/not expired
  - mark redeemed + create `account_roles.referee`

## UI Pages

- `/register`
  - Step 1 full Player Profile
  - Step 2 rank matching against Go Player DB
  - Step 3 choose Player/Coach only
  - Step 4 account credentials and final confirm
  - Coach branch creates Player Profile and shows pending message: contact Admin to verify Coach role

- `/settings` or role switch menu
  - shows active roles only
  - pending coach shown as pending, not selectable

- `/coach/requests`
  - coach request status
  - link requests after coach approved

- `/referee/invite`
  - redeem code form
  - success sets referee role active or available

- `/admin/roles`
  - coach approval queue
  - referee invite creation/revoke list

## RLS And Security

- `account_roles`
  - read: owner or admin
  - write: admin or trusted server action only

- `role_requests`
  - insert: owner
  - read: owner/admin
  - owner may cancel only pending
  - admin may approve/reject

- `referee_invite_codes`
  - raw code never stored
  - normal users cannot list valid invite codes
  - redeem happens through server action/RPC to avoid leaking hashes

## Acceptance Tests

- New Player signup creates auth user, account, `account_roles.player`, player profile
- New Coach signup creates auth user, account, `account_roles.player`, player profile, and pending coach request
- Coach pending cannot access coach-only registration flow
- Admin approve coach grants coach role
- User cannot set `active_role = coach` before approval
- Admin creates referee invite; user redeems once; second redeem fails
- Revoked/expired invite fails
