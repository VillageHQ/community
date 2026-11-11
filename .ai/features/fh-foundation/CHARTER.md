# Charter: Founderhall transplant, round 2 — the foundation

Approved scope (the owner's brief for this build, 2026-11-11). The owner decided to keep Community's engine and copy
Founderhall's screens onto it exactly, with Founderhall as the acceptance test. This build is part 0, the foundation;
eight area builds follow it and use only its parts.

## In
- **Tokens, fonts, type, radii, shadows** exactly as Founderhall's design system: Paper, Leaf, Vellum, Side, Rule,
  Ink, Graphite, Spine, Ribbon and their tints; IBM Plex Sans (body), Source Serif 4 600 (titles and people's names),
  IBM Plex Mono (codes), all self-hosted; radius 8 / 6; one shadow; one breakpoint at 1000 px.
- **Community's existing tokens remapped** to those values, so every existing screen takes the new look before its
  area is transplanted (no screen breaks or becomes unreadable).
- **The shared parts** in `src/components` (each matching its Founderhall crop): page head and back link, buttons
  (primary / ink / secondary / quiet / sm / block), chips and tabs, segmented control, pill, tag, avatar (serif
  initials on four tints), company logo, fund mark, input / textarea / select / switch, option card, note and flash,
  sheet (card), rows, KV tiles, ledger bar, meter, stepper and step dots, empty state, public page, footer lines.
  Founderhall's part styles are carried over as one stylesheet (class names prefixed `fh-`), so the areas can build
  the larger, screen-specific parts (report, mail preview, messages, search result, need cards) from the same rules.
- **The shell**: 264 px sidebar with the member menu (Today · Asks & updates · Search · Directory · Jobs · Intros ·
  Inbox · [Perks] · My profile) and the console menu (Home · Partner report · Intro log · Members · Invites · Asks &
  digest · Job board · Set up); the Console | View as a founder switch; the founder-view strip; the phone top bar
  (fund mark + avatar → My profile) and bottom tabs (6 member tabs, 5 console tabs, plus the switch tab for admins);
  footers ("Source code (AGPL-3.0)" on member pages, the product credit on admin and sign-in pages).
- **Menu links point at Community's routes** until the areas rename them. Intro log and Invites do not exist yet:
  their addresses (`/admin/intros`, `/admin/invites`) forward to where that work lives today (the partner report,
  Members) until area 6 builds them.
- **Community-only admin pages stay reachable** under the console: Settings, Email, Village check, Credits,
  Slack and Discord, Perks, Audit log, Features and Reports light "Set up"; Weekly email lights "Asks & digest". Until
  area 7 builds the Set up list, a row of links under the page title reaches each of them (the old admin tab row,
  restyled and split by group).
- **The flash pattern**: a note at the top of the page after an action (ok or needs), replacing toasts.
- **Branding**: the fund colour maps to `--fund`, `--fund-deep`, `--fund-tint` by Founderhall's rule (darkened in
  steps of ×0.92 until 4.5:1 on Leaf; deep = ×0.75; tint = 84 % toward white).
- **A parts review page** (a test-only route, off in production) showing each part beside its crop.

## Owner-confirmed small calls
- The emailed sign-in link is the main way in, password kept below it. The sign-in page body belongs to area 8; the
  shell's public page allows it.
- Routes may be renamed to Founderhall's paths later by the areas, with redirects from the old addresses.

## Not acted on (pending the owner)
- **Dark mode.** The account menu goes (Founderhall has none), but the dark-mode switch keeps working: it moves to a
  switch row on Your data, and the new tokens get a dark variant only as far as needed so nothing is unreadable. The
  owner decides later whether it stays.

## Out
- Page bodies (Today, Search, Directory, Intros, Inbox, Jobs, the console pages, sign-in): the eight areas.
- Route renames, new console pages (Intro log, Invites, the Set up list), emails.

## Acceptance
A verifier who did not build it, at 390 and 1280 px: every part on the parts page matches its crop; the shell in
`member-today-populated`, `admin-home`, `admin-founder-view-today` and `public-signin-default` matches Founderhall
(shell and footer only); a click through every existing Community route shows no broken or unreadable page; tests,
lint and typecheck green.

## Migration
None.
