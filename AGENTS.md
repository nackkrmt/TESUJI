# TESUJI Agent Guide

Read this before making changes. This file is for Codex, Claude, and any coding agent working in this repo.

## Required Reading Order

1. `docs/AI_HANDOFF.md` - current implementation state and next blockers.
2. `docs/DECISIONS.md` - locked product/technical decisions.
3. `master_plan.md` - full product plan, but prefer the handoff and decisions files when details conflict.
4. Relevant `docs/plans/*.md` for subsystem-level planning.

## Project Rules

- No mock/fake behavior for production paths. UI can be empty only when explicitly documented as not connected yet.
- Use real Supabase project/data. Do not invent local-only DB behavior unless clearly marked as a local parser/test tool.
- Do not commit secrets. Put secrets in `.env.local`; keep `.env.example` secret-free.
- User-facing public/auth/profile UX is mobile-only forever, displayed as a mobile frame even on desktop.
- Admin dashboard can be desktop/tablet and is not forced mobile-only.
- Register can choose only `player` or `coach`; `referee` requires Admin invite code later.
- Coach accounts also have their own Player Profile and active `player` role. Coach role itself is pending until Admin approval.
- AWARD rank calculation uses `rank_in_category` only. `category` is metadata/display/audit only.
- Dev mode: do not add route-level Admin access protection yet. Keep Admin routes reachable while building functions. Prepare future Admin auth to use the same Supabase user/account flow as normal users, gated later by `account_roles.admin = active`; do not create a separate Admin login/auth system.

## Engineering Notes

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

- App stack: Next.js 16 App Router, React 19, Tailwind v4, Supabase, ExcelJS, Zod.
- Use `rg` for search.
- Use `apply_patch` for manual edits.
- Before DB schema changes, inspect Supabase tables/migrations first.
- Supabase migrations live in `supabase/migrations`.
- Prefer transactional RPC/server-route flows for identity/signup/admin mutations.
- Windows dev env: `python3` here is a non-functional Microsoft Store stub — always call Python as `python` (3.14.x), not `python3`.
- Go and school database imports are upload-only through `/admin/database`; do not add production paths that depend on a local database folder.
- UI/UX design skill (Claude Code) installed at `.claude/skills/ui-ux-pro-max/`. Run from repo root, e.g. `python .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system`. Codex won't auto-load this Claude-only skill folder but can run the script directly. A `uipro update` may overwrite `SKILL.md` and revert the in-file `python3`->`python` fix.

## Verification

Run these after meaningful changes:

```bash
npm run lint
npm run build
```

Common local dev command:

```bash
npm run dev -- --hostname 127.0.0.1 --port 3000
```
