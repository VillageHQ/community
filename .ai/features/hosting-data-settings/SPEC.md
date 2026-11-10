---
id: hosting-data-settings
status: building
waits-on: []
size: small
touches: ["src/app/(app)/admin/settings/", "src/app/(app)/members/data/", "src/platform/settings/"]
checks: ["src/app/(app)/members/data/data-home.test.ts", "src/shell/demo.test.ts"]
priority: 1
score: 1.5
scored: 2026-11-10
basis: e95a9f.69eb0c
---
# Spec: Hosting and data settings

**Added:** 2026-11-10 (from the Founderhall parity map in `.ai/roadmap.md`)

## What & why
Buyers ask where a community's data is kept and whom to ask about it. Founderhall's settings recorded who hosts, the
data region, the data-protection contact and a data agreement link.

## What it does now
- Settings has a "Where your data is kept" card: where the data is kept (free text, for example "EU, Frankfurt,
  DigitalOcean") and a contact for data requests (a name or role, and an email). All optional.
- A bad email is refused in plain words; a name with no email is refused too.
- When set, members see both on Your data, under "What is stored, and where", word for word; the email is a
  `mailto:` link. With nothing set, nothing about them shows.
- Demo mode fills them with made-up values (an example.com address).
- The app never guesses a region and shows no compliance badge: only what the admin typed.

## Not yet
- The data agreement link.
- A privacy or terms page (the app has none); the partner report does not show these.

## Depends on / check-ins
