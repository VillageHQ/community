---
id: perks-menu-csp
status: idea
waits-on: []
size:
touches: ["src/modules/perks/"]
checks: []
priority: 2
score: 1
scored: 2026-11-10
basis: e95a9f.179451
---
# Spec: Perks menu link loads the page fully

**Added:** 2026-11-10 (from the Founderhall parity map in `.ai/roadmap.md`)

## What & why
Opening Perks from the in-app menu uses client-side navigation, so the Perks page's own security policy (set per route in `next.config.mjs`) never applies there. The Today card and the admin link already use a full page load.

## Rough scope
Make the menu entry a full page load, like the Today card.

## Open questions
- Is a full page load the right fix, or should the frame be guarded another way?
