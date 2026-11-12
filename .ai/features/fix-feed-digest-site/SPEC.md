---
id: fix-feed-digest-site
status: in-progress
waits-on: []
touches: ["next.config.mjs", "src/modules/feed/manifest.ts", "src/shell/demo-seed.ts", "src/shell/today.ts", "src/shell/weekly-email-compose.ts", "src/shell/weekly-email-answers.ts", "src/shell/weekly-email.ts", "src/platform/weekly-email/reply-codes.ts", "src/app/weekly/page.tsx", "src/app/api/email/weekly-answer/route.ts", "src/app/api/email/unsubscribe/route.ts", "src/modules/members/components/member-directory.tsx", "site/"]
checks: ["src/modules/feed/feed-reachable.test.ts", "src/shell/weekly-email.test.ts", "src/modules/members/components/member-row.test.ts", "src/shell/demo.test.ts", "src/shell/disabled-modules.test.ts"]
---
# Fix build: feed, weekly email, jobs on cards and the website (parity audit, 2026-11-12)

What it does now:
- **The feed opens from the menu and is on where no admin chose** (the owner's call). `/feed` is no longer sent to
  Today. An admin's "off" is kept; off, `/feed` answers 404 as before. The demo has the feed on with four made-up posts,
  a reply and reactions.
- **The weekly email numbers lines filled in from public profiles** after the asks and intros, each with Right / Hide it
  / Fix it links and, when replies work, "Or reply RIGHT n · HIDE n · FIX n your own words". By link or reply: RIGHT
  marks the line right, HIDE hides it (it stays hidden on refresh), FIX puts the member's own words on the card (the
  first line after the code, or the link page's field). FIX with no words changes nothing, keeps the item open and
  sends one hint email. Each item is answered once.
- **The link page says what was done.** After the button the page reads "Done" and the answer in Founderhall's words.
  The button's redirect goes back by path, so it works whatever address the server sees itself under; the one-click
  unsubscribe page's button does the same.
- **A hiring founder's directory card says "Hiring · N open jobs"** (the profile already listed the jobs).
- **The website (`site/`) has Founderhall's price table and its sign-up form.** The form checks its five fields in
  Founderhall's words and posts JSON only to the address in `data-endpoint`; that is empty, so a valid submit sends
  nothing and says "Nothing was sent". Without JavaScript the form doesn't show. Nothing is deployed.

Proof: `reports/` (screens at 390 and 1280 px) and `reports/check/CHECK.md` (the independent check, row by row).
