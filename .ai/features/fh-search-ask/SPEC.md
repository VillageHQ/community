---
id: fh-search-ask
status: in-progress
waits-on: [fh-foundation]
touches: ["src/app/(app)/search/", "src/app/(app)/ask/", "src/app/(app)/intros/new/", "src/app/(app)/me/network/", "src/modules/network/", "src/shell/intro-*", "src/shell/guided-ask.tsx", "src/modules/intros/email.ts"]
---
# Spec: Founderhall's Search and asking for an intro (transplant area 2)

**Added:** 2026-11-11 (the owner's decision: keep Community's engine, copy Founderhall's screens exactly).

## What it does
- **Search** (`/search`; `/network` redirects for good): "Who are you trying to reach?", In our network | Everywhere,
  example searches, "Paths come from N members who share their network so far." (+ "Connect yours…" before the member
  connects). Members matching the words first ("Member", "See Marcus’ profile"), then each person with the warmest path
  through a sharing member and its warmth word, "Ask Marcus for an intro", or "You already know Alex: reach out
  yourself". Nobody found: "Ask the community" and "Search everywhere". Without Village: member profiles only.
- **The intro ask is a page**, not a dialog: one note from a search result (`/search/ask`, Search lit), the three-part
  forwardable note from a profile (`/intros/new?via=<member>`), with the weekly allowance, the Through card, the note as
  the email the member gets, the character count and "How an intro works".
- **The guided ask** (`/ask`, Intros lit): what you need (four need cards) → who → the best way in (people you already
  know, then the warmest path) → the note. No path: post it as an ask.
- **My network** (`/me/network`): the connect screen (what members see, where it is processed, who introduces whom,
  the sharing choice, Connect), the sync screen, "Your network is connected", and Community's own LinkedIn and leave
  settings.
- **The email to the connector** is Founderhall's, word for word: "Marcus, would you introduce Sam Lee to Rosa
  Lindqvist?", the note to forward, three answers, the reply line.

## Not in it
The intro tracker and its "Asked." flash (area 3), the profile page around the ask button (area 4), the Asks composer
(area 1), the console.

How it works: [NOTES.md](NOTES.md). Approved scope: [CHARTER.md](CHARTER.md). Side-by-side pairs: [reports/pairs](reports/pairs/README.md).
