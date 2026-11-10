---
id: demo-jobs-perks
status: building
waits-on: []
size: small
---
# Spec: the demo shows the job board and perks

**Added:** 2026-11-10 (the owner's build plan; approved scope in `CHARTER.md`)

## What & why
Demo mode used to switch the job board and perks off, so a buyer never saw them. Now the demo shows both, with
made-up content, and still sends nothing outside the server.

## What it does now
- The job board is on: four made-up founders (Tallyhealth, Ledgerline, Kilnworks, Stackwise) have a careers link on
  example.com and 2–5 jobs each, seeded as if a pull found them. The public board and the website widget are on.
- In demo mode no pull fetches: the hourly job does nothing; Pull now and a new link say it's a demo and keep the
  jobs shown, with no problem saved.
- Perks is on: `/perks` lists six made-up deals, labelled demo, and never frames BuiltFirst. The admin page says so.
- The feed and Slack/Discord stay off. The nightly reset restores all of it.

How it works: `NOTES.md`.

## Open questions
- A source a visitor links in the demo shows "0 open jobs. Not checked yet." until the nightly reset.
