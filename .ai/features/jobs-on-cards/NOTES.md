# How jobs show on cards, profiles, the directory and Today

- Reads: `src/modules/job-board/reads-hiring.ts`. `readCompanyJobs` (profile), `readNewJobs` (Today, by
  `coalesce(posted_at, first_seen_at)` within 7 days) and `companyJobCountColumn`, a subquery the directory adds next
  to each member. All three match `lower(trim(company))` and list only sources that aren't hidden, from active members.
- `job_posting.first_seen_at` (migration 0028): set on insert, never by a pull's upsert. Existing rows took their
  source's `created_at`, so the upgrade didn't make every job "new".
- The directory: members can't import the job board, so `readDirectory` takes an optional `HiringLookup`;
  `src/shell/directory-hiring.ts` returns it while the board is on, and both `/members` and
  `POST /api/members/directory` pass it. `Directory.isHiringShown` tells the client to show the filter.
- UI: `job-board/components/shared/company-jobs-card.tsx` (profile), `shared/new-jobs-card.tsx` (Today, passed into
  `TodayList` as `newJobs`, not part of `TodayItems`, so the weekly email is unchanged),
  `components/card-jobs-section.tsx` (card page, reuses `LinkSourceForm`).
- Tests: `src/modules/job-board/job-board.test.ts` (company jobs, the hiring count and filter on and off, new this
  week), `src/modules/members/profile-rules.test.ts` (the `hiring` URL param).
