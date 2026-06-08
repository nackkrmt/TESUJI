# TESUJI AI Handoff

Last updated: 2026-06-09

This is the short, current-state handoff for agents switching between Codex and Claude.

## Collaboration Protocol

- Claude and Codex will both work on this project, switching back and forth over time.
- Before starting work, read `AGENTS.md`, this file, and `docs/DECISIONS.md`.
- After meaningful work, update this file if current state, blockers, routes, migrations, verification status, or the next task changed.
- Keep decisions that should not be re-litigated in `docs/DECISIONS.md`.
- Do not put real secrets in markdown files, git commits, or chat summaries.
- The project rule is no mockups for core behavior: each step should work against the real app/database before moving on.
- Token-light rule: do not open `master_plan.md` as a whole file. Use `docs/AI_HANDOFF.md`, `docs/DECISIONS.md`, and the relevant `docs/plans/*.md` first; use `rg -n` to read only small `master_plan.md` excerpts when truly needed.

## Current State

- Next.js app exists at `D:/Programming/TESUJI`.
- Supabase project is linked/authenticated through CLI/MCP.
- Real Supabase project:
  - ref: `jiweobnsxpmgexipqzbx`
  - URL: `https://jiweobnsxpmgexipqzbx.supabase.co`
  - publishable key is in `.env.local`
- Go player database import is implemented and has been pushed/imported to Supabase.
- Current Supabase public tables:
  - `go_player_database`
  - `accounts`
  - `account_roles`
  - `role_requests`
  - `player_profiles`
  - `coach_player_links`
  - `school_database`
  - `database_import_runs`
  - `tournaments`
  - `divisions`
  - `promo_codes`
  - `payment_orders`
  - `registrations`
  - `promo_code_usages`
- Current migrations:
  - `202606010001_go_player_database.sql`
  - `202606010002_replace_go_player_database_source.sql`
  - `202606010003_identity_mobile_signup.sql`
  - `202606010004_lock_identity_direct_updates.sql`
  - `202606010005_pdpa_consent.sql`
  - `202606010006_school_database.sql`
  - `202606010007_sync_profiles_after_go_db_import.sql`
  - `202606020001_role_management.sql`
  - `202606030001_coach_player_links.sql`
  - `202606040001_tournament_admin.sql`
  - `202606040002_refactor_tournament_creation.sql`
  - `202606060001_database_import_runs.sql`
  - `202606060002_fix_school_replace_delete_where.sql`
  - `202606070001_registration_payment_foundation.sql`
  - `202606080001_registration_transaction_rpc.sql`
  - `202606080002_registration_promo_transaction.sql`
  - `202606080003_registration_promo_transaction_jsonb_plan.sql`
  - `202606080004_payment_slip_submission.sql`
  - `202606080005_registration_cancellation.sql`
  - `202606080006_admin_payment_verification.sql`
  - `202606090001_waiting_list_promotion_timeout.sql`
- Supabase MCP is configured for dev DB access via project-scoped `.mcp.json` (OAuth, no secret key). Run `/mcp` -> `supabase` -> Authenticate after a fresh session.

## Implemented Features

- Admin dashboard dark UI exists at `/admin`.
- Admin Database page exists at `/admin/database`.
- Admin Database upload supports DAN/KYU/AWARD Excel files and imports parsed rows directly from the uploaded file bytes to Supabase.
- Go DB upload now re-syncs already verified Player Profiles after each import. Verified profiles are rematched by normalized Thai first/last name against the current `go_player_database`, with DAN priority over KYU/AWARD and then highest `power_level`; matching rows update `rank`, `power_level`, `rating`, and `matched_go_player_id`.
- Admin Database upload also supports `SCHOOL_Database.xlsx` with columns `seq`, `name`, `keywords`; it imports directly from the uploaded file bytes to `school_database`.
- Go and school database production paths are upload-only and must not depend on a fixed local folder. Latest upload status lives in `database_import_runs`, not `.tesuji-upload-status.json`.
- `go_player_database` currently has 3,762 rows:
  - DAN: 1,142
  - KYU: 1,635
  - AWARD: 985
- `school_database` currently has 3 rows from the latest Admin upload.
- Rank search API exists at `POST /api/rank/search`.
- School search API exists at `GET /api/schools/search?q=...`.
- Admin role-management page exists at `/admin/roles`:
  - Shows real Coach role requests from `role_requests`.
  - Approve/reject calls `review_coach_request`.
  - Creates one-time Referee invite codes stored only as salted hashes.
- Referee invite redeem page exists at `/referee/invite` and calls `redeem_referee_invite`.
- Migration `202606020001_role_management.sql` has been pushed to the real Supabase project.
- Coach/Profile link flow exists at `/profile`:
  - `coach_player_links` stores Coach-to-Player relationships.
  - Active Coach can search existing Player accounts by Player Profile ID, exact email, or name.
  - Active Coach can send a pending link request.
  - Player can approve/reject incoming Coach Link requests.
  - Coach sees approved linked players separately from pending/rejected requests.
- Sprint 4 Tournament CRUD foundation exists:
  - Migration `202606040001_tournament_admin.sql` creates `tournaments`, `divisions`, and `promo_codes`.
  - Migration `202606040002_refactor_tournament_creation.sql` refactors tournament creation fields (`title`, `event_date`, `google_maps_url`), creates the public `tournament-banners` Storage bucket, and keeps division power/age ranges nullable for Open.
  - Admin tournament routes use real Supabase data via trusted server actions/service layer.
  - Admin can create/update a draft tournament and multiple divisions in one form, including banner upload to Supabase Storage.
  - Admin tournament event date and registration open/close date portions use the shared `WheelDatePicker` pattern from registration; registration times use hour/minute dropdowns.
  - Division power/age ranges are dropdowns with blank/Open saved as NULL.
  - Admin can change status, delete draft tournaments, and add/edit promo codes.
  - Opening a tournament requires at least one active division.
  - Public tournament list/detail read published non-draft tournament data from Supabase and display uploaded banners when present.
- Public/auth UX is mobile-frame only:
  - `/login`
  - `/register`
  - `/forgot-password`
  - `/reset-password`
  - `/`
- `/` redirects unauthenticated users to `/login`.
- Register wizard currently collects full Player Profile first, searches rank, lets user choose Player/Coach, then asks for account credentials.
- Register Step 1 (Profile) UI details:
  - Title TH is a dropdown (นาย/นาง/นางสาว/เด็กชาย/เด็กหญิง/อื่น ๆ); Title EN auto-syncs from TH (นาย=Mr., นาง=Mrs., นางสาว=Miss, เด็กชาย=Master, เด็กหญิง=Miss). "อื่น ๆ" lets the user type both TH + EN — the custom TH/อังกฤษ inputs now sit in a grouped inset with helper text, example placeholders, and auto-focus on the TH field.
  - Required Profile fields show a red `*` indicator (2026-06-01); the shared `TextField` helper supports `required` / `placeholder` / `focusOnMount` props.
  - Middle name is behind a toggle switch (`มีชื่อกลาง`); hidden+cleared when off.
  - Date of birth uses a tap-to-open 3-wheel bottom sheet (day/month/year CE); stored as `yyyy-mm-dd`.
  - Nationality is a searchable dropdown (`src/lib/auth/profile-options.ts` holds the list; replace with the official list later).
  - Identity document type is a segmented toggle (national ID / passport).
  - PDPA consent checkbox is required to proceed; stored in DB.
  - New shared components: `src/components/mobile/wheel-date-picker.tsx`, `src/components/mobile/searchable-select.tsx`.
  - Institute now uses an autocomplete field backed by the real `school_database`; users can still type a custom value if the school is missing.

## Signup Verification

Real atomic signup is no longer blocked locally. `.env.local` contains a real server-only Supabase key, and `POST /api/auth/signup` was verified on 2026-06-02 (Asia/Bangkok) against the real Supabase project.

Verified cases:

- Player signup with self-declared `15 Kyu` creates `auth.users`, `accounts`, active `account_roles.player`, `player_profiles.rank_status = pending`, and PDPA consent.
- Coach signup with self-declared `1 Dan` creates the same Player account/profile plus `role_requests.coach = pending`.
- Matched signup using Go DB player `โฆษา อารียา` creates `player_profiles.rank = 6 Dan`, `rank_status = verified`, `rating = 1600`, and `matched_go_player_id = 51741dcc-ff41-4371-abf8-389f4a810c92`.

Test emails were `codex-e2e-...@example.com`.

## Key Routes And Behavior

- `POST /api/auth/login`
  - Supabase email/password login.
  - `remember = true` sets persistent auth cookies.
  - `remember = false` uses session cookies.
- `POST /api/auth/signup`
  - Creates Supabase Auth user only at final confirm.
  - Calls `complete_account_signup` RPC to insert account/profile/roles.
  - Deletes Auth user if DB completion fails.
  - Coach signup creates active `player` role and pending `coach` role request.
- `POST /api/auth/forgot-password`
  - Uses Supabase reset password email.
- `GET /auth/callback`
  - Exchanges Supabase recovery code and redirects.
- `POST /api/auth/update-password`
  - Updates password for the active recovery/login session.
- `/admin/roles`
  - Server page listing Coach requests and recent Referee invites from Supabase.
  - Server actions create invites and approve/reject Coach requests.
  - Dev mode decision: do not add route-level Admin access protection yet; Admin routes stay reachable while functions are built.
  - Future Admin protection must use the same Supabase Auth/account flow as normal users and gate by `account_roles.admin = active`; do not create separate Admin auth.
- `/admin/tournaments`
  - Server page listing real tournaments from Supabase.
  - Dev mode decision applies here too: do not add route-level Admin access protection yet.
- `/admin/tournaments/new`
  - Creates a draft tournament plus inline divisions through `createTournamentAction`.
  - Accepts banner uploads through the `tournament-banners` public Storage bucket and stores the resulting public URL in `banner_url`.
- `/admin/tournaments/[id]`
  - Edits tournament details and divisions together in `TournamentForm`; status and promo codes remain separate action forms.
  - Server actions return typed `{ status, message, id? }` results for form UX.
  - Future Admin protection seam lives in `ensureAdminMutationAllowedForDevMode()` and must later check `account_roles.admin = active`.
- `/admin/payments`
  - Server page listing real `pending_verify` payment orders from Supabase.
  - Shows payer account, tournament, amount, linked registrations, signed private slip preview/link, and review controls.
  - Actions call service-role RPCs through the same dev-mode Admin seam: approve confirms the payment order and linked registrations; reject-send-new returns both to `pending_payment`; reject-cancel cancels both and runs waiting-list promotion in the same transaction.
  - Includes a real Run timeout sweep action that calls `expire_pending_payment_orders` to expire overdue `pending_payment` orders, expire linked registrations, and promote the next waiting-list row.
- `/referee/invite`
  - Logged-in users can redeem a one-time Referee invite code.
- `/tournaments`
  - Mobile-frame public list of non-draft tournaments from Supabase.
- `/tournaments/[id]`
  - Mobile-frame public detail page with real tournament details and divisions.
  - Registration/payment CTA is intentionally disabled until Sprint 5.
- `/payments/[id]`
  - Mobile-frame payment detail page for real pending payment orders.
  - Shows amount summary, PromptPay QR generated from the payment order/tournament PromptPay ID and exact `amount_due`, linked registrations, deadline text, and submitted slip link after upload.
- `POST /payments/[id]/slip`
  - Authenticated multipart slip upload route.
  - Rejects non-JPG/PNG and files over 10MB before Supabase Storage upload.
  - Uploads to private `slips` bucket, then calls `submit_payment_slip` RPC to move the payment order and linked registrations to `pending_verify`.
- `/my-registrations`
  - Mobile-frame list of real registrations for the logged-in Player account plus approved linked players when the user is an active Coach.
  - Shows status, tournament/division/player, payment summary, waiting-list position, and history.
- `/my-registrations/[id]`
  - Mobile-frame registration detail route with real payment status, slip link, payment countdown, cancellation audit, and a cancel form when the registration is eligible.
  - User cancellation requires a reason. It calls `cancel_registration` and writes `cancelled_by`, `cancelled_at`, and `cancellation_reason`.
  - Cancellation is forbidden on/after event date and while payment is `pending_verify`. Slot-opening cancellations call waiting-list promotion in the same DB transaction.
- `/profile`
  - Logged-in users see Player Profile, roles, incoming Coach Link requests, and Coach tools.
  - Active Coach users can search existing Player accounts and request a link.
  - Player owners approve/reject Coach Link requests.
- Authenticated Home/Digital ID functional skeleton exists at `/`:
  - Uses the real logged-in account, Player Profile, roles, and Coach Link data.
  - Generates a real QR code from a non-secret Digital ID payload using `qrcode`.
  - QR expands in a full-screen overlay.
  - Quick Access points only at existing real routes.
  - Active Coach users see approved linked players from `coach_player_links`.
  - Tournament Snapshot links to the real `/tournaments` route; registration/payment remains an explicit Sprint 5 empty state.

## Supabase Notes

- `complete_account_signup` is a service-role-only RPC. As of `202606010005`, it takes a 24th arg `p_pdpa_consent boolean` (raises if false) and writes `player_profiles.pdpa_consent` + `pdpa_consent_at`.
- `player_profiles` now has `pdpa_consent boolean not null default false` and `pdpa_consent_at timestamptz` (PDPA consent captured at signup).
- `accounts` and `player_profiles` direct client updates are revoked by `202606010004_lock_identity_direct_updates.sql`.
- Future profile edits should go through trusted server actions/routes.
- `current_account_has_role` checks active roles.
- Rank search RPC now returns evidence fields such as `year_promoted`, `rating`, `category`, `rank_award`, `event_name`, and `event_date`.
- Tournament writes currently go through service-role server actions in dev mode with no route-level Admin guard by design.
- Tournament public read RLS exposes non-draft tournaments/divisions; promo code reads are future-gated to active Admin accounts and currently managed through service-role admin actions.
- Tournament banners use Supabase Storage bucket `tournament-banners`, configured public with JPG/PNG/WebP and a 2MB file limit in migration `202606040002_refactor_tournament_creation.sql`.
- Sprint 5 S5.0 migration `202606070001_registration_payment_foundation.sql` creates `payment_orders`, `registrations`, `promo_code_usages`, and a private `slips` Storage bucket. It keeps registration/payment rows readable only to the owner, approved related Coach, or future Admin gate, and exposes public tournament registration availability only through aggregate view `division_registration_summary`.
- Sprint 5 S5.1 migration `202606080001_registration_transaction_rpc.sql` creates service-role-only RPC `create_registration_transaction(p_actor_account_id, p_player_profile_id, p_division_ids, p_payment_expires_at)`. It validates actor permission, open tournament window, active divisions, duplicate registration, power/age bounds, time-slot conflicts, quota/waiting-list placement, zero-fee confirmation, and one paid `payment_order` for payable registrations.
- Sprint 5 S5.2 migrations `202606080002_registration_promo_transaction.sql` and `202606080003_registration_promo_transaction_jsonb_plan.sql` extend the RPC to `create_registration_transaction(p_actor_account_id, p_player_profile_id, p_division_ids, p_payment_expires_at, p_promo_code)`. The final active implementation is `202606080003` (JSONB plan, no temp table) and validates promo active/window/usage/division rules, calculates free/percentage/fixed discounts, writes `promo_code_usages`, increments `promo_codes.used_count` atomically, and confirms zero-amount registrations without payment orders.
- Sprint 5 S5.3 adds the public mobile registration UI at `/tournaments/[id]/register`. Tournament detail CTA is enabled only when `getIsRegistrationOpen()` passes status/window/active-division checks. The page reads real account/profile/coach-linked-player/division-summary data through `src/lib/registrations/options.ts`, submits through a server action, and ultimately uses `create_registration_transaction`; there is no mock success path.
- Sprint 5 S5.4 adds `submit_payment_slip(p_actor_account_id, p_payment_order_id, p_slip_url, p_slip_storage_path, p_paid_at)` as a service-role-only RPC. It locks the payment order, validates actor access, requires `pending_payment`, rejects expired/zero-amount orders, updates `payment_orders` to `pending_verify`, and updates linked `pending_payment` registrations to `pending_verify` in the same DB transaction.
- Sprint 5 S5.5 adds `cancel_registration(p_actor_account_id, p_registration_id, p_cancellation_reason)` as a service-role-only RPC. It locks the registration, validates owner/registered-by/approved-Coach/Admin access, rejects inactive registrations, rejects `pending_verify`, rejects on/after event date in Bangkok, writes cancellation audit fields, and cancels a single-registration `pending_payment` payment order when no active linked registrations remain. Multi-registration pending-payment orders have their fee/discount totals reduced for the cancelled registration. S5.7 replaces this RPC so slot-opening cancellations run waiting-list promotion in the same transaction.
- Sprint 5 S5.6 adds service-role-only RPCs `approve_payment_order(p_payment_order_id, p_admin_account_id)`, `reject_payment_order_send_new(p_payment_order_id, p_rejection_reason, p_admin_account_id)`, and `reject_payment_order_cancel(p_payment_order_id, p_rejection_reason, p_admin_account_id)`. All lock the payment order, require `pending_verify`, update linked registrations in the same transaction, and optionally validate a future active Admin actor when `p_admin_account_id` is provided. Dev-mode Admin actions currently pass `null` through `ensureAdminMutationAllowedForDevMode()`.
- Sprint 5 S5.7 adds `expired_at` audit columns to `payment_orders` and `registrations`, `compact_waiting_list_positions(p_division_id)`, `promote_waiting_list_for_division(p_division_id, p_payment_expires_at)`, and `expire_pending_payment_orders(p_limit, p_payment_expires_at)`. Promotion is FIFO by `waiting_list_position`, then `created_at`, then `id`; paid promotions create a new `pending_payment` order with 24h default expiry, while free promotions become `confirmed` without an order. Replaced `cancel_registration` and `reject_payment_order_cancel` call promotion exactly once per opened division.

## Dev Tooling

- `python3` on this Windows machine is a non-functional Microsoft Store stub — use `python` (3.14.x) for all Python calls.
- UI/UX design helper skill (Claude Code) installed project-local at `.claude/skills/ui-ux-pro-max/` on 2026-06-01. Invoke from repo root: `python .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system`. Claude-only skill folder; Codex can still run the script directly.
- Auth UI a11y/UX pass (2026-06-01, guided by the ui-ux-pro-max review): shared input/button classes in `src/components/mobile/mobile-shell.tsx` now carry visible `focus-visible` rings + `cursor-pointer`; `globals.css` adds a global cursor-pointer base rule (Tailwind v4 drops the default button pointer) + a `prefers-reduced-motion` guard; root layout loads **Noto Sans Thai** for Thai glyphs (Geist is latin-only, so Thai text was falling back). `/login` is now a real `<form>` (Enter submits) with show/hide password, a loading spinner, and `role="alert"` errors; the register wizard got the same focus/cursor/loading/password-toggle + `role="alert"` treatment **without** changing its 4-step flow, fields, or components. `/forgot-password` and `/reset-password` now follow the same pattern too (real `<form>` + Enter-submit, `role`-tagged messages — `status` for the forgot-password success vs `alert` for errors — loading spinner, and show/hide toggles on both reset-password fields). Reuse the shared classes for any new auth inputs/buttons.
- School DB upload/autocomplete pass (2026-06-01): migration `202606010006_school_database.sql` creates `school_database`, `replace_school_database(jsonb)`, and `search_school_database(text, integer)`. Admin upload route is `/admin/database/school/upload`; register uses `src/components/auth/institute-search-field.tsx`.
- Upload-only DB pass (2026-06-06): migration `202606060001_database_import_runs.sql` creates `database_import_runs`. `/admin/database` reads Supabase row counts/samples and latest upload audit from Supabase; upload routes parse uploaded `.xlsx` bytes directly and no longer save, back up, or inspect files from a local database directory. Migration `202606060002_fix_school_replace_delete_where.sql` keeps `replace_school_database(jsonb)` compatible with Supabase safe-update rules by using an explicit `where true` delete.
- Do NOT run `npm run build` while a `next dev` server is live on the same folder — both write `.next/` and the running dev server then serves mismatched SSR/client bundles → hydration errors (e.g. on `/register`). Stop dev first, or to recover: kill the dev server, delete `.next`, restart dev (no code change needed).

## Code Review Fix Verification

Verified on 2026-06-07 (Asia/Bangkok):

- Home pending Coach state now reads pending `role_requests`.
- Public API routes use the cookie-aware Supabase server client instead of the deleted `src/lib/supabase/client.ts` singleton.
- Coach Link dashboard reuses one admin client per request.
- Excel uploads reject files over 10MB before parsing.
- Forgot-password redirects can fall back to `NEXT_PUBLIC_SITE_URL`.
- Tournament date-only mutations use Bangkok midnight.
- Digital ID QR `issuedAt` is rounded to the hour.
- Verified profile sync updates in batches of 10.
- Home Quick Access includes `/tournaments`.
- `npm.cmd run lint`, `npx.cmd tsc --noEmit`, and `npm.cmd run build` passed.

## Antigravity Accidental Revert Repair

Verified on 2026-06-07 (Asia/Bangkok):

- `src/components/admin/database-card.tsx` was restored to the upload-only Admin Database contract after an external `git checkout --` reverted it to the old local-file UI.
- Admin Database cards no longer reference `src/lib/go/upload-status.ts`, `filePath`, local modified time, or local file size.
- Go and SCHOOL upload form copy now says uploaded Excel files are imported directly into Supabase, not used to replace a local workbook.
- `npm.cmd run lint` and `npx.cmd tsc --noEmit` passed.
- Browser smoke checks for `/admin/database`, `/admin/tournaments`, and `/tournaments` showed no visible runtime error text or console errors. `/admin/database` shows Supabase status/upload-only text and no local file workflow markers.

## Environment

See `.env.example`.

Local `.env.local` currently has:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` and/or `SUPABASE_SERVICE_ROLE_KEY`
- `IDENTITY_HASH_SALT`

Do not copy real secret values into docs, commits, or chat.

## Verification Commands

```bash
npm run lint
npm run build
```

Run dev server:

```bash
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Useful URL checks:

- `http://127.0.0.1:3000/login`
- `http://127.0.0.1:3000/register`
- `http://127.0.0.1:3000/admin/database`
- `http://127.0.0.1:3000/admin/tournaments`
- `http://127.0.0.1:3000/admin/payments`
- `http://127.0.0.1:3000/tournaments`

## Role Management Verification

Verified on 2026-06-03 (Asia/Bangkok):

- `supabase db push` applied:
  - `202606010007_sync_profiles_after_go_db_import.sql`
  - `202606020001_role_management.sql`
- `referee_invite_codes` exists on remote Supabase.
- `create_referee_invite` + `redeem_referee_invite` were tested with a `codex-e2e-player-self-...@example.com` account and granted active `account_roles.referee`.
- `review_coach_request` was tested with a `codex-e2e-coach-self-...@example.com` account and granted active `account_roles.coach`.
- `/admin/roles` returns 200 with no role-management warning after migration.

## Coach Link Verification

Verified on 2026-06-03 (Asia/Bangkok):

- `supabase db push` applied `202606030001_coach_player_links.sql`.
- Active Coach `codex-e2e-coach-self-...@example.com` can search existing Player `codex-e2e-player-matched-...@example.com`.
- `request_coach_player_link` creates/reuses a pending link.
- `respond_coach_player_link` approves the pending link as the Player owner.
- Approved links are visible when querying `coach_player_links` by Coach with `status = approved`.
- Failure checks passed:
  - Non-Coach account cannot request a Coach Link.
  - Coach cannot link to their own Player Profile.
- `/profile` returns 200 after the feature migration.

## Tournament CRUD Verification

Verified locally and against remote Supabase on 2026-06-06 (Asia/Bangkok):

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed and Next lists `/admin/tournaments`, `/admin/tournaments/[id]`, `/admin/tournaments/new`, `/tournaments`, and `/tournaments/[id]`.
- `npx.cmd supabase db push --linked --yes` applied:
  - `202606040001_tournament_admin.sql`
  - `202606040002_refactor_tournament_creation.sql`
  - `202606060001_database_import_runs.sql`
  - `202606060002_fix_school_replace_delete_where.sql`
- `/admin/tournaments` no longer shows the missing-table warning after migration push.
- Browser smoke test created draft tournament `Smoke Test Tournament 2026-06-06T08-39-06-920Z` with division `Open Division`, changed it to `open`, verified it appears on `/tournaments` and `/tournaments/[id]`, then deleted the smoke tournament so it no longer appears publicly.
- Full smoke test on 2026-06-06 uploaded DAN/KYU/AWARD/SCHOOL workbooks through the Admin multipart routes. Latest counts: DAN 1,142, KYU 1,635, AWARD 985, SCHOOL 3. `database_import_runs` recorded success for all four sources; rank search and school autocomplete returned real Supabase results.
- Banner upload was smoke-tested with `Logo/Tesuji_Logo-01.png`; the file was stored in `tournament-banners`, public URL and Next image optimizer returned image/png, then the smoke tournament and storage object were deleted.
- `/admin/database`, `/admin/tournaments`, `/tournaments`, auth redirects, and in-app browser console checks passed with no smoke data left behind.

## Sprint 5 Schema Foundation Verification

Verified on 2026-06-08 (Asia/Bangkok):

- `npx.cmd supabase db push --linked --yes` applied `202606070001_registration_payment_foundation.sql` to the linked Supabase project.
- `npx.cmd supabase db lint --linked --schema public,storage --level error --fail-on error` passed after applying the migration.
- Supabase service-client smoke check confirmed `payment_orders`, `registrations`, `promo_code_usages`, and `division_registration_summary` are queryable and currently empty.
- Supabase Storage smoke check confirmed private bucket `slips` exists with 10MB file limit and `image/jpeg` + `image/png` MIME types.
- RLS smoke test created a temporary open tournament/division plus registration/payment/promo usage, confirmed anon could not see rows from private tables, confirmed anon could see public aggregate `division_registration_summary`, then deleted the smoke data. Follow-up query found 0 remaining `Codex S5 RLS Smoke%` tournaments.
- No TypeScript/source files changed, so `npm.cmd run lint` was not run for S5.0.

## Sprint 5 Registration Transaction Verification

Verified on 2026-06-08 (Asia/Bangkok):

- Added `src/lib/registrations/transaction.ts` as the server-side wrapper for `create_registration_transaction`; no public UI was added in S5.1.
- `npx.cmd supabase db push --linked --yes` applied `202606080001_registration_transaction_rpc.sql` to the linked Supabase project.
- `npx.cmd supabase db lint --linked --schema public,storage --level error --fail-on error` passed.
- Live DB smoke test created temporary auth users/accounts/profiles, an active tournament, divisions, and an approved Coach Link. It verified: Player self registration creates one pending payment order plus a zero-fee confirmed registration; duplicate registration is rejected; a full division creates `waiting_list` position 1 without a payment order; active Coach can register an approved linked Player and create a payment order. Smoke data was deleted; follow-up query found 0 remaining `Codex S5.1 Smoke%` tournaments.
- `npm.cmd run lint`, `npx.cmd tsc --noEmit`, and `npm.cmd run build` passed.

## Sprint 5 Promo Code Transaction Verification

Verified on 2026-06-08 (Asia/Bangkok):

- Updated `src/lib/registrations/transaction.ts` to accept optional `promoCode` and return promo fields (`promoCodeId`, `promoCode`, `promoCodeUsageIds`) plus discounted registration/payment totals.
- `npx.cmd supabase db push --linked --yes` applied `202606080002_registration_promo_transaction.sql` and then `202606080003_registration_promo_transaction_jsonb_plan.sql`. Migration `202606080002` compiled but Supabase lint could not statically resolve its temp table; `202606080003` replaced the RPC with a JSONB planning implementation and is the active function body.
- `npx.cmd supabase db lint --linked --schema public,storage --level error --fail-on error` passed after `202606080003`.
- Live DB smoke test created temporary auth users/accounts/profiles, an active tournament, divisions, and promo codes. It verified: `free` promo confirms immediately with no payment order; `percentage` and `fixed` promos create pending payment orders with discounted `amountDue`; invalid, expired, overused, and wrong-division codes fail without creating registrations or promo usages; `used_count` increments only for successful uses. Smoke data was deleted; follow-up query found 0 remaining `Codex S5.2 Smoke%` tournaments.
- `npm.cmd run lint` and `npx.cmd tsc --noEmit` passed.

## Sprint 5 Public Registration UI Verification

Verified on 2026-06-08 (Asia/Bangkok):

- Added `src/lib/registrations/options.ts` to build the real registration page DTO from Supabase: current account, own player profile, approved Coach-linked players, active registrations, and `division_registration_summary` quota data.
- Added `/tournaments/[id]/register` with mobile-frame UI, eligible division cards, waiting-list display, promo input, payment summary, result panel, and server action `submitTournamentRegistration`.
- Updated `/tournaments/[id]` so the registration CTA links to the real register route only when tournament status/window/active-division checks pass.
- `npm.cmd run lint`, `npx.cmd tsc --noEmit`, and `npm.cmd run build` passed. Build lists `/tournaments/[id]/register`.
- Browser smoke used local Next dev server at `http://127.0.0.1:3100` and headless Chrome CDP at mobile viewport 390x900. It created temporary `Codex S5.3 UI Smoke%` tournament/user data, logged in through `/api/auth/login`, opened `/tournaments/[id]/register`, verified the form rendered two real divisions including a full `waiting list` division, selected both, and clicked submit in the browser. Live DB then contained one `pending_payment` registration with a `payment_order_id` and one `waiting_list` registration at position 1. Smoke data was deleted; follow-up query found 0 remaining `Codex S5.3 UI Smoke%` tournaments/users.

## Sprint 5 Payment QR And Slip Upload Verification

Verified on 2026-06-08 (Asia/Bangkok):

- Added `src/lib/payments/promptpay.ts` to generate EMV Merchant-Presented PromptPay payloads locally with PromptPay AID `A000000677010111`, exact tag `54` amount, and CRC16-CCITT-FALSE; existing `qrcode` dependency renders the QR data URL.
- Added `src/lib/registrations/payment.ts`, `/payments/[id]`, and `POST /payments/[id]/slip`.
- Updated S5.3 registration success UI to link paid transactions to `/payments/[paymentOrderId]`.
- `npx.cmd supabase db push --linked --yes` applied `202606080004_payment_slip_submission.sql`.
- `npx.cmd supabase db lint --linked --schema public,storage --level error --fail-on error` passed.
- `npm.cmd run lint`, `npx.cmd tsc --noEmit`, and `npm.cmd run build` passed. Build lists `/payments/[id]` and `/payments/[id]/slip`.
- Browser smoke used local Next dev server at `http://127.0.0.1:3100` and headless Chrome CDP at mobile viewport 390x900. It created temporary `Codex S5.4 Smoke%` tournament/user/payment data, logged in through `/api/auth/login`, opened `/payments/[id]`, verified the QR/form/amount/linked registration rendered, uploaded a PNG slip, confirmed live DB changed `payment_orders.status` and linked `registrations.status` to `pending_verify`, then reloaded the page and verified the QR/form were gone and a signed slip link was shown.
- Negative browser smoke confirmed `text/plain` and `image/png` larger than 10MB are rejected with HTTP 400 before Storage upload.
- Smoke tournament/user/storage object/temp slip file were deleted; follow-up query found 0 remaining `Codex S5.4 Smoke%` tournaments.

## Sprint 5 My Registrations And Cancel Verification

Verified on 2026-06-08 (Asia/Bangkok):

- Added `src/lib/registrations/my-registrations.ts`, `/my-registrations`, `/my-registrations/[id]`, and a server-action cancel form.
- Added Home Quick Access entry for `/my-registrations`.
- `npx.cmd supabase db push --linked --yes` applied `202606080005_registration_cancellation.sql`.
- `npx.cmd supabase db lint --linked --schema public,storage --level error --fail-on error` passed.
- `npm.cmd run lint`, `npx.cmd tsc --noEmit`, and `npm.cmd run build` passed. Build lists `/my-registrations` and `/my-registrations/[id]`.
- Browser smoke used local Next dev server at `http://127.0.0.1:3100` and headless Chrome CDP at mobile viewport 390x900. It created temporary `Codex S5.5 Smoke%` owner/stranger users, a future pending-payment registration with payment order, and a past confirmed registration. Logged in as owner, `/my-registrations` rendered both registrations, `/my-registrations/[id]` rendered payment details and cancel form, and submitting the cancel form moved the future registration to `cancelled` with reason `UI smoke cancel`.
- Live DB check confirmed the cancelled registration had `cancelled_by`, `cancelled_at`, and `cancellation_reason`; its single-registration payment order changed to `cancelled`; the past registration stayed `confirmed`.
- Negative RPC smoke confirmed a non-owner/non-linked account cannot cancel another user's registration and a registration on/after event date cannot be cancelled.
- Smoke tournaments/users were deleted; follow-up query found 0 remaining `Codex S5.5 Smoke%` tournaments.

## Sprint 5 Admin Payment Verify

Verified on 2026-06-08 (Asia/Bangkok):

- Added `202606080006_admin_payment_verification.sql` with service-role-only payment review RPCs and a pending-verify index.
- Added `src/lib/admin/payments.ts`, `/admin/payments`, review server actions, and client controls for approve, reject-send-new, and reject-cancel.
- Added the Admin sidebar Payments nav item and allowed signed private `slips` URLs in `next.config.ts` for unoptimized slip preview images.
- `npx.cmd supabase db push --linked --yes` applied `202606080006_admin_payment_verification.sql`.
- `npx.cmd supabase db lint --linked --schema public,storage --level error --fail-on error` passed.
- `npm.cmd run lint`, `npx.cmd tsc --noEmit`, and `npm.cmd run build` passed. Build lists `/admin/payments`.
- Browser smoke used local Next dev server at `http://127.0.0.1:3100` at desktop width. It created temporary `Codex S5.6 Smoke%` tournament/user/payment data with three private slip uploads, opened `/admin/payments`, verified the queue, actions, nav, and slip preview rendered, approved one order through the UI, and confirmed it disappeared from the pending queue.
- Live DB smoke called the two reject RPCs for the remaining orders: reject-send-new moved the order and linked registration back to `pending_payment` and cleared slip fields; reject-cancel moved both to `cancelled` with rejection/cancellation audit and `waitingListPromotionDeferred = true`.
- Smoke tournament/user/storage objects were deleted; follow-up queries found 0 remaining `Codex S5.6 Smoke%` tournaments/accounts/storage objects.

## Sprint 5 Waiting List Promotion And Timeout

Verified on 2026-06-09 (Asia/Bangkok):

- Added `202606090001_waiting_list_promotion_timeout.sql` with `expired_at` audit columns, FIFO waiting-list compaction/promotion RPCs, pending-payment timeout lifecycle RPC, and S5.7 replacements for `cancel_registration` and `reject_payment_order_cancel`.
- Updated `src/lib/admin/payments.ts` to parse promotion/timeout RPC results and added a real Run timeout sweep action on `/admin/payments`.
- Updated `/my-registrations/[id]` cancellation feedback/copy so it no longer describes waiting-list promotion as deferred.
- `npx.cmd supabase db push --linked --yes` applied `202606090001_waiting_list_promotion_timeout.sql`.
- `npx.cmd supabase db lint --linked --schema public,storage --level error --fail-on error` passed.
- `npm.cmd run lint`, `npx.cmd tsc --noEmit`, and `npm.cmd run build` passed. Build lists `/admin/payments`, `/my-registrations`, and `/my-registrations/[id]`.
- Live DB smoke created temporary `Codex S5.7 Smoke%` users/tournament/divisions and verified:
  - Full paid division creates `waiting_list` position 1 through `create_registration_transaction`.
  - User cancellation promotes the oldest paid waiting-list registration once and creates a new pending payment order.
  - Timeout sweep with limit 1 expires the old pending payment order/registration and promotes the oldest paid waiting-list registration once.
  - Full free division creates `waiting_list`; cancellation promotes the oldest free waiting-list row to `confirmed` without creating a payment order.
  - Repeated direct promotion calls return `promoted = false` after the slot is already filled, so no double promotion occurs.
- Smoke data was deleted; follow-up query found 0 remaining `Codex S5.7 Smoke%` tournaments/accounts.
- Browser smoke used local Next dev server at `http://127.0.0.1:3100`, opened `/admin/payments`, and verified the page heading plus Run timeout sweep button render with no console errors or migration warning.

## Recommended Next Task

1. Continue to Sprint 5 slice S5.8 End-To-End Smoke And Handoff.
   - Token-light starting set: `docs/AI_HANDOFF.md`, `docs/DECISIONS.md`, and `docs/plans/05_registration_payment_token_light_slices.md`.
   - Extra read: only touched Sprint 5 files from `docs/AI_HANDOFF.md` plus `docs/plans/05_registration_payment_token_light_slices.md` S5.8.
   - Next command can be: `Run Sprint 5 slice S5.8 from docs/plans/05_registration_payment_token_light_slices.md. Do final smoke verification and update handoff.`
2. Keep Admin routes unprotected in dev mode. Add only future-ready auth seams that will later check `account_roles.admin = active`.
