---
id: asks-board-tools
status: built
waits-on: []
size:
touches: ["src/modules/asks/"]
checks: []
priority: 1
score: 1.5
scored: 2026-11-10
basis: e95a9f.01bcc5
---
# Spec: Asks board tabs, search, pin and reopen

**Added:** 2026-11-10 (from the Founderhall parity map in `.ai/roadmap.md`)

## What & why
Founderhall's board had Open / Updates / Yours / Answered / All tabs, a search over asks and answers, reopen, and admin pin and unpin.

## Rough scope
Answered and All tabs, text search, reopen, admin pin. (Merge plan: "Ask answers, tabs, answered/reopen, pin, stats: port into the Asks module".)

## Open questions
- None known.

## Update 2026-11-11: built (asks-tools)
Tabs Open, Mine, Answered, Closed; one search over every ask and its answers, closed ones too; admins pin up to 3
open asks; the author or an admin reopens a closed ask; both audited. Founderhall's separate "answered" status was
left out: an ask here closes with an outcome. How it works: `.ai/features/asks-tools/NOTES.md`; the approved scope:
`.ai/features/asks-tools/CHARTER.md`.
