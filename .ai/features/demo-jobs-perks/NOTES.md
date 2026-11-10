# How the demo's jobs and perks work

- Made-up data: `src/platform/demo/jobs.ts` (the four sources and their jobs, example.com links) and
  `src/platform/demo/perks.ts` (the deals and the demo note).
- Seeding: `seedJobs` in `src/shell/demo-seed.ts` inserts each `job_source` (a real tool name, the example.com careers
  link, last pulled an hour ago) and its `job_posting` rows; `seedSettings` turns the job board, perks and the public
  board (`job_board_public`) on, and the feed and chat off. The reset re-runs the seed.
- No outbound pull: `pullSource` and `pullDueSources` in `src/modules/job-board/service-pull.ts` return early in demo
  mode. `pullSource` returns `{ ok: true, count: 0, note: DEMO_PULL_NOTE }`; `linkSource` and `pullSourceNow` show
  the note. The outbound fetch guard (`src/platform/demo/outbound.ts`) stays as a second wall.
- Perks: `src/app/(app)/perks/page.tsx` renders `DemoPerksList` (`src/modules/perks/components/demo-perks-list.tsx`) in
  demo mode, before checking for a saved marketplace. The Today perks card still needs a saved marketplace, so it is
  not shown in the demo.
- Tests: `src/shell/demo.test.ts` (seed, reset, and the pull that never fetches).
