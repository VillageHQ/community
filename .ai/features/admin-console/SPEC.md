---
id: admin-console
status: idea
waits-on: []
size:
touches: ["src/app/(app)/admin/", "src/shell/admin-setup-steps.ts"]
checks: []
priority: 1
score: 1.5
scored: 2026-11-10
basis: e95a9f.8d53a6
---
# Spec: Admin console home and mail page

**Added:** 2026-11-10 (from the Founderhall parity map in `.ai/roadmap.md`)

## What & why
Founderhall's admins landed on a console home with intro counts (asked, made, declined, open), meters and waiting invites, could switch to the member view, and had a mail page with the do-not-send list, 30-day counts and a sending log, an asks page with stats and moderation, a Village "test connection" button, and a mail step in the launch checklist.

## Rough scope
The console home with counts only (never who asked whom), the founder-view switch, the mail page lists and counts, the asks admin page (open, answered, median time to first help, posts, moderation), Village test connection, the mail step in the setup checklist. (Merge plan: "Console home: FH's intro ledger home for admins; founder-view switch: port".)

## Open questions
- Which of these are still wanted now that the partner report exists?
