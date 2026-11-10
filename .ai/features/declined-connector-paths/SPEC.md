---
id: declined-connector-paths
status: idea
waits-on: []
size:
touches: ["src/modules/network/"]
checks: [pain-seen]
priority: 2
score: 1.5
scored: 2026-11-10
basis: e95a9f.8c36f3
---
# Spec: A connector who said no leaves the paths list

**Added:** 2026-11-10 (from the Founderhall parity map in `.ai/roadmap.md`)

## What & why
After a connector says no to an intro, they still show as a way in on the asker's paths list for that person.

## Rough scope
Leave them out of that asker's paths for that person (or mark them), without telling the asker who said no.

## Open questions
- Leave out, or show as already asked?
