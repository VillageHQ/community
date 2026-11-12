---
id: fh-intros
status: in-progress
waits-on: [fh-foundation]
touches: ["src/app/(app)/intros/", "src/app/i/", "src/app/intro/", "src/app/meet/", "src/modules/intros/"]
---
# Spec: Founderhall's intro screens on Community (transplant area 3)

**Added:** 2026-11-11 (the owner's decision: Community's engine, Founderhall's screens copied exactly).

## What it does
Your intros lists what waits for your answer and your own asks as ruled rows, with the weekly allowance. One intro
shows the asker a tracker (asked · the connector decides · the person decides · introduced by email · was it helpful?)
and the connector a one-step answer (yes with the person's email and the note as edited, not this time, or "I don't know
them well enough"). The connector, the person asked and the asker's outcome question each answer from a link in their
email without signing in (`/i/<token>`); the person can stop all intro asks (`/intro/optout/<token>`). Every intro email
has Founderhall's words; the introduction goes to the asker, the person and the connector, and replies reach all three.
Each step has 7 days.

## Rules kept from Community until the owner decides
The asker never learns whose no it was (`REQUESTER_SEES_WHO_ANSWERED`); admins see who asked whom,
states and dates, never the note (the owner decided, 2026-11-11). Members never see each other's email addresses.

## Out
The intro ask pages (area 2), the Intro log and partner report (area 6).
