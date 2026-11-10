---
id: slack-ask-slow-reply
status: idea
waits-on: []
size:
touches: ["src/shell/slack-ask.ts"]
checks: [severe]
priority: 2
score: 2
scored: 2026-11-10
basis: e95a9f.0857ed
---
# Spec: Slack /ask follow-up when posting is slow

**Added:** 2026-11-10 (from the Founderhall parity map in `.ai/roadmap.md`)

## What & why
Slack waits 3 seconds for a slash command's answer. When posting the ask takes longer, the member gets no answer in Slack.

## Rough scope
Answer at once, then send a follow-up message to Slack when the ask is posted (or fails).

## Open questions
- None known.
