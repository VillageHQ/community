---
id: fh-foundation
status: in-progress
waits-on: []
touches: ["src/app/globals.css", "src/app/parts.css", "src/app/layout.tsx", "src/app/fonts.ts", "src/components/", "src/shell/app-shell.tsx", "src/shell/navigation*", "src/shell/user-menu.tsx", "src/shell/admin-tabs.tsx", "src/platform/design/"]
---
# Spec: Founderhall's look and shell on Community (the transplant's foundation)

**Added:** 2026-11-11 (the owner's decision: keep Community's engine, copy Founderhall's screens exactly).

## What it does
Every screen takes Founderhall's tokens, fonts, type, radii and shadow. The shared parts in `src/components` match
Founderhall's parts one for one. The shell is Founderhall's: a 264 px sidebar with the member menu (Today · Asks &
updates · Search · Directory · Jobs · Intros · Inbox · [Perks] · My profile) or, for an admin under /admin, the
console menu (Home · Partner report · Intro log · Members · Invites · Asks & digest · Job board · Set up) with a
Console | View as a founder switch and a founder-view strip; a phone top bar and bottom tabs; the source link on member
pages and the product credit on the console and sign-in. A flash note after an action replaces toasts. The fund's
colour follows Founderhall's 4.5:1 rule. A test page (/parts, off unless SHOW_PARTS_PAGE=true) shows each part beside
Founderhall's crop.

## Not in it
The page bodies (eight areas follow), route renames, the new console pages (Intro log, Invites, the Set up list),
emails. Dark mode stays as a switch on Your data until the owner decides.

How it works: [NOTES.md](NOTES.md). Approved scope: [CHARTER.md](CHARTER.md).
