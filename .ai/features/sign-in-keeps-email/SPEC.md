---
id: sign-in-keeps-email
status: idea
waits-on: []
size:
touches: ["src/app/sign-in/"]
checks: [pain, severe, pain-seen]
priority: 2
score: 3.75
scored: 2026-11-10
basis: e95a9f.63025a
---
# Spec: Sign-in keeps the typed email

**Added:** 2026-11-10 (from the Founderhall parity map in `.ai/roadmap.md`)

## What & why
On `/sign-in`, switching to "Sign in with a password instead" clears the email already typed, and the empty field then blocks sign-in with no message.

## Rough scope
Carry the email across both forms; an empty field says what is missing.

## Open questions
- None known.
