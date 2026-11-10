# Project notes and repo onboarding

Approved scope: the owner's merge plan (wave 3), handed to this build as its brief. No database, no migration, docs only.

## Direction
Give this repo the project memory every autobuild run reads first, written for the merged product (Community as the
base, Founderhall's features ported in).

In:
1. Onboard the repo onto autobuild's layout (the `onboard` workflow): `.ai/roadmap.md`, `.ai/journeys/`, root
   `AGENTS.md` + `CLAUDE.md` pointer, folder notes where missing, the version stamp. The existing `.ai/features` and
   `.ai/changelog` stay as they are.
2. Founderhall's project notes, rewritten for the merged product: `.ai/vision.md` (why it exists; who it serves: funds
   and their founders), `.ai/journeys/` (sign in, Today, ask for an intro, answer an intro, the asks board, the weekly
   email, the partner report, admin invite and import, your data) as the app works on main today, and a personas note.
3. A parity map in `.ai/roadmap.md`: every Founderhall feature as one line, marked done (with the module or PR that
   ships it), dropped (with the reason from the merge plan) or open. Open lines include the known follow-ups and the
   still-open PRs (the new look, demo mode, one website, the Your data page).

Out: any code change, any change to docs/ or README, merging.

## Rules
Public repo: no personal names, customer or fund names, emails, machine paths, chat ids, market research, pricing or
security findings in any committed file.

## Acceptance
- autobuild's version check prints CURRENT on the worktree.
- Every Founderhall feature appears exactly once on the roadmap with a true status (spot-check 10 against the code).
- A scan of the diff finds no personal names, emails, machine paths or private research.
- Every AGENTS.md is under its size limit (root 8 KB, folders 3 KB).
