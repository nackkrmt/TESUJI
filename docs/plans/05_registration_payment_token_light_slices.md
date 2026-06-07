# Sprint 5 Token-Light Slices

Use this file for Sprint 5 follow-up work. The goal is to keep every future turn small and avoid rereading broad plans.

## Global Rule For Every Slice

Read only:

1. `AGENTS.md`
2. `docs/AI_HANDOFF.md`
3. `docs/DECISIONS.md`
4. This file
5. The specific files named in the active slice

Do not open `master_plan.md` as a whole file. If something is missing, run `rg -n "<keyword>" master_plan.md` and read only the matching excerpt.

Work on one slice per turn unless the user explicitly asks to continue. Update `docs/AI_HANDOFF.md` after a meaningful slice lands.

## Slice S5.0 - Schema Foundation

User prompt:

```text
Run Sprint 5 slice S5.0 from docs/plans/05_registration_payment_token_light_slices.md.
Keep it token-light. Do not open master_plan.md except with rg excerpts.
```

Read extra:

- `supabase/migrations/202606010003_identity_mobile_signup.sql`
- `supabase/migrations/202606030001_coach_player_links.sql`
- `supabase/migrations/202606040001_tournament_admin.sql`
- `supabase/migrations/202606040002_refactor_tournament_creation.sql`

Build:

- New migration for:
  - `payment_orders`
  - `registrations`
  - `promo_code_usages`
  - `slips` Storage bucket
- RLS for owner, related coach, public-safe tournament registration reads, and future admin gate through `current_account_has_role('admin')`
- Indexes and constraints:
  - unique `(division_id, player_profile_id)` for non-cancelled active attempts if feasible
  - statuses constrained to planned values
  - fee/discount amounts non-negative
  - audit timestamps
- Grants consistent with existing migrations

Stop before UI.

Verify:

- Migration syntax by running the lightest available Supabase validation command.
- `npm.cmd run lint` only if TypeScript/source files changed.

## Slice S5.1 - Registration Transaction

User prompt:

```text
Run Sprint 5 slice S5.1 from docs/plans/05_registration_payment_token_light_slices.md.
Implement real registration transaction only; no UI yet.
```

Read extra:

- Migration from S5.0
- `src/lib/supabase/server.ts`
- `src/lib/supabase/admin.ts`
- `src/lib/auth/current-account.ts`
- `src/lib/coach/links.ts`
- `src/lib/tournaments/admin.ts` only for established service style

Build:

- Server-side registration service/RPC wrapper.
- Actor permission:
  - player can register own profile
  - active coach can register approved linked players only
- Division validation:
  - tournament status/open window
  - division active
  - duplicate registration
  - power level
  - age bounds
  - time-slot conflicts
- Quota behavior:
  - available slot creates payable/confirmed registration
  - full division creates `waiting_list`
- Zero-fee registration confirms immediately.
- Paid registration creates one `payment_order` and links registrations to it.

Stop before public pages.

Verify:

- Add focused local tests/scripts only if existing patterns support it.
- Run `npm.cmd run lint` and `npx.cmd tsc --noEmit`.

## Slice S5.2 - Promo Code Apply

User prompt:

```text
Run Sprint 5 slice S5.2 from docs/plans/05_registration_payment_token_light_slices.md.
Add promo validation into the registration transaction.
```

Read extra:

- Migration from S5.0
- Existing promo code actions in `src/lib/tournaments/admin.ts`
- `src/app/admin/tournaments/actions.ts`

Build:

- Validate promo code in the registration transaction.
- Enforce active/window/usage/division rules.
- Calculate free, percentage, and fixed discounts.
- Create `promo_code_usages` only when transaction succeeds.
- Increment `promo_codes.used_count` atomically.
- Free final amount creates confirmed registrations without payment order.

Verify:

- Failure path: invalid/expired/overused/wrong-division code does not create registrations or usage.
- Run `npm.cmd run lint` and `npx.cmd tsc --noEmit`.

## Slice S5.3 - Public Registration UI

User prompt:

```text
Run Sprint 5 slice S5.3 from docs/plans/05_registration_payment_token_light_slices.md.
Build the public tournament registration UI on real services only.
```

Read extra:

- `src/app/tournaments/page.tsx`
- `src/app/tournaments/[id]/page.tsx`
- `src/components/mobile/mobile-shell.tsx`
- Service from S5.1/S5.2

Build:

- Enable CTA on tournament detail only when registration is allowed.
- Add mobile-frame registration route for a tournament.
- Let player register own profile.
- Let active coach choose approved linked players.
- Show eligible divisions, validation errors, waiting-list outcome, promo input, and payment summary.
- Submit calls real registration service.

Verify:

- Browser check at mobile width.
- No success state without DB mutation.
- Run `npm.cmd run lint` and `npx.cmd tsc --noEmit`.

## Slice S5.4 - Payment QR And Slip Upload

User prompt:

```text
Run Sprint 5 slice S5.4 from docs/plans/05_registration_payment_token_light_slices.md.
Implement payment QR and slip upload for real payment orders.
```

Read extra:

- Payment tables/bucket migration
- `package.json`
- `src/lib/supabase/admin.ts`
- Existing upload route patterns under `src/app/admin/database`

Build:

- Add PromptPay QR dependency if needed.
- Payment detail route/page for pending orders.
- Generate QR from tournament PromptPay ID and exact amount.
- Upload jpg/png slip max 10MB to `slips` bucket.
- Update `payment_orders.status = pending_verify`, `slip_url`, `paid_at`.
- Update linked registrations to `pending_verify`.

Verify:

- Reject oversized or wrong MIME files before upload.
- Browser check payment page at mobile width.
- Run `npm.cmd run lint` and `npm.cmd run build` if route surface changed.

## Slice S5.5 - My Registrations And Cancel

User prompt:

```text
Run Sprint 5 slice S5.5 from docs/plans/05_registration_payment_token_light_slices.md.
Build My Registrations and user cancellation.
```

Read extra:

- Registration/payment service files
- `src/app/profile/page.tsx`
- `src/components/mobile/mobile-shell.tsx`

Build:

- `/my-registrations` mobile-frame list.
- Detail route with status, division, payment status, slip, countdown, waiting-list position.
- Player sees own registrations.
- Coach sees approved linked-player registrations where allowed.
- Cancel action requires reason and writes audit fields.
- Cancellation returns quota logically and triggers waiting-list promotion if implemented in this slice; otherwise document as next slice.

Verify:

- Cancel forbidden after event date.
- Non-owner/non-linked coach cannot cancel.
- Run `npm.cmd run lint` and `npx.cmd tsc --noEmit`.

## Slice S5.6 - Admin Payment Verify

User prompt:

```text
Run Sprint 5 slice S5.6 from docs/plans/05_registration_payment_token_light_slices.md.
Build minimal Admin payment verification.
```

Read extra:

- `src/app/admin/layout.tsx`
- `src/lib/admin/navigation.ts`
- `src/lib/tournaments/admin.ts` for dev-mode admin seam style
- Payment service files

Build:

- `/admin/payments` pending-verify queue.
- Show payment order, account/player rows, amount, slip link/image.
- Actions:
  - approve -> order confirmed, linked registrations confirmed
  - reject-send-new -> order pending_payment, linked registrations pending_payment
  - reject-cancel -> order cancelled, linked registrations cancelled, waiting-list promotion if available
- Keep Admin routes unprotected in dev mode, but use future-ready admin seam.

Verify:

- Run `npm.cmd run lint` and `npm.cmd run build`.
- Browser check admin page at desktop width.

## Slice S5.7 - Waiting List Promotion And Timeout

User prompt:

```text
Run Sprint 5 slice S5.7 from docs/plans/05_registration_payment_token_light_slices.md.
Implement waiting-list promotion and payment timeout lifecycle.
```

Read extra:

- Payment/registration migration and services
- Supabase function patterns if any exist

Build:

- Shared DB/service function to promote oldest waiting-list row by division.
- Expire pending payment orders after tournament timeout hours.
- Expired orders cancel linked registrations.
- Slot-opening events call promotion exactly once.
- If implementing Edge Function now, keep it small and document local serve command.

Verify:

- Full division -> waiting_list.
- Cancel/timeout -> oldest waiting row promoted.
- No double promotion on repeated calls.
- Run `npm.cmd run lint` and `npm.cmd run build`.

## Slice S5.8 - End-To-End Smoke And Handoff

User prompt:

```text
Run Sprint 5 slice S5.8 from docs/plans/05_registration_payment_token_light_slices.md.
Do final smoke verification and update handoff.
```

Read extra:

- `docs/AI_HANDOFF.md`
- Only touched files from earlier Sprint 5 slices

Verify:

- Create/open test tournament or use existing safe dev data.
- Player self registration.
- Coach linked-player registration.
- Promo free path.
- Paid path to pending_verify through slip upload.
- Admin approve path.
- Waiting-list path.
- Cancel path.
- Browser checks:
  - `/tournaments`
  - tournament detail/register route
  - `/my-registrations`
  - `/admin/payments`
- Run `npm.cmd run lint` and `npm.cmd run build`.

Update:

- `docs/AI_HANDOFF.md` current state
- migrations applied/pushed status
- verification commands and smoke result
- recommended next task
