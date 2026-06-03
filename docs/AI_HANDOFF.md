# TESUJI AI Handoff

Last updated: 2026-06-04

This is the short, current-state handoff for agents switching between Codex and Claude.

## Collaboration Protocol

- Claude and Codex will both work on this project, switching back and forth over time.
- Before starting work, read `AGENTS.md`, this file, and `docs/DECISIONS.md`.
- After meaningful work, update this file if current state, blockers, routes, migrations, verification status, or the next task changed.
- Keep decisions that should not be re-litigated in `docs/DECISIONS.md`.
- Do not put real secrets in markdown files, git commits, or chat summaries.
- The project rule is no mockups for core behavior: each step should work against the real app/database before moving on.

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
  - `tournaments`
  - `divisions`
  - `promo_codes`
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
- Supabase MCP is configured for dev DB access via project-scoped `.mcp.json` (OAuth, no secret key). Run `/mcp` -> `supabase` -> Authenticate after a fresh session.

## Implemented Features

- Admin dashboard dark UI exists at `/admin`.
- Admin Database page exists at `/admin/database`.
- Admin Database upload supports DAN/KYU/AWARD Excel files and imports parsed rows to Supabase.
- Go DB upload now re-syncs already verified Player Profiles after each import. Verified profiles are rematched by normalized Thai first/last name against the current `go_player_database`, with DAN priority over KYU/AWARD and then highest `power_level`; matching rows update `rank`, `power_level`, `rating`, and `matched_go_player_id`.
- Admin Database upload also supports `SCHOOL_Database.xlsx` with columns `seq`, `name`, `keywords`; it imports to `school_database`.
- Go DB parser reads real files from `D:/Programming/Database` by default.
- `go_player_database` currently has 3,762 rows:
  - DAN: 1,142
  - KYU: 1,635
  - AWARD: 985
- `school_database` currently has 3 rows from `D:/Programming/Database/SCHOOL_Database.xlsx`.
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
  - Admin tournament routes use real Supabase data via trusted server actions/service layer.
  - Admin can create draft tournaments, edit tournament details, change status, delete draft tournaments, add/edit divisions, and add/edit promo codes.
  - Opening a tournament requires at least one active division.
  - Public tournament list/detail read published non-draft tournament data from Supabase.
  - Banner support is metadata-only in this slice (`banner_url` / `banner_alt`); storage upload/validation is not implemented yet.
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
  - Creates a draft tournament through `createTournamentAction`.
- `/admin/tournaments/[id]`
  - Edits tournament details, status, divisions, and promo codes.
  - Server actions return typed `{ status, message, id? }` results for form UX.
  - Future Admin protection seam lives in `ensureAdminMutationAllowedForDevMode()` and must later check `account_roles.admin = active`.
- `/referee/invite`
  - Logged-in users can redeem a one-time Referee invite code.
- `/tournaments`
  - Mobile-frame public list of non-draft tournaments from Supabase.
- `/tournaments/[id]`
  - Mobile-frame public detail page with real tournament details and divisions.
  - Registration/payment CTA is intentionally disabled until Sprint 5.
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

## Dev Tooling

- `python3` on this Windows machine is a non-functional Microsoft Store stub — use `python` (3.14.x) for all Python calls.
- UI/UX design helper skill (Claude Code) installed project-local at `.claude/skills/ui-ux-pro-max/` on 2026-06-01. Invoke from repo root: `python .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system`. Claude-only skill folder; Codex can still run the script directly.
- Auth UI a11y/UX pass (2026-06-01, guided by the ui-ux-pro-max review): shared input/button classes in `src/components/mobile/mobile-shell.tsx` now carry visible `focus-visible` rings + `cursor-pointer`; `globals.css` adds a global cursor-pointer base rule (Tailwind v4 drops the default button pointer) + a `prefers-reduced-motion` guard; root layout loads **Noto Sans Thai** for Thai glyphs (Geist is latin-only, so Thai text was falling back). `/login` is now a real `<form>` (Enter submits) with show/hide password, a loading spinner, and `role="alert"` errors; the register wizard got the same focus/cursor/loading/password-toggle + `role="alert"` treatment **without** changing its 4-step flow, fields, or components. `/forgot-password` and `/reset-password` now follow the same pattern too (real `<form>` + Enter-submit, `role`-tagged messages — `status` for the forgot-password success vs `alert` for errors — loading spinner, and show/hide toggles on both reset-password fields). Reuse the shared classes for any new auth inputs/buttons.
- School DB upload/autocomplete pass (2026-06-01): migration `202606010006_school_database.sql` creates `school_database`, `replace_school_database(jsonb)`, and `search_school_database(text, integer)`. Admin upload route is `/admin/database/school/upload`; register uses `src/components/auth/institute-search-field.tsx`.
- Do NOT run `npm run build` while a `next dev` server is live on the same folder — both write `.next/` and the running dev server then serves mismatched SSR/client bundles → hydration errors (e.g. on `/register`). Stop dev first, or to recover: kill the dev server, delete `.next`, restart dev (no code change needed).

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
npm run inspect:go-db
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

Verified locally on 2026-06-04 (Asia/Bangkok):

- `npm run lint` passed.
- `npm run build` passed and Next lists `/admin/tournaments`, `/admin/tournaments/[id]`, `/admin/tournaments/new`, `/tournaments`, and `/tournaments/[id]`.
- Supabase CLI migration dry-run was attempted with `npx supabase db push --dry-run --linked` but this session has no Supabase access token/login.
- Remote Supabase currently returns `PGRST205` for `public.tournaments`, so the new migration still needs to be applied before browser CRUD smoke tests can pass against the real project.
- Browser smoke opened `/tournaments`; it currently shows a server error because the remote migration is not applied yet.

## Recommended Next Task

1. Finish Sprint 4 verification and remote migration push/reset if not already done.
2. Move to Sprint 5 Registration + Payment foundation.
3. Keep Admin routes unprotected in dev mode. Add only future-ready auth seams that will later check `account_roles.admin = active`.
