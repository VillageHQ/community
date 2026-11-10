---
id: fix-small
status: building
waits-on: []
size: medium
---
# Spec: the small known bugs (after wave 3)

**Added:** 2026-11-10 (the owner's wave-3 fix part; approved scope in `CHARTER.md`)

## What & why
Eight small bugs left by the merge builds and the final check, fixed together in one pull request, plus the roadmap
catch-up after PRs #20 to #26.

## What it does now
- Sign-in keeps the typed email across the link and password forms.
- A switched-off module's pages answer 404 before rendering (`src/proxy.ts`).
- Today's "Check your card" lists the filled-in lines on the member's card from the last 7 days.
- The Perks menu entry is a full page load, so the Perks page's own security policy applies.
- A slow Slack /ask answers "Posting your ask…" at once and sends the result to Slack afterwards.
- Word matching treats "fund-raising" as "fundraising" and simple word forms as one word.
- A single invite takes an optional cohort.
- On phones, the Today search hint ends with "…"; long fund names stay tidy in the top bar and sidebar.

How each works: `NOTES.md`. Bugs and repro tests: `.ai/bugs.md`.

## Open questions
- None known.
