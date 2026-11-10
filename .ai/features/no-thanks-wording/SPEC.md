---
id: no-thanks-wording
status: building
waits-on: []
size:
touches: ["src/modules/intros/"]
checks: []
priority: 2
score: 1
scored: 2026-11-10
basis: e95a9f.32e50b
---
# Spec: "No thanks" link keeps its own answer

**Added:** 2026-11-10 (from the Founderhall parity map in `.ai/roadmap.md`)

## What & why
A person who said "no thanks" on one intro link and later stopped all intro asks sees "You've stopped intro requests" when they open the first link again.

## Rough scope
The first link shows the answer given on it.

## Open questions
- None known. Built by fix-intros: the answer is saved on each intro (`target_answer`), and the first link says
  "no thanks", then the later stop as a later step.
