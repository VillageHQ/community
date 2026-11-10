# Charter: first-run admin landing and two admin-home follow-ups

Approved scope (the owner's build plan, wave 1). Follows the admin home (PR #32), which moved setup to `/admin/setup`.

## Direction
1. While setup is unfinished, a brand-new admin lands on `/admin/setup`: from `/start` (where every sign-in lands)
   and after the first sign-in's welcome steps. Once setup is done, finishing the last step sends them to the admin
   home, as today; a later sign-in lands where it does today.
2. The "Invite someone" button on Admin → Members: check in the running app whether PR #32 fixed it. If it works,
   tick its roadmap line with the evidence; if not, fix it.
3. Early in a quarter the home can say "No intros asked yet this quarter" next to "3 intros asked, no answer"
   (stuck asks from last quarter). The stuck line says it counts older asks: "3 older intros still waiting for an
   answer".

Out: any other landing change, the rest of the "Text slips" roadmap line, a new migration.

## Deciding facts
- Every sign-in returns to `/start`, which sends unfinished welcome steps to `/welcome`, members to the feed, and
  admins by setup progress. Assumption: an admin whose setup is done still lands on the feed from `/start` (today's
  way); "the home after setup" is the admin home that `/admin/setup` sends them to once every step is done.
- The welcome steps end on the feed today; they now end on `/start`, so an admin with setup left goes on to setup.
- Stuck intros are asked 4+ days ago, so "older" is true in any part of the quarter.

## Journeys and tests
- First-run admin journey: a unit test for the landing choice; the existing admin-home tests, updated for the new
  words; lint, typecheck, architecture tests. A separate verifier uses the running app with made-up data.

## Proof and estimate
- Proof: screenshots at 390 and 1280 px of a fresh admin landing on setup, the home after setup, the Invite button,
  and the early-quarter home. Build about 45 minutes, tests about 30.
