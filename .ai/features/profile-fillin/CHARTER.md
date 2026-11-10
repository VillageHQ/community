# Profile fill-in and spending caps: charter

Approved scope: the owner's build plan for merging Founderhall's strengths into Community (wave 2). The maintainer
agreed and reviews after merge. This page restates that brief; it is the scope of this build.

## Direction

Members' cards start empty, admins can't cap what the whole community spends on Village, and a search that finds
nobody is a dead end. This build fills cards from public profiles (only with a legal basis), caps monthly spending,
and turns an empty search into an ask.

In:

1. **Profile fill-in from Village.** A member is looked up by email first, then refreshed by LinkedIn every 30 days,
   nightly through the job runner, and on demand with a "Fill in now" button. It stays off until an admin records the
   legal basis: a terms date ("members agreed in our terms"), or "ask each member at sign-in". Each member can choose
   "Don't look me up". Filled-in lines are stored apart from the member's own words, and the member's own words always
   win. A filled-in line shows "from public profiles" with a date, and the member can hide any of them; a hide
   survives every refresh. A face or company logo from fill-in is used only when the member has no uploaded photo.
2. **"What Village receives"** — a plain disclosure in the member's privacy area on their card page.
3. **Spending.** A community-wide monthly cap in estimated credits, enforced with the same atomic reservation as the
   daily limit (parallel requests can't pass it). Admins get one email at 80% and one at 100%, through the outbox.
   Meters on the Credits page.
4. **Empty search.** When nobody has a path, offer "Ask the community" with the ask prefilled. Admins can nudge
   unconnected members to connect, at most once per 30 days per member, through the outbox. The connect meter counts
   members who are connected and accept intro asks.

Out: bulk LinkedIn refresh (one call a member is enough at community size), company enrichment, a full "download my
data" export, filled-in words in directory search.

## Deciding facts (assumptions)

- **The SDK has no email lookup.** `people.enrich` takes a LinkedIn address only. The email lookup calls Village's
  documented `POST /v2/people/enrich/by-email` through the SDK's own typed client (`village.api`), so it keeps the
  same key, fetch guard and error logging. Noted in the PR.
- **Lookups use a "public" grant identity**, never a member's own Village identity, so a lookup doesn't create a
  Village user. Its email is the first admin's.
- **Credit estimates:** a search 11, a set of paths 5, one fill-in 1 (Village charges a fill-in only when it fetches
  live; a miss is free). The cap reserves before the call and gives back what wasn't charged.
- **"Connected and accepts intro asks"** in this app means: synced, in the community group (so others can ask them),
  confirmed email, and active.
- **The nudge** is an optional email under a new "Network reminders" topic, so a member can turn it off.

## Picks (small, reversible)

- Default monthly cap: 7,500 credits (about $150), the figure Founderhall uses; the admin changes it on Credits.
- Months are UTC calendar months, like the daily limit's UTC days.
- "Don't look me up" also deletes the lines already filled in.
- With "ask each member", the question shows on the home page and the card page until the member answers.
- Fill-in costs never count toward a member's daily lookups; they count toward the monthly cap.
- "Fill in now" for a member: at most once an hour. The admin's "Fill in everyone now" runs the nightly job at once.
- Filled-in face and logo are shown from Village's https address with no referrer.

## Journeys and tests

- Profile, card and privacy: route tests against a real database and the fake Village server (consent off makes no
  call; basis recorded fills in; hide survives refresh; own words win; "Don't look me up").
- Spending: parallel reservations at the cap, one 80% and one 100% email.
- Nudge: once per 30 days per member. Meter count.
- Lint, typecheck, architecture tests. Full suite in CI.

## Proof and estimate

Screenshots at 390 and 1280 px of the card page with filled-in lines, the Credits meters and the empty-search ask;
real test output for the cap and the nudge. Build about 7 hours, tests about 2 hours.
