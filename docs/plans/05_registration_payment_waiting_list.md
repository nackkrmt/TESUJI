# 05 Registration, Payment, And Waiting List

Token-light note: for day-to-day Sprint 5 work, use `docs/plans/05_registration_payment_token_light_slices.md` first. Read this full subsystem plan only when a slice needs more detail.

## Objective

ทำสมัครแข่งให้จบจริง: เลือก Player, validate รุ่น, ตัด quota, สร้าง payment order, อัปโหลดสลิป, Admin verify, cancel, timeout, waiting list

## Actors

- Player
  - สมัครให้ Player Profile ตัวเองเท่านั้น

- Coach
  - สมัครให้ linked players ที่ approved เท่านั้น
  - จ่ายรวมหลาย linked players ได้ใน payment order เดียว

- Admin
  - ตรวจสลิปและแก้ปัญหาด้วย manual decisions

## Core Transaction

Registration submit must be one transaction:

1. Resolve actor permission
2. Resolve selected player profiles
3. Lock selected divisions/counts where needed
4. Validate power level
5. Validate time slot conflicts
6. Validate age
7. Calculate available slots
8. Create confirmed-slot registrations or waiting-list registrations
9. Apply promo code
10. Create payment order if final amount > 0
11. Link registrations to payment order
12. Commit

## Validation

- Power level
  - block if player stronger than division max power level

- Time slot
  - full_day conflicts with all
  - morning conflicts with morning/full_day
  - afternoon conflicts with afternoon/full_day

- Age
  - calculate age on tournament start date
  - apply only if age_min/age_max exists

- Duplicate registration
  - unique `(division_id, player_profile_id)`

## Payment States

- pending_payment
  - order created and countdown running

- pending_verify
  - user uploaded slip

- confirmed
  - Admin approved or amount is zero

- expired
  - timeout

- cancelled
  - user/admin cancellation

## Slip Upload

- Storage bucket: slips
- jpg/png only
- max 10MB
- upload path should include tournament/order/account IDs
- upload updates:
  - payment_orders.slip_url
  - payment_orders.status = pending_verify
  - registrations.status = pending_verify

## Waiting List

- If division full, registration status = waiting_list
- No payment required while waiting
- Player/Coach sees position by `registered_at`
- When slot opens:
  - oldest waiting_list becomes pending_payment
  - payment order starts 24h
  - promo code remains eligible if originally applied and still valid by stored intent

## Cancel

- Player/Coach cancellation requires reason
- Allowed before tournament date
- Registration status becomes cancelled
- Quota returns immediately
- Refund is manual by Admin
- If slot opens, waiting-list promotion runs

## Timeout Cron

- Edge Function every 5 minutes
- Finds pending_payment orders where expires_at < now
- Marks order expired
- Marks linked registrations cancelled
- Returns quota
- Promotes waiting list

## Acceptance Tests

- Player registers own profile successfully
- Coach registers approved linked player successfully
- Coach cannot register unlinked player
- Full division sends player to waiting_list
- Promo free creates confirmed registration without payment order
- Slip upload changes order/registration to pending_verify
- Admin approve changes all linked registrations to confirmed
- Timeout expires order and promotes first waiting-list row
