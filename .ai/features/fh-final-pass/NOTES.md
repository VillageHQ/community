# How round 4's fixes work

- **404 and 410.** The app has no shared loading screen any more (`(app)/loading.tsx` and `inbox/loading.tsx` were
  removed): a page that streams under a loading boundary answers 200 before `notFound()` runs. Now every in-app
  `notFound()` answers a real 404 with `(app)/not-found.tsx`. Public bad links render their own words from a
  `not-found.tsx` beside the page (`app/i/[token]/`, `app/intro/optout/[token]/`). A page can't set 410 and a rewrite
  can't carry a status, so `proxy.ts` asks `shell/gone-links.ts` whether `/auth` or `/invite` carries a used, expired
  or unknown token (read only), then fetches that page itself (with the visitor's headers, so the invite rate limit
  counts their address) and answers its body with 410.
- **The introduction email.** `sendJoiningEmail` (`modules/intros/email-target.ts`) never calls Resend directly. With a
  reply signer: three copies on the intro thread. Without: the person's copy is sent now (a failure falls back to the
  connector's hand-made intro), the asker's is queued and sent (a failure stays queued for the timed sender). Each
  replies to the other person (`replyTo`).
- **Asks finding helpers.** `findPersonToReach` (`shell/ask-helpers.ts`) picks the first search result who isn't a
  member, isn't known first-hand by the author, and has a way in through a member; the helper's warmth comes from that
  result's ways in.
- **Our jobs** is `OurJobsSection` (job-board module) rendered on `/me`; `JOB_BOARD_PAGES.ours` is `/me#jobs`.
- **Your data** gets `followsCommunityDefault` from `readPrivacy`, so a member who never chose sees "The community's
  default" selected.
- **Print.** `globals.css` ends with a print block that puts the light tokens back under `.dark`;
  `renderAccentCss` adds the light fund colours for print.
- **Demo logo.** `public/demo/northwind-logo.svg`, set as the `logoUrl` setting by the demo seed.
- **The check itself** ran from `.ai/tmp/check/` (not committed): `lib.mjs` (one production server at a time behind a
  lock, sign-in as any demo person with a one-minute link, full-page shots with the demo strip hidden, Founderhall |
  Community pairs) and one capture script per group.
