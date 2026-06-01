# 03 Player Profile And Coach Link

## Objective

ล็อกความหมายของ Player Profile ให้ไม่ย้อนกลับไปเป็น multi-profile account: Player Profile คือ ID นักกีฬา 1 คนที่ผูกกับ account ของนักกีฬาคนนั้นเท่านั้น

## Rules

- ทุก account ที่สมัครผ่านหน้า Player/Coach signup ต้องมี Player Profile ของตัวเองสูงสุด 1 profile
- Coach account มี Player Profile ของตัวเองได้และใช้ลงแข่งเองได้
- Coach account สร้าง Player Profile ให้คนอื่นไม่ได้
- Coach จัดการ Player ได้เฉพาะหลัง Player approve link
- Player revoke Coach Link ได้
- Coach revoke link ได้
- Admin เห็น relationship เพื่อ audit แต่ไม่ควรเป็นคน approve แทน Player ใน normal flow

## Tables

- `player_profiles`
  - `account_id UNIQUE`
  - identity fields immutable after create
  - editable by owner: phone/email via account/profile contact fields
  - editable by admin: rank/rank_status if needed

- `coach_player_links`
  - `coach_account_id`
  - `player_profile_id`
  - `status`: pending, approved, rejected, revoked
  - timestamps: requested/responded/revoked

## Player Profile Creation Flow

1. User enters identity and contact data before choosing role
3. National ID/passport hash is calculated server-side or trusted server action
4. System checks uniqueness
5. Rank matching runs against Go Player DB
6. User confirms matched candidate or self-declares rank
7. Auth user/account/profile/PDPA are created in a single controlled flow
8. If final role is Coach, system also creates `role_requests.coach = pending`

## Coach Link Flow

1. Coach must have `account_roles.coach = active`
2. Coach searches Player by Player ID, email, or exact name
3. Search result must not expose sensitive fields
4. Coach sends request
5. Player sees request in notifications/profile area
6. Player approves or rejects
7. Approved link unlocks coach actions:
   - view registration status
   - register for tournament
   - pay for registrations
   - follow live results
8. Revoked/rejected link immediately removes access

## Permission Matrix

- Player owner
  - read own full profile
  - update allowed contact fields
  - approve/reject/revoke coach links

- Coach approved
  - read public/registration-relevant info for linked players
  - create registrations for linked players
  - read linked player registration/payment status if created by coach or visible by relationship

- Coach pending
  - cannot link player
  - cannot register for player

- Public
  - can read public player list fields only where masterplan allows applicant list
  - never sees national_id_hash

## UI

- `/profile`
  - Player: own Digital ID/profile, incoming Coach Link requests
  - Coach: coach approval status, approved linked players, pending outgoing requests

- Coach search modal
  - fields: Player ID/email/name
  - result: name, rank, institute, action request
  - no national ID/passport, no private email unless search by exact email and access is appropriate

## Acceptance Tests

- DB blocks second profile for same account
- Coach cannot insert player profile
- Coach pending cannot create link request
- Player can approve pending coach link
- Coach can register only approved linked players
- Revoked link removes coach access immediately
