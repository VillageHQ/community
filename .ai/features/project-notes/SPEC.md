---
id: project-notes
status: building
checks: []
priority: 1
score: 1.5
scored: 2026-11-10
basis: e95a9f.decddb
---
# Spec: Project notes and repo onboarding

The repo's project memory, written for the merged product. Charter: `CHARTER.md` beside this file.

## What it holds
- `.ai/vision.md` (why it exists, who it serves) and `.ai/personas.md` (made-up people for testing journeys).
- `.ai/journeys/`: the main journey and nine core journeys as they work on main.
- `.ai/roadmap.md`: Now / Next / Later / Done, and the Founderhall parity map: each of the 161 features in the
  Founderhall inventory once, marked done, dropped or open. Every open roadmap line links an idea spec or a pull request.
- `.ai/bugs.md`, `.ai/design/DESIGN.md` (a pointer to `docs/design/tokens.md`), `.ai/reports/agent-files-lean-report.md`.
- The notes tree: the root map in `CLAUDE.md` (the root `AGENTS.md` is ignored, because `next dev` writes its own
  there; `notes-root: CLAUDE.md` in `.ai/autobuild.json`), `src/AGENTS.md`, `scripts/AGENTS.md`, and a `CLAUDE.md`
  with `@AGENTS.md` beside every `AGENTS.md`.
- The layout stamp `.ai/autobuild.json` (autobuild 1.32.0).

## Acceptance
- `version.mjs check` prints CURRENT; `notes-check.mjs --strict` passes; `onboard.mjs verify` passes.
- Every Founderhall feature is on the parity map exactly once, with a status checked against the code.
- No personal names, emails, machine paths or private research in the diff.
- Every folder `AGENTS.md` is at most 3 KB; the root map at most 8 KB.

## Implementing files
`.ai/` (above), `CLAUDE.md`, `src/AGENTS.md`, `scripts/AGENTS.md`, `src/**/CLAUDE.md`.
