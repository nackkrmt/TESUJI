# Sprint 6 Token-Light Slices

Use this file for Sprint 6 Admin Operations and Notifications work. The goal is to keep every turn small, testable, and tied to the real Supabase-backed app.

The source subsystem plan is `docs/plans/06_admin_ops_notifications.md`. This file is the execution split.

## Global Rule For Every Slice

Read only:

1. `AGENTS.md`
2. `docs/AI_HANDOFF.md`
3. `docs/DECISIONS.md`
4. `docs/plans/06_admin_ops_notifications.md`
5. This file
6. The specific files named in the active slice

Do not open `master_plan.md` as a whole file. If something is missing, run `rg -n "<keyword>" master_plan.md` and read only the matching excerpt.

Work on one slice per turn unless the user explicitly asks to continue. Update `docs/AI_HANDOFF.md` after a meaningful slice lands.

## Sprint 6 Baseline

- Payment verification already exists at `/admin/payments` from Sprint 5.6/S5.7.
- Coach approval already exists at `/admin/roles`.
- Referee invite creation and redemption already exist.
- Sprint 6 should extend and consolidate Admin operations, not rebuild working payment/role flows.
- Admin routes remain reachable in dev mode. Add only future-ready Admin auth seams that later check `account_roles.admin = active`.
- Do not create a separate Admin login/auth system.
- Do not add mock success paths. Every button that remains visible must use real service/RPC behavior.
- Public/user-facing notification surfaces must stay mobile-frame only; Admin surfaces can be desktop/tablet.

## Slice S6.1 - Pending Rank Approval Core

User prompt:

```text
Run Sprint 6 slice S6.1 from docs/plans/06_admin_ops_notifications_token_light_slices.md.
Build pending rank approval schema/RPC/service behavior only; no UI yet.
```

Read extra:

- `supabase/migrations/202606010003_identity_mobile_signup.sql`
- `supabase/migrations/202606010004_lock_identity_direct_updates.sql`
- `supabase/migrations/202606010007_sync_profiles_after_go_db_import.sql`
- `src/lib/go/ranks.ts`
- `src/lib/auth/rank-options.ts`
- `src/lib/supabase/admin.ts`
- `src/lib/admin/payments.ts` only for established service/RPC wrapper style

Build:

- Migration for pending-rank review support if audit columns or RPCs are missing.
- Service-role-only RPC for approving a pending profile rank.
- Support both approve-as-is and edit-rank-then-approve.
- Recalculate `power_level` from the final rank with the same rules as `rankToPowerLevel`.
- Set `player_profiles.rank_status = 'verified'`.
- Record rank review audit fields if added in this slice, such as reviewer, reviewed time, original rank, final rank, and optional note.
- Do not update identity fields, document hashes, PDPA fields, or Go DB match IDs unless explicitly required by the final rank path.
- Keep a future Admin actor seam: when `p_admin_account_id` is non-null, validate `account_roles.admin = active`; dev-mode server actions may still pass `null`.
- Add `src/lib/admin/rank-approvals.ts` or equivalent service wrapper.

Stop before Admin UI.

Verify:

- `npx.cmd supabase db push --linked --yes`
- `npx.cmd supabase db lint --linked --schema public,storage --level error --fail-on error`
- Live DB smoke: approve-as-is, edit-rank-then-approve, invalid rank rejected, non-pending profile rejected.
- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`

## Slice S6.2 - Pending Rank Approval UI

User prompt:

```text
Run Sprint 6 slice S6.2 from docs/plans/06_admin_ops_notifications_token_light_slices.md.
Build the Admin pending rank approval UI on the real S6.1 service only.
```

Read extra:

- Files changed in S6.1
- `src/app/admin/payments/page.tsx`
- `src/app/admin/payments/actions.ts`
- `src/app/admin/roles/page.tsx`
- `src/app/admin/roles/actions.ts`
- `src/lib/admin/navigation.ts`
- `src/components/admin/admin-sidebar.tsx`

Build:

- Admin route for pending rank approvals, preferably `/admin/ranks` unless local naming suggests a better fit.
- Add Admin navigation entry.
- Show name, rank, power level, institute, created date, and useful account/profile context.
- Add approve-as-is action.
- Add edit-rank-then-approve action using the existing rank option set.
- Empty state for no pending ranks.
- Clear server-action feedback for success/failure.
- Keep route-level Admin protection deferred in dev mode.

Verify:

- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npm.cmd run build`
- Browser smoke at desktop width: queue renders, approve action works, edited-rank approval works, no console/runtime errors.

## Slice S6.3 - Admin Ops Consolidation

User prompt:

```text
Run Sprint 6 slice S6.3 from docs/plans/06_admin_ops_notifications_token_light_slices.md.
Consolidate existing Admin operation queues without rebuilding working payment or coach flows.
```

Read extra:

- `src/lib/admin/payments.ts`
- `src/lib/admin/role-management.ts`
- `src/lib/auth/referee-invites.ts`
- `src/app/admin/page.tsx`
- `src/app/admin/payments/page.tsx`
- `src/app/admin/roles/page.tsx`
- `src/app/admin/roles/actions.ts`
- `src/lib/admin/navigation.ts`
- `supabase/migrations/202606020001_role_management.sql`
- `supabase/migrations/202606080006_admin_payment_verification.sql`
- `supabase/migrations/202606090001_waiting_list_promotion_timeout.sql`

Build:

- Keep payment verification behavior unchanged unless a real bug is found.
- Keep Coach approval behavior real and backed by `review_coach_request`.
- Add or improve Admin dashboard queue counts for payment verification, pending ranks, Coach requests, and referee invites.
- Add referee invite status visibility for active/redeemed/expired where schema supports it.
- Add referee invite revoke behavior if schema/RPC support is missing, with raw codes still shown once only and stored as hashes.
- Keep all Admin mutations behind the existing dev-mode Admin seam pattern.

Verify:

- Referee invite creation still shows raw code only once.
- Revoked invite cannot be redeemed.
- Existing Coach approve/reject still grants or rejects active Coach role correctly.
- Payment queue still lists `pending_verify` orders and the existing approve/reject actions still work.
- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npm.cmd run build`

## Slice S6.4 - Registration Lists And Export Core

User prompt:

```text
Run Sprint 6 slice S6.4 from docs/plans/06_admin_ops_notifications_token_light_slices.md.
Build registration list and export services only; no Admin list UI yet.
```

Read extra:

- `supabase/migrations/202606040001_tournament_admin.sql`
- `supabase/migrations/202606070001_registration_payment_foundation.sql`
- `supabase/migrations/202606080001_registration_transaction_rpc.sql`
- `src/lib/tournaments/admin.ts`
- `src/lib/admin/payments.ts`
- `src/lib/registrations/my-registrations.ts`
- `src/lib/supabase/admin.ts`

Build:

- Admin service for registration lists by tournament and division.
- Include order number, player TH/EN name, rank, power level, institute, registration status, registered time, source, and registered-by account/role/name where available.
- Exclude `national_id_hash`, document hashes, private slip URLs unless explicitly needed, and other sensitive fields not required by tournament staff.
- Export route/action/service for CSV at minimum; Excel is optional only if it stays small and uses existing dependencies cleanly.
- Keep data real and Supabase-backed.
- Keep future Admin auth seam but do not add route-level protection.

Stop before Admin list UI.

Verify:

- Export contains real DB rows for a smoke tournament/division.
- Export excludes sensitive fields.
- Status/source/registered-by values are correct for self and Coach registrations.
- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`

## Slice S6.5 - Registration Lists And Export UI

User prompt:

```text
Run Sprint 6 slice S6.5 from docs/plans/06_admin_ops_notifications_token_light_slices.md.
Build the Admin registration list and export UI on the real S6.4 service.
```

Read extra:

- Files changed in S6.4
- `src/app/admin/tournaments/page.tsx`
- `src/app/admin/tournaments/[id]/page.tsx`
- `src/app/admin/payments/page.tsx`
- `src/lib/admin/navigation.ts`
- `src/components/admin/admin-sidebar.tsx`

Build:

- Admin route for registration lists, preferably `/admin/registrations`.
- Tournament selector or tournament-first navigation.
- Division list/table with status filters.
- Download action for the S6.4 export.
- Empty states for no tournaments, no divisions, and no registrations.
- Keep Admin UI desktop/tablet friendly.

Verify:

- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npm.cmd run build`
- Browser smoke: list renders real rows, filters work if added, export downloads and opens as text/spreadsheet content, no sensitive columns.

## Slice S6.6 - Admin User Management Read-Only

User prompt:

```text
Run Sprint 6 slice S6.6 from docs/plans/06_admin_ops_notifications_token_light_slices.md.
Build read-only Admin user management with real account/profile/role data.
```

Read extra:

- `src/lib/auth/current-account.ts`
- `src/lib/admin/role-management.ts`
- `src/lib/coach/links.ts`
- `supabase/migrations/202606010003_identity_mobile_signup.sql`
- `supabase/migrations/202606020001_role_management.sql`
- `supabase/migrations/202606030001_coach_player_links.sql`
- Admin pages/routes from previous Sprint 6 slices

Build:

- Admin service for account list/search with roles and role statuses.
- Show player profile summary when it exists.
- Show Coach Link counts/status summary where useful.
- Do not display `national_id_hash` or document hashes.
- No destructive user actions in this slice.
- Admin UI route, preferably `/admin/users`.
- Keep route-level Admin protection deferred in dev mode.

Verify:

- User list displays real accounts and roles.
- No sensitive hash fields appear in rendered UI or exported/query DTOs.
- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npm.cmd run build`

## Slice S6.7 - Manual Notifications Core

User prompt:

```text
Run Sprint 6 slice S6.7 from docs/plans/06_admin_ops_notifications_token_light_slices.md.
Build manual notification schema/RPC/service behavior only; no UI yet.
```

Read extra:

- `supabase/migrations/202606010003_identity_mobile_signup.sql`
- `supabase/migrations/202606070001_registration_payment_foundation.sql`
- `src/lib/supabase/admin.ts`
- `src/lib/auth/current-account.ts`
- Registration list service from S6.4 if present

Build:

- Notification tables for manual Admin messages and per-recipient delivery/read state.
- Recipient modes:
  - all accounts
  - accounts with registrations in a selected tournament
  - selected account IDs
- Optional link field.
- Service-role-only RPC/service to create a manual notification and recipient rows in one transaction.
- Service for current user notification list, unread count, and mark-read.
- No automatic notifications from system events.
- Keep future Admin actor seam; dev-mode Admin actions may pass `null`.

Stop before UI.

Verify:

- Manual send creates exactly N recipient rows for each audience type.
- Duplicate recipients are deduped.
- Mark-read changes only the current user's recipient row.
- RLS or service boundaries prevent users from reading other users' recipient state.
- `npx.cmd supabase db push --linked --yes`
- `npx.cmd supabase db lint --linked --schema public,storage --level error --fail-on error`
- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`

## Slice S6.8 - Manual Notifications UI

User prompt:

```text
Run Sprint 6 slice S6.8 from docs/plans/06_admin_ops_notifications_token_light_slices.md.
Build Admin manual notification UI and mobile user notification surfaces on the real S6.7 service.
```

Read extra:

- Files changed in S6.7
- `src/app/page.tsx`
- `src/app/profile/page.tsx`
- `src/components/mobile/*`
- `src/app/admin/page.tsx`
- `src/lib/admin/navigation.ts`

Build:

- Admin route for manual notifications, preferably `/admin/notifications`.
- Compose form with recipient mode, optional tournament selector, optional selected account IDs, title/body, and optional link.
- Preview or confirmation showing recipient count before/after send if feasible.
- User-facing mobile-frame notification list.
- Bell badge/unread count entry point in the authenticated mobile shell/home/profile area that fits existing navigation patterns.
- Mark-read behavior.
- No automatic notification creation from other workflows.

Verify:

- Admin sends to all accounts.
- Admin sends to tournament registrants.
- Admin sends to selected accounts.
- User sees unread badge/list and can mark read.
- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npm.cmd run build`
- Browser smoke at mobile width for user surfaces and desktop width for Admin compose.

## Slice S6.9 - Sprint 6 End-To-End Smoke And Handoff

User prompt:

```text
Run Sprint 6 slice S6.9 from docs/plans/06_admin_ops_notifications_token_light_slices.md.
Do final Sprint 6 smoke verification, cleanup, and handoff updates.
```

Read extra:

- Files changed by Sprint 6 slices
- `docs/AI_HANDOFF.md`
- `docs/DECISIONS.md`
- `docs/plans/06_admin_ops_notifications.md`

Build:

- No new feature work unless needed to fix smoke failures.
- Run a real DB smoke path covering:
  - pending rank approve-as-is
  - pending rank edit-and-approve
  - Coach approval still works
  - referee invite create/revoke/redeem boundaries
  - registration list export excludes sensitive fields
  - manual notification send/read behavior
  - payment queue still confirms/rejects real pending verification orders
- Browser smoke:
  - `/admin/payments`
  - pending rank Admin route
  - `/admin/roles`
  - registration list Admin route
  - `/admin/users`
  - notification Admin route
  - user-facing notification route/surface at mobile width
- Delete smoke data and verify cleanup.
- Update `docs/AI_HANDOFF.md` with final Sprint 6 state, migrations, routes, verification, blockers, and recommended next task.

Verify:

- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npm.cmd run build`
- Supabase lint passes for public/storage.
- No smoke data remains.
