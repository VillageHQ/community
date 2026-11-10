---
id: intros-from-profile
status: idea
waits-on: []
size:
touches: ["src/modules/intros/", "src/app/(app)/members/"]
checks: [novel]
priority: 1
score: 2
scored: 2026-11-10
basis: e95a9f.4a63d6
---
# Spec: Intros from a profile, and the finer intro rules

**Added:** 2026-11-10 (from the Founderhall parity map in `.ai/roadmap.md`)

## What & why
Here intros start only from network search paths and need Village. Founderhall let a member ask for an intro from a member's profile with no Village, showed "Who X can introduce you to", gave each step 7 days, let the admin set the outcome-question day, kept an event history per intro, and put the connector on the joining email.

## Rough scope
Ask from a profile without Village (merge plan revision 6), "Who X can introduce you to", 7 days per step, the outcome-day setting (default 14), an event history on the intro page, the connector on the joining email.

## Open questions
- How does an intro from a profile pick its target with no path data?
