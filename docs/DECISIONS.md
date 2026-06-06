# TESUJI Locked Decisions

Last updated: 2026-06-06

## Product Decisions

- User-facing public/auth/profile UX is mobile-only forever.
- Desktop screens must show user-facing UX inside a mobile frame, not a separate desktop layout.
- Admin dashboard is allowed to be desktop-first and is not bound by the mobile-only rule.
- No mockup-only pages for implemented systems. A button that looks functional must perform a real mutation or clearly be absent.
- Login uses email/password only. No username and no social login.
- Forgot/reset password uses Supabase Auth.

## Roles

- Webapp roles are `player`, `coach`, `referee`, and `admin`.
- Public signup can choose only `player` or `coach`.
- `referee` must come from an Admin invite code later.
- `admin` is seeded/managed manually by the owner.
- During dev mode, Admin routes are intentionally not protected at route level. Do not implement Admin route guards yet.
- When Admin protection is enabled later, it must use the same Supabase Auth/account system as normal users and check `account_roles.admin = active`; there is no separate Admin login.
- Every user signing up as Player or Coach creates exactly one Player Profile for themself.
- Coach receives active `player` role immediately so they can compete.
- Coach role starts as `role_requests.coach = pending`.
- Coach pending text must tell the user to contact Admin to verify identity.
- Coach cannot create Player Profiles for other people. They can only link to existing Player accounts after Player approval.

## Player Profile And Rank

- One account has at most one Player Profile.
- Signup collects full profile before creating Supabase Auth user.
- Auth user is created only on final confirmation.
- Rank matched from Go DB is `verified`.
- Self-declared rank is `pending`.
- Self-declared dropdown allows `15 Kyu` through `1 Kyu` and `1 Dan` through `9 Dan`.
- Self-declared Dan is allowed but still pending Admin review.
- National ID/passport must be stored only as salted SHA-256 hash, never raw.
- PDPA consent is required to complete signup and is stored on `player_profiles` (`pdpa_consent` + `pdpa_consent_at`). `complete_account_signup` rejects signup without consent.
- Title TH is chosen from a fixed dropdown (`นาย`, `นาง`, `นางสาว`, `เด็กชาย`, `เด็กหญิง`, `อื่น ๆ`). Title EN auto-maps from TH: นาย=Mr., นาง=Mrs., นางสาว=Miss, เด็กชาย=Master, เด็กหญิง=Miss. `อื่น ๆ` lets the user type TH + EN freely.
- Date of birth is entered via a 3-wheel picker (day/month/year) with year in CE, stored as `yyyy-mm-dd`.

## Go Player Database

- Go player source files are DAN, KYU, and AWARD Excel workbooks.
- AWARD uses `rank_in_category` as the only source for rank/power calculation.
- AWARD `category` is metadata/display/audit only.
- `rank_award` must be 1, 2, or 3 to import.
- DAN has priority over KYU/AWARD in rank matching.
- If KYU and AWARD both match, choose the higher `power_level`.
- Go and school database imports are upload-only through Admin Database. Production paths must not depend on a fixed local folder or local workbook cache.
- Latest import audit/status is stored in Supabase `database_import_runs`.

## Supabase

- Real Supabase project is used, not a mock DB.
- Project ref: `jiweobnsxpmgexipqzbx`.
- Public URL: `https://jiweobnsxpmgexipqzbx.supabase.co`.
- Migrations are the source of truth for schema.
- Server admin mutations require `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`.
- Do not store secrets in repo-tracked files.

## Tournament Admin

- Admin tournament creation is a single form for event details plus multiple divisions; do not return to a required draft-first/add-divisions-later flow.
- Tournament name is stored/displayed as one `title`, not separate TH/EN tournament titles.
- Tournament event date and registration open/close date portions should use the same wheel-picker date pattern as registration; registration times use dropdowns.
- Tournament banner uploads use public Supabase Storage bucket `tournament-banners`; store the public URL in `tournaments.banner_url`.
- Blank division power or age bounds mean Open and must be saved as `NULL`, not `0`.
- Admin division power/age bounds should be chosen from dropdowns, with Open as the empty value.
- Division time slot labels are `เช้า`, `บ่าย`, and `เต็มวัน`.
