---
id: profile-confirm-lines
status: idea
waits-on: []
size:
touches: ["src/shell/today.ts", "src/shell/weekly-email.ts"]
checks: []
priority: 1
score: 1.5
scored: 2026-11-10
basis: e95a9f.b47122
---
# Spec: Confirm filled-in lines on Today and by email

**Added:** 2026-11-10 (from the Founderhall parity map in `.ai/roadmap.md`)

## What & why
Today has a "Check your card" card, but nothing fills it (`profileLines` is always empty), and the weekly email has no RIGHT / HIDE / FIX codes. Founderhall showed each filled-in line with Right / Hide / Fix on Today and in the digest. Its Today also had a jobs card.

## Rough scope
Fill the card from filled-in profile lines, add RIGHT / HIDE / FIX to the weekly email, and a jobs card on Today when the job board is on. (Merge plan: "Right/Hide/Fix on Today: port".)

## Open questions
- None known.
