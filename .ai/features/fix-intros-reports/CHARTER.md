# Charter: fix build, intros, investor report and Village warnings (`fix-intros-reports`)

Approved scope: the orchestrator's brief of 2026-11-12, from Absi's choice to fix Community's list after the
feature parity audit (`.workspace/scratch/founderhall-vs-community/parity-2026-11-12/`). Parallel builds:
`fix-accounts-privacy`, `fix-feed-digest-site`. One pull request; the orchestrator merges it.

## Direction
1. **Partner report names connectors without consent** (PRIV-07): bring back "Credit me in reports" (off by default)
   on Your data; what leaves the app (the partner email, the CSV, the printed PDF) names only members who switched it
   on and counts the rest as "Other connectors". Admins still see every name on the page in the app (Absi's decision).
2. **No-answer expiries counted as declines** (ADM-04): count them as "no answer", apart from declines, on the page,
   the email, the CSV and the title; the CSV rows add up to the asks.
3. **Village out of credits or down: the admin is not told** (NET-09): one email to admins and a console notice, once
   per spell of trouble, not on every search.
4. **No per-day or per-member credit view** (NET-12): add both to Admin › Village.
5. **Member as intro target** (INTRO-06): the member asked sees the request on Today and Your intros and can answer
   there, not only by email.
6. **Ask any listed helper** (ASK-06): helpers found by profile words can be asked for the intro too.
7. **Village faces** (PROF-04): the filled-in face shows on the directory and the profile wherever a member has one.

Out: the other builds' areas (invites, onboarding consent, sign-in limits, email switches, feed, weekly email, jobs on
profile, website); "Asks posted counts a banned member's ask" (ADM-04 side note) stays for a later fix.

## Deciding facts (assumed)
- The admin's in-app page shows all names, each uncredited one marked; print, CSV and email are the partner copy.
- "Once" = one email per trouble spell (out of credits, or down), cleared when Village answers again.
- A member target is a member whose email or profile matches the person asked for, or one picked from the directory.

## Proof and tests
A failing test per item first, then the fix; typecheck, lint, the full suite on a throwaway Postgres; a separate
agent re-runs each audit row in the running app and retakes changed screens at 390 and 1280 px.
