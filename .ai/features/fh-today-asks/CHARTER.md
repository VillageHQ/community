# Charter: Founderhall transplant, area 1 — Today and Asks & updates

Approved scope: the orchestrator's brief for round 3, area 1 (the owner approved the transplant plan; this page
restates it for this build). Slug `fh-today-asks`, branch `absi-agent/fh-today-asks`.

## Direction
Community's engine, Founderhall's screens copied exactly: structure, sections in order, parts, words, look and steps.
Founderhall is the acceptance test. In: Today, Asks & updates, the new one-ask page, the Community-only feed
(restyled), and the emails of this area. Out: the guided ask `/ask` (area 2), the intro pages (area 3), the console's
Asks & digest and digest preview pages (area 6).

## Routes (owner-approved renames, permanent redirects from the old ones)
- Today: `/` → `/today` (`/` redirects there for members; the old address keeps working).
- Asks & updates: `/asks` (tabs Open · Updates · Yours · Answered via `?tab=`; search via `?q=`).
- New: `/asks/[askId]`, Founderhall's one-ask page (helpers, answers, "I can help", the owner's box).
- Old `/asks?view=yours` → `/asks?tab=yours`. Email links point at the new pages.

## Engine work this area builds (Founderhall functions Community lacked)
1. An ask is one line (up to 500 characters, Founderhall's limit) plus an optional "Who are you trying to reach?"
   (a person or role) and a company. Stored as new columns on `ask`; the old LinkedIn target keeps working for
   existing asks. The category is no longer asked; it is inferred (an ask with a target is an intro, else advice).
2. Path helpers remember who they know (name, title, how warm), so "Why you" reads like Founderhall
   ("You know Dana Morris well (VP Supply Chain at Mercy Ridge Hospital). Worked together at …").
   A free-text target is checked through the member's network search, members who share only.
3. Board tabs Open · Updates · Yours · Answered with counts; the Closed tab folds into Answered (the archive).
4. "Mark answered" in one click (outcome solved here); Reopen; admin Pin / Close / Remove on the ask page.
5. Today's "Is this right?" fact check: Right / Hide it / Fix it on lines filled in from public profiles
   (a `confirmed_at` on the fill-in line), and "Not this week" (the existing skip), each with a flash.
6. Emails: the helper email ("Sam asks: …"), the new help-offered email to the asker, the weekly digest's words
   and the digest-reply notice, word for word as Founderhall's plain text.

## Community-only functions kept (rebuilt with Founderhall's parts)
Report an ask or answer, renew an expiring ask, the outcome choice when closing, offers sent as messages, block
rules, removed members hidden, the switchable feed (its own page, restyled as Founderhall posts, menu item only
while on), the lookup question on Today.

## Safety stops
No change to auth, permissions, secrets or real accounts. Migration adds nullable columns only (a revert drops them).

## Acceptance
A verifier who did not build it retakes every acceptance shot of area 1 at 390 and 1280 px beside Founderhall's and
lists every difference; done = none except community data. Emails match subject and body word for word. Lint,
typecheck, the asks/feed/today tests and the architecture tests green. Pairs saved in `reports/`.
