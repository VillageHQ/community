---
id: fix-intros
status: building
waits-on: []
size: medium
touches: ["src/modules/intros/", "src/modules/network/", "src/app/meet/", "src/app/api/intros/consent/answer/"]
checks: [pain-seen]
---
# Spec: intro fixes from the final check

**Added:** 2026-11-10 (from the merged app's final reliability check)

## What & why
Five intro gaps found by the final check: a no with an empty note failed; a yes on a forwarded link never joined the
two people; unanswered intros went quiet; a connector who said no still showed as a way in; and a "no thanks" link
later said "stopped intro requests".

## What it does now
- A no with an empty private note works.
- A yes on a forwarded link asks for the person's email (when email is on) and sends the one joint email to both.
- One reminder to a connector who hasn't answered after 4 days; one kind email to the asker when an intro expires.
- An ask that ended in a no hides that connector from that asker's paths to that person.
- Each link shows the answer given on it; a later stop-all is mentioned as a later step.

How it works: `NOTES.md`. Scope and decisions: `CHARTER.md`.
