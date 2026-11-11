---
id: jobs-on-cards
status: building
waits-on: []
size: medium
---
# Spec: jobs on member cards, profiles, the directory and Today

**Added:** 2026-11-11 (the owner's build plan; approved scope in `CHARTER.md`)

## What & why
A founder's open jobs used to live only on the Jobs pages. Now they show where members already look: the founder's
card, every profile at that company, the directory and Today. Only while the job board is on.

## What it does now
- **Your card** (`/members/card`): a "Your company's jobs" section. Nothing linked: the careers-link form (the same
  link and rules as Jobs › Your company's jobs, one source per link). A founder with no company on the card is asked
  to add it first. Something linked: what is linked, its job count, and a link to manage it.
- **A profile**: "Open jobs at <company>": up to 5 jobs with title, place and Apply (opens the hiring tool in a new
  tab), then "See all N jobs" to the board filtered to the company. Hidden when the company has no open jobs.
- **The directory**: a "Hiring · N jobs" chip on each card whose company has open jobs, and a "Hiring now" filter
  (`?hiring=1`).
- **Today**: "New jobs this week": jobs posted in the last 7 days, or first seen then when the tool gives no date,
  up to 5, then a link to the board. Hidden when there are none. The weekly email doesn't include it.
- With the job board off none of this shows, and a stale `?hiring=1` is ignored and dropped.
- A company's jobs: listed jobs (source not hidden, linked by an active member) whose source company matches the
  member's company on show, ignoring case and outer spaces. So a co-founder at the same company shows them too.
