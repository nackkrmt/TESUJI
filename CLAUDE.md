# Claude Handoff

This project will be worked on by both Claude and Codex, switching back and forth over time.

Before making changes, always read the shared handoff files below and update them when your work changes architecture, database schema, routes, locked decisions, setup steps, blockers, or the recommended next task.

Start here, then read:

1. `AGENTS.md`
2. `docs/AI_HANDOFF.md`
3. `docs/DECISIONS.md`
4. `master_plan.md` only when deeper context is needed

Important: do not rely only on `master_plan.md`; it is long and may contain older narrative details. The current state and locked decisions are in the docs above.

When handing work back to Codex, leave the repo in a clear state:

- Run relevant verification commands when possible.
- Note anything that was not tested.
- Do not add real secrets to markdown files.
- Keep `.env.example` updated, but keep `.env.local` local-only.
- Prefer small, real, working increments over mockups or placeholder behavior.
