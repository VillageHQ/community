---
id: declined-connector-paths
status: building
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
- Settled by fix-intros: left out, after either kind of no (the connector's or the person asked's), so the asker
  can't tell who said no. See `.ai/features/fix-intros/CHARTER.md`.
