# 04 Tournament Admin

## Objective

ให้ Admin สร้างและจัดการรายการแข่งขันจริงได้ก่อนเปิดระบบสมัคร โดยข้อมูลทุกอย่างต้องไหลไปหน้า public list/detail และ registration validation ได้

## Tables

- `tournaments`
  - central event data, registration dates, event dates, PromptPay info, banner
  - statuses: draft, open, closed, in_progress, completed, cancelled

- `divisions`
  - one tournament has many divisions
  - each division has own fee, time slot, pairing settings, rank/age constraints, max players

- `promo_codes`
  - per tournament
  - free, percentage, fixed
  - all divisions or selected division IDs

## Admin Create Flow

1. Create tournament draft
2. Upload optional banner
   - jpg/png
   - max 2MB
   - aspect 16:9 or 1:1
3. Add divisions one by one
4. Add promo codes optional
5. Review all data
6. Save draft or schedule open by registration date

## Status Rules

- draft
  - editable fully
  - hard delete allowed

- open
  - public registration allowed
  - central info editable
  - division fee edit affects new registrations only
  - close early allowed

- closed
  - no new registration
  - waiting list remains visible

- in_progress
  - Phase 2 tournament-day features active

- completed
  - read-only for normal operations

- cancelled
  - all registrations cancelled
  - refund handled manually by Admin

## Promo Code Rules

- Code unique per tournament
- One code per account per tournament
- Coach payment still uses coach account for promo usage, not each linked player
- Scope:
  - NULL = all divisions
  - UUID array = selected divisions only
- Usage increments only when registration/payment order is successfully created
- If registration transaction fails, usage must rollback

## Public Pages

- `/tournaments`
  - filters by status
  - cards read real applicant counts

- `/tournaments/[id]`
  - banner, details, divisions, counts, CTA
  - CTA disabled if not open/closed by rule

## Edge Cases

- Division has max players null: unlimited confirmed/pending quota
- Deleting division with registrations: do not hard delete; close division/manual refund path
- Edit fee after registrations exist: existing payment orders unchanged
- Date auto open/close must not override cancelled/completed

## Acceptance Tests

- Admin creates tournament with two divisions
- Public list/detail shows real data
- Dev mode: route-level Admin protection is deferred; do not block Admin routes yet
- Future security gate: when protection is enabled, non-admin cannot create/edit tournament and the check uses `account_roles.admin = active`
- Banner validation blocks wrong type/size/aspect
- Promo code scoped to one division fails on another division
- Draft hard delete works only if status draft
