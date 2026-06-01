# TESUJI AI Handoff

Last updated: 2026-06-01

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
  - `school_database`
- Current migrations:
  - `202606010001_go_player_database.sql`
  - `202606010002_replace_go_player_database_source.sql`
  - `202606010003_identity_mobile_signup.sql`
  - `202606010004_lock_identity_direct_updates.sql`
  - `202606010005_pdpa_consent.sql`
  - `202606010006_school_database.sql`
- Supabase MCP is configured for dev DB access via project-scoped `.mcp.json` (OAuth, no secret key). Run `/mcp` -> `supabase` -> Authenticate after a fresh session.

## Implemented Features

- Admin dashboard dark UI exists at `/admin`.
- Admin Database page exists at `/admin/database`.
- Admin Database upload supports DAN/KYU/AWARD Excel files and imports parsed rows to Supabase.
- Admin Database upload also supports `SCHOOL_Database.xlsx` with columns `seq`, `name`, `keywords`; it imports to `school_database`.
- Go DB parser reads real files from `D:/Programming/Database` by default.
- `go_player_database` currently has 3,762 rows:
  - DAN: 1,142
  - KYU: 1,635
  - AWARD: 985
- `school_database` currently has 3 rows from `D:/Programming/Database/SCHOOL_Database.xlsx`.
- Rank search API exists at `POST /api/rank/search`.
- School search API exists at `GET /api/schools/search?q=...`.
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

## Important Blocker

Real atomic signup is coded but blocked until a real server-only Supabase key is added:

```env
SUPABASE_SECRET_KEY=
# or
SUPABASE_SERVICE_ROLE_KEY=
```

Without this key, `POST /api/auth/signup` intentionally returns:

`Missing SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY for real signup`

After adding the key, restart the dev server.

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

## Supabase Notes

- `complete_account_signup` is a service-role-only RPC. As of `202606010005`, it takes a 24th arg `p_pdpa_consent boolean` (raises if false) and writes `player_profiles.pdpa_consent` + `pdpa_consent_at`.
- `player_profiles` now has `pdpa_consent boolean not null default false` and `pdpa_consent_at timestamptz` (PDPA consent captured at signup).
- `accounts` and `player_profiles` direct client updates are revoked by `202606010004_lock_identity_direct_updates.sql`.
- Future profile edits should go through trusted server actions/routes.
- `current_account_has_role` checks active roles.
- Rank search RPC now returns evidence fields such as `year_promoted`, `rating`, `category`, `rank_award`, `event_name`, and `event_date`.

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
- `IDENTITY_HASH_SALT`

It does not currently include a real unmasked secret/service key.

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

## Recommended Next Task

1. Add real `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`.
2. Restart dev server.
3. Test real signup:
   - Player self-declared rank.
   - Coach self-declared rank.
   - Matched rank using a known Go DB name.
4. Verify created rows in Supabase:
   - `auth.users`
   - `accounts`
   - `account_roles`
   - `player_profiles`
   - `role_requests` for Coach.

After signup is verified, next product work should be Admin role-management:

- Coach approval queue.
- Referee invite creation/redeem.
- Admin-only access protection.
