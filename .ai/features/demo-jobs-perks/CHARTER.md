# Charter: the demo shows the job board and perks

Approved scope (the owner's build plan for the Founderhall → Community merge, wave 1).

## Direction
Demo mode today switches the job board, perks, Slack/Discord and the feed off, so a buyer never sees the job board
or perks. Change demo mode so:

1. The job board is on, with made-up jobs already in it: four founders of made-up companies have a careers link
   saved (made-up example.com addresses), each with 2–5 jobs seeded as if pulled. The hourly pull never reaches out:
   in demo mode it skips cleanly, keeps the seeded jobs and shows no error. The public board and the website widget
   are on too.
2. Perks is on. The perks page supports only the BuiltFirst embed, so in demo mode it shows a placeholder list of
   made-up perks instead, labelled demo. No BuiltFirst frame in the demo.
3. The feed and Slack/Discord stay off.
4. The nightly reset restores all of the above.

Out: the Today perks card (it stays tied to a saved marketplace), any change outside demo mode.

## Deciding facts
- Founders with jobs: Sam (Tallyhealth), Priya (Ledgerline), Amara (Kilnworks), Ravi (Stackwise); their company
  logos already come from the demo's profile fill-in.
- Seeded sources use a real hiring-tool name (so the cards read like a linked tool) with an example.com careers link;
  the job links are example.com too.
- In demo mode every pull (hourly, Pull now, a new link) returns without fetching and without saving an error.

## Acceptance (verifier, demo mode, 390 and 1280 px)
Jobs appears in the menu with the seeded jobs and company logos; "Your company's jobs" shows Sam's company's link and
jobs; the public board loads; Perks shows the made-up list; no outbound call happens; after a reset everything is back.

## Tests
`src/shell/demo.test.ts` (seed + reset), `src/modules/job-board/job-board.test.ts` (demo pull skip), lint, typecheck,
architecture tests.
