# Charter: Founderhall console screens on Community (fh-console)

Approved scope (the owner's transplant plan, round 3, area 6). Community keeps its engine; the console screens
become Founderhall's screens exactly: structure, sections in order, parts, words, look and steps.

## In
- **Home** `/admin`: the live dashboard (asked/made/declined headline, Every intro counted, Members, Latest in the
  intro log, Members who connected their network, Lookups this month, Asks & updates, Mail) and, before launch,
  the four-step launch checklist (moved here from `/admin/setup`).
- **Partner report** `/admin/report`: period switch, Send to partners, CSV, PDF, the printable document; sending
  becomes its own page `/admin/report/send` with the email preview.
- **Intro log** `/admin/intros` (new): period switch, CSV, state chips, the log table, the "Asks a week" limit form.
- **Members** `/admin/members`: filter chips, search, one table with status pills and Resend; Community-only tools
  (manage, remove, free up a LinkedIn profile) kept and restyled with Founderhall's parts.
- **Invites** `/admin/invites` (new): one textarea for many people, profile fill-in consent cards, Send invites,
  Waiting to sign in with Resend, the invite email preview. Community-only Revoke and cohort kept.
- **Asks & digest** `/admin/asks` (folds in `/admin/weekly-email`): tiles, The weekly digest settings, Every ask and
  update with Pin / Close / Remove; digest preview page with member picker and test send.
- **Job board** `/admin/jobs`: public board switch, public link, linked boards; embed snippets kept.
- **Emails** of this area word for word: the invite, the partner report, the digest test.
- Old routes keep working through permanent redirects; links in emails follow.

## Rule kept until the owner decides
Admins see intro states, dates and counts, never who asked whom. The Intro log, Home's "Latest in the intro log"
and the report follow Founderhall's layout, but names sit behind ONE named constant
(`ADMIN_SEES_INTRO_NAMES` in `src/modules/admin/intro-privacy.ts`); switching it is a one-line change.

## Out
Set up and its plumbing pages (another area), the member screens, sign-in and public pages.

## Proof and acceptance
Every acceptance shot of the area retaken from Community at 390 and 1280 px beside Founderhall's shot, saved in
`reports/`; a verifier who did not build it lists every difference; done = none except community data.
Tests, lint, typecheck and the architecture tests green.
