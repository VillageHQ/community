---
id: site-signup
status: idea
waits-on: []
size:
touches: ["site/"]
checks: [moving-part]
priority: 1
score: 1
scored: 2026-11-10
basis: e95a9f.870f39
---
# Spec: Managed-plan sign-up on the website

**Added:** 2026-11-10 (from the Founderhall parity map in `.ai/roadmap.md`)

## What & why
Founderhall's site had a sign-up form for the managed plan, a confirmation email, anti-abuse limits and a CSV export of sign-ups, and its server sent nosniff and frame-ancestors headers. The one-website build keeps `site/` static and leaves the form out.

## Rough scope
A sign-up form for the managed plan with its confirmation email, limits, export and those headers, once there is a server for it.

## Open questions
- Where does the form post to, given `site/` is static?
