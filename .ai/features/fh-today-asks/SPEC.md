---
id: fh-today-asks
status: in-progress
waits-on: [fh-foundation]
touches: ["src/app/(app)/page.tsx", "src/app/(app)/today/", "src/app/(app)/asks/", "src/app/(app)/feed/", "src/shell/today*", "src/shell/next-step*", "src/shell/ask-helpers.ts", "src/shell/weekly-email-compose.ts", "src/modules/asks/", "src/modules/feed/manifest.ts"]
---
# Spec: Today and Asks & updates in Founderhall's screens (transplant area 1)

**Added:** 2026-11-11 (the owner's decision: keep Community's engine, copy Founderhall's screens exactly).

## What it does
Today (`/today`; `/` sends members there) shows, in Founderhall's order and words: asks on your paths with "Why you",
"I can help" and "Not this week"; intros waiting for your yes with the note and Answer; "Is this right?" lines filled
in from public profiles with Right / Hide it / Fix it; and in the rail your asks in motion with the week's allowance
pips, Perks, Jobs and the end line. Asks & updates (`/asks`) has Founderhall's composer (Ask | Update, one line,
"Who are you trying to reach?"), archive search, tabs Open · Updates · Yours · Answered and posts with the helpers
strip. Each ask has its own page (`/asks/<id>`): who can help, answers, the reply box, "I can help", and Mark
answered / Reopen (author) or Pin / Close / Remove (admin). The helper email, the help-offered email, the weekly
digest and the digest reply notice use Founderhall's plain-text words. The switchable feed has its own page.

## Acceptance
Every area-1 acceptance shot at 1280 and 390 px matches Founderhall except community data
(`reports/PAIRS.md`); the emails match word for word (`src/modules/asks/asks-founderhall.test.ts`).
