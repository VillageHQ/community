# Job board

Founders show their companies' open jobs. A member links the company's hiring tool by pasting its careers link, or adds jobs by hand; the app reads the tool's public job feed (no key) every hour. Toggleable, off by default, needs no Village account. The id is `job-board` so it doesn't read like the platform's timed-jobs runner.

- `manifest.ts`: identity, nav entry, the admin tab and owned paths (`/jobs`, `/admin/jobs`, `/public/jobs`, `/api/job-board`, `/api/admin/jobs`). `integration.ts`: the pull job.
- `contract.ts`: paths, limits, the 12 tools, Zod schemas, shapes, `toCompanySlug`. Client-safe.
- `schema.ts`: `job_source` (one linked tool or a "manual" source) and `job_posting`.
- `rules-feeds.ts`: one reader per tool: find the board's name in a link, build the feed address, map its jobs. Pure.
- `service-pull.ts`: `fetchBoard` (15 s, 2 MB cap, Ashby 20 MB, one redirect inside the tool's domain, plain-word `FeedError`), `pullSource`, and `pullDueSources`, which the job runner calls every 5 minutes.
- `service.ts`: link, add by hand, pull now, hide, remove, the public switch. `reads.ts`: the boards, the companies, the sources.
- `reads-hiring.ts`: a company's jobs for a profile, the directory's hiring count (`companyJobCountColumn`), Today's new jobs. `components/shared/`: the profile and Today cards.
- `rules-widget.ts`: the website widget's script, the frame's script, the frame's HTML and headers, the embed snippets.
- `components/`: the UI.

Rules:

- Only the board's name comes from a pasted link. The address fetched is always the tool's own feed host, so a link never makes the app fetch an address of the founder's choosing. `JOB_FEEDS_FAKE_ORIGIN` points every feed at a fake server; it is for tests and local proof, and is ignored when `NODE_ENV` is `production`.
- A pull that works replaces the pulled jobs. A pull that fails keeps the last good jobs and saves its problem in plain words on the source. Jobs added by hand (`is_manual`) are never touched by a pull.
- Each source is pulled at most once an hour by the job, and Pull now at most once a minute.
- The member who linked a source pulls, hides, removes and adds by hand. An admin may pull and hide any source, never remove it or add to it.
- One source per careers link (tool and board name, without case) in the whole community, checked under a lock, so no job shows twice. A founder links or adds jobs only for the company on their card; an admin may add any company.
- Every board reads only sources that aren't hidden, from founders who are active members (`isActiveMember`).
- The public board, the widget's frame (`/api/job-board/embed`) and `readPublicJobs` show only company, title, location and the apply link: never who shared it. They answer 404 until an admin turns the public board on.
- The frame is the only response any site may frame: `next.config.mjs` skips the framing headers for that one path and gives it `frame-ancestors *`. It reads no session and sets no cookie. Keep it that way.
- A job's link is shown only if it starts with http:// or https://.
- A new tool: its reader, a sample feed trimmed to 3 jobs in `src/test/fixtures/jobs/`, and two links in `job-board.test.ts`.
