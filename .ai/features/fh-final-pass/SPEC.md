---
id: fh-final-pass
status: in-progress
waits-on: [fh-foundation, fh-dark, fh-today-asks, fh-search-ask, fh-intros, fh-directory-profile, fh-inbox-jobs-perks, fh-console, fh-setup-plumbing, fh-public-signin]
touches: ["src/proxy.ts", "src/shell/gone-links.ts", "src/app/(app)/", "src/app/i/", "src/app/intro/optout/", "src/app/invite/", "src/modules/intros/email-target.ts", "src/shell/ask-helpers.ts", "src/platform/design/accent.ts", "src/app/globals.css", "src/shell/demo-seed.ts"]
checks: ["src/proxy.test.ts", "src/modules/intros/intros-consent.test.ts", "src/shell/email-replies.test.ts", "src/platform/design/accent.test.ts"]
---
# Founderhall transplant, round 4: the whole-app check and the fix pass

What it does now: every one of Founderhall's 153 screens was retaken from Community at 1280 and 390 px and put beside
Founderhall's by checkers who built nothing; the differences they found were fixed in two repair rounds. The owner's
review set is `reports/PAIRS.md` (each pair, its verdict and any kept difference); the first check is
`reports/verdicts.md`.

The fixes, in what members and admins see:
- Not-found pages inside the app answer 404 with "That page isn't here"; bad intro and opt-out links answer 404 with
  "This link doesn't work. It may be old or cut short."; bad sign-in and invite links answer 410.
- A bad invite link tells the invitee to ask whoever invited them for a new invite ("Already joined? Sign in.").
- The introduction after a double yes always goes through the outbox; without replies by email, the asker and the
  person each get a copy whose reply goes to the other.
- A posted ask finds the member who can help again, with how well they know the person.
- My profile carries Founderhall's "Our jobs" sheet (`/me#jobs`); `/jobs/yours` forwards there. The old "Credit me in
  reports" switch is gone.
- The intro-ask pages say that the community's admins see names, states and dates (the owner's decision).
- Your data selects "The community's default" for a member who never chose who can message them.
- The look: the demo's Northwind logo tile, Founderhall's sidebar line heights, the 6 px under a page head's small
  line, the default fund colour (spine green), dark mode printing in light colours, the Settings preview in dark,
  one-line intro-log pills, wrapped addresses, a square Message icon.

Left and owner decisions: `reports/PAIRS.md` and the pull request.
