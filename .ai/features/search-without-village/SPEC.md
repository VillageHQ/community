---
id: search-without-village
status: idea
waits-on: []
size:
touches: ["src/modules/network/", "src/modules/members/"]
checks: []
priority: 1
score: 1.5
scored: 2026-11-10
basis: e95a9f.95895c
---
# Spec: Search and Village fallbacks

**Added:** 2026-11-10 (from the Founderhall parity map in `.ai/roadmap.md`)

## What & why
Founderhall searched member profiles when there was no Village key or no path, cached search results for 10 minutes, filtered the directory by city, and cancelled the Village user on disconnect.

## Rough scope
Member-profile search with no key or no path, a 10-minute search cache, a city filter, and `user/cancel` on disconnect. (Merge plan: "Disconnect: CM leave + FH user/cancel + token delete"; "add FH 10-min search cache".)

## Open questions
- None known.
