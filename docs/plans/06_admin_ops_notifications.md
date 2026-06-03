# 06 Admin Operations And Notifications

## Objective

ทำเครื่องมือหลังบ้านที่ Admin ต้องใช้ทุกวันให้ครบ: ตรวจสลิป, approve rank, approve coach, referee invite, export รายชื่อ, notification manual

## Admin Queues

1. Payment verification
   - source: `payment_orders.status = pending_verify`
   - actions: approve, reject-send-new, reject-cancel

2. Pending rank approval
   - source: `player_profiles.rank_status = pending`
   - actions: approve as-is, edit rank then approve

3. Coach approval
   - source: `role_requests.requested_role = coach AND status = pending`
   - actions: approve, reject

4. Referee invites
   - create invite
   - revoke invite
   - view redeemed/expired status

5. Registration lists
   - per tournament/division
   - export CSV/Excel

## Payment Verification

Approve:

- payment_order.status = confirmed
- verified_by = admin account
- verified_at = now
- all linked registrations = confirmed

Reject send new:

- payment_order.status = pending_payment
- registrations.status = pending_payment
- keep slip_url for audit or store previous slip history if added later

Reject cancel:

- payment_order.status = cancelled
- registrations.status = cancelled
- return quota
- promote waiting list

## Pending Rank Approval

- Admin sees name, declared rank, power level, created date
- If edit:
  - recalculate power level
  - set rank_status = verified
- Do not silently overwrite identity fields

## Notifications

- Manual only
- No automatic notification from system events unless Admin writes/sends
- Recipients:
  - all accounts
  - accounts with registrations in tournament
  - selected account IDs
- Optional link
- User sees bell badge and mark-read behavior

## Admin User Management

- Read user/account list
- Show roles and statuses
- Show coach links count
- Show player profile if exists
- Avoid displaying national_id_hash
- Destructive actions should be deferred unless explicitly specified

## Exports

- Registration export per division
- Include:
  - order number
  - player TH/EN name
  - rank/power_level
  - institute
  - status
  - registered_at
  - registered_by account role/name where available
- Exclude:
  - national_id_hash
  - private sensitive data not needed by tournament staff

## Acceptance Tests

- Dev mode: route-level Admin protection is deferred; do not block Admin queues yet
- Future security gate: when protection is enabled, non-admin cannot access admin queues and the check uses `account_roles.admin = active`
- Admin approve payment confirms all linked registrations
- Reject-cancel returns quota exactly once
- Approve rank recalculates power level
- Coach request approve grants active coach role
- Referee invite raw code shown once and stored as hash
- Manual notification sends N rows to selected audience
- Export contains real DB rows and excludes sensitive fields
