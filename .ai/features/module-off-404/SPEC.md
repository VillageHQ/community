---
id: module-off-404
status: idea
waits-on: []
size:
touches: ["src/platform/modules/"]
checks: []
priority: 2
score: 1
scored: 2026-11-10
basis: e95a9f.8c8beb
---
# Spec: A switched-off module answers 404

**Added:** 2026-11-10 (from the Founderhall parity map in `.ai/roadmap.md`)

## What & why
A page of a module the admin switched off answers 200 (with an "off" notice) instead of 404 in at least one place.

## Rough scope
Find where the 200 comes from and make it 404, as the architecture tests expect for module routes.

## Open questions
- Which pages answer 200 today?
