# Charter: jobs on member cards, profiles, the directory and Today

Approved scope (the owner's build plan for the Founderhall → Community merge, the owner's pick).

## Direction
When the job board is on:

1. A founder can paste the company's careers link from their own card page too: the same pull as Jobs › Your
   company's jobs, and the one-source-per-link rule stays.
2. A member's profile shows their company's open jobs: title, place and an Apply link, up to 5, then
   "See all N jobs" (the members' board filtered to that company).
3. Directory cards show a small "Hiring · N jobs" chip for members whose company has open jobs, and the directory
   gets a "Hiring" filter.
4. Today gets a jobs card: new jobs at the community's companies this week, hidden when there are none.

When the job board is off, none of this shows (and the directory ignores a stale `hiring=1`). Demo mode shows it
with the seeded jobs.

Out: the weekly email (it stays as it is), job alerts, posting jobs to Slack or Discord.

## Deciding facts
- "Their company's jobs" are the listed jobs (source not hidden, linked by an active member) whose source company
  matches the member's company on their card (own words, else the filled-in company), ignoring case and outer
  spaces, plus any source the member linked themselves.
- "New this week" means posted in the last 7 days, or, when the hiring tool gives no date, first seen in the last
  7 days. A new `first_seen_at` column on job postings (migration 0028) records when a job first appeared;
  existing jobs take their source's link date.
- Members stays below the job board: the directory read takes an optional hiring lookup that the route and page
  pass in when the job board is on. The card page and the profile page compose the job board's own pieces.
- The card's jobs section reuses the existing link form; with a source already linked it shows what is linked and
  links to Your company's jobs to manage it.

## Acceptance (verifier, demo mode and made-up data, 390 and 1280 px)
A founder links from their card and the jobs appear; the chip and the Hiring filter work; the profile list links
out; Today's card shows new jobs; with the board off nothing shows.

## Tests
`src/modules/job-board/job-board.test.ts` (the company jobs read, the hiring lookup, new this week),
`src/modules/members/members.test.ts` or the directory test (the Hiring filter, off ignores it), lint, typecheck,
architecture tests.
