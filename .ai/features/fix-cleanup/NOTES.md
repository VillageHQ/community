# How the cleanup fixes work

- **List cohort.** `POST /api/admin/invites/bulk?format=list&cohort=…`: `readListCohort` (`members/contract-bulk-invites.ts`)
  checks it with the single invite's cohort rule (`createInviteBodySchema.shape.cohort`) and drops formula
  characters; `parseBulkInvites(format, text, listCohort)` puts it on every listed person. A CSV ignores it (each row
  has its own column). The sheet sends it through `createBulkInvitesRequest(format, body, cohort)`.
- **Hiring line.** `reads-hiring.ts`: `isMembersJob` = same company (case and spaces ignored) OR `job_source.member_id`
  is the member. `companyJobCountColumn(company, memberId)` and `readCompanyJobs(db, { company, memberId })` use it;
  the directory's `HiringLookup.jobCountColumn` now takes the member id column too. The profile still shows the jobs
  card only when the card has a company.
- **Feed note.** The composer calls `announce("")` before each `createPost.mutate`, so the shared status line never
  holds a success next to a new error. The tab: `tabLabel: "Feed"` on the feed's menu entry; the bar carries
  `data-count`, and `parts.css` makes the labels 10 px at 8 columns.
- **Intro panel.** `ConsentLinkPanel` keeps a `sentAt` set by `EmailLinkForm`'s success and reads `sentAt ??
  intro.targetEmailedAt`. Dates in `connector-follow-up.tsx`, `consent-link-panel.tsx` and `intro-parts.tsx` use
  `formatDayMonth` ("12 Nov", UTC), the console's style.
- **Website.** `readPlanPrice` in `site/assets/site.js`; `src/test/site-signup.test.ts` runs the page's own script
  in jsdom.
