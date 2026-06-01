# 08 Quality, Release, And No-Mock Audit

## Objective

กำหนดวิธีตรวจว่าระบบพร้อมจริง ไม่ใช่แค่หน้าตาสวยแต่ยังไม่มี function ข้างหลัง

## Local Stack

- Supabase local required for development verification
- Next.js dev server required for browser checks
- Seed data allowed only under clear local seed scripts
- Hosted Supabase setup happens after Phase 1 local passes

## Required Commands

- `npm run lint`
- `npm run build`
- `npx supabase db reset`
- `npx supabase functions serve` for Edge Function tests when cron/payment timeout is touched

## Automated Test Targets

- Pure logic
  - rank conversion
  - Thai normalization
  - promo calculation
  - age calculation
  - time-slot conflict
  - TSV parser

- DB/service
  - RLS matrix by role
  - account role grant/revoke
  - coach link permissions
  - registration transaction rollback
  - payment state transitions
  - waiting list promotion

- E2E/browser
  - Player signup to profile created
  - Coach signup to admin approval to player link
  - Referee invite redeem
  - Tournament create to public detail
  - Registration to payment to admin approve
  - Tournament day import to live result

## Manual No-Mock Audit

For every completed page, verify:

- Empty state comes from empty DB, not hardcoded copy only
- Loading state appears during real async call
- Error state appears when service/RLS rejects
- Success state appears only after DB mutation
- Refreshing browser preserves state from DB
- Logging in as another role changes visible actions through RLS/service checks

## Responsive Gate

- User pages:
  - 375px, 390px, 430px
  - no horizontal scroll
  - Thai labels fit buttons/cards
  - bottom nav not overlapping CTAs

- Admin pages:
  - 1024px minimum
  - tables usable
  - filters/actions visible
  - long Thai names do not break layout

## Release Readiness

Phase 1 ready only when:

- Player/Coach/Referee/Admin role model works
- Go Player DB import/search works with real files
- Tournament CRUD works
- Registration/payment/admin verify works
- Coach can register only approved linked players
- No stale teacher/parent/multi-profile assumptions remain

Phase 2 ready only when:

- Referee invite and permissions work
- TSV import works
- Judge page writes real match data
- Live results update via Realtime
- Standings import displays real rows

