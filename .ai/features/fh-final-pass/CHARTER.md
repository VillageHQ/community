# Charter — Founderhall transplant, round 4: full check, fix pass, review pairs

Approved by the owner as part of the Founderhall transplant plan (round 4 of the orchestrated build); the work order
the orchestrator approved is copied below as this build's page. No separate decision page: the orchestrator owns the
plan and merges the pull request.

- **Direction:** check the whole app against Founderhall's 154 screens at 390 and 1280 px, fix what is left (every
  FAIL and every round-4 item in the orchestrator's follow-up list), and produce one set of side-by-side pairs the
  owner reviews once. Out: anything that needs a product decision (privacy, data handling, spend) — listed, not built.
- **Deciding facts:** Founderhall is the standard; Community data (names, counts, dates) and the kept calls listed in
  each area's pull request are not differences; demo seed only (made-up people at example.com); one server at a time.
- **Tests:** typecheck, lint and the full suite on a throwaway Postgres; a fresh agent that built nothing re-checks
  every failed shot and every changed page (at most 2 repair rounds).
- **Proof:** `reports/verdicts.md` (before), `reports/PAIRS.md` + `reports/pairs/` (after, under 10 MB).

## The work order (verbatim from the orchestrator)
## Where the project is
Community keeps its engine, and Founderhall's screens were copied onto it, page by page. Founderhall is the standard
each page must match. The foundation, dark mode and 8 area pull requests are merged. Each area was checked on its own.
This round checks the WHOLE app at once, fixes what is left, and produces the pairs the owner reviews once.

Reference: `C:/ai/code/.workspace/scratch/founderhall-vs-community/fh-reference/`
- `shots/<name>-1280.png` and `<name>-390.png` (Founderhall's screens, 153 screens) and the emails
- `copy/<name>.md` (the words), `map.md` (per-screen gaps, Community-only screens), `areas.md` (which shot belongs to which area),
  `design-system.md`, `ia.md`
- Known open items: `C:/ai/code/.workspace/scratch/founderhall-vs-community/build/pending-followups.md` (read all of it)

## Step 1 — the check (a foreground subagent that builds nothing)
Run the app from this worktree with the demo seed (DEMO_MODE, made-up people only, the same demo people Founderhall's
shots use). Hand a foreground subagent that has not edited any file the job: retake EVERY Founderhall shot from
Community at 390 and 1280 px, put each beside Founderhall's, and name each real difference (structure, parts, words,
look, behaviour). Community data (names, counts) and the deliberate differences listed in each area's PR and in
pending-followups.md are not differences. It writes `.ai/features/fh-final-pass/reports/verdicts.md`: one row per shot
(PASS / FAIL + the difference), plus anything visibly broken anywhere, even with no shot.
Also check the fresh-install pages (no demo data) for the shots that have a fresh-install version.

## Step 2 — the fix pass (you)
Fix every FAIL from step 1 and every open item in pending-followups.md that is marked for round 4 or the fix pass,
including:
- the bad-invite page tells a never-joined invitee to ask for a NEW invite (the password link stays under sign-in);
- "Our jobs" on My profile (`/me#jobs`), "Add your company's jobs" points there, the Directory's "Jobs at member
  companies" link; then Jobs and Perks leave the phone foot links;
- the intro-ask page (`/intros/new`) tells members that admins see who asked whom (the owner's decision);
- remove the dead "Credit me in reports" switch on the member card (every connector is named now);
- the ask pages' "14 days" words follow the real intro timing (Founderhall: 7 days per step);
- the empty Your intros screen points to `/search`;
- not-found pages inside the app answer with status 404 (unknown conversation, ask, company, bad `/messages/new` link);
- the shell items areas left: two-letter initials like Founderhall, the 1–2 px sidebar offset, the phone reply box height,
  bad links answering 410 where Founderhall does;
- a print rule so the partner report prints dark text from dark mode; the Settings brand card's dark contrast line.
An item that needs a product decision (it changes privacy, data handling or spend) is NOT built: list it for the owner.
Keep each fix small and in the owning area's patterns and parts. Run typecheck, lint and the full suite on a throwaway
Postgres (a new container name; remove it after). Only the known deploy-template line-ending test may fail on Windows.

## Step 3 — re-check and the review pairs
A fresh foreground subagent that built nothing re-checks every shot that failed and every page you changed. Repeat
step 2 for what still fails (at most 2 repair rounds, then list what is left).
Then produce the review set the owner sees: for every Founderhall shot, a pair image (Founderhall left, Community right,
same width) in `.ai/features/fh-final-pass/reports/pairs/`, grouped by area, with `PAIRS.md` listing each pair, its
verdict and any kept difference with the reason. Keep the folder under 10 MB (JPEG, sensible quality); put the full-size
set in `.ai/tmp/pairs-full/` (not committed).

## Deliver
Commit, add the changelog card and the run line as autobuild says, push, open the PR ("Founderhall transplant, round 4:
full check and fix pass"), wait for its GitHub checks (if they stay queued over 15 minutes, push an empty commit). End
with a short plain report: shots checked, PASS/FAIL counts before and after, what you fixed, what is left, and every
open product decision with your recommendation.

## Limits
- Never point anything at real accounts, real email or real services. Tests use made-up people at example.com.
- Never start background subagents, background shells or Monitor: run every long command in the foreground, or the run
  ends early. Use foreground subagents only. Stop every server you started.
- The owner's PC may be busy (a game can run). Use one dev server at a time and close browsers when a step ends.
- Stop at the build skill's safety stops (security, data loss, production, scope) and report back instead of acting.
- Write one plain progress sentence per finished step.
