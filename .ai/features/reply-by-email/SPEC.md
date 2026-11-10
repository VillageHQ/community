---
id: reply-by-email
status: idea
waits-on: []
size:
touches: ["src/app/api/email/", "src/modules/messages/", "src/modules/intros/", "src/modules/asks/"]
checks: [novel]
priority: 1
score: 2
scored: 2026-11-10
basis: e95a9f.bd705f
---
# Spec: Reply by email beyond the weekly email

**Added:** 2026-11-10 (from the Founderhall parity map in `.ai/roadmap.md`)

## What & why
Founderhall let members answer direct messages, intro threads (with the person asked as a guest) and asks by replying to the email, and the connector reply YES or NO. Here only the weekly email can be answered by reply, through Resend only.

## Rough scope
Reply by email for direct messages, intro threads with outside guests, ask answers and helper replies, and the connector's YES/NO; inbound from Postmark and raw MIME as well as Resend, with a shared-key option. (Merge plan: "DM email alerts + reply by email: port", "inbound (Resend/Postmark/MIME)".)

## Open questions
- How do outside guests join an intro thread without an account?
