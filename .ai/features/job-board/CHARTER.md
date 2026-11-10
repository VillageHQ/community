# Job board and website widget (approved scope)

Approved by the owner as part of the Founderhall-to-Community build plan (wave 3). This page restates the brief.

## Direction
Founders in the community show their companies' open jobs. Members see one board; the admin can open a public
board and put it on the community's own website with one script line.

In:
1. A new **Jobs** module, off by default, in Community's module system (manifest, routes, architecture tests).
2. A founder links their company's hiring tool by pasting its careers link (the board's name is detected) for the
   12 tools with a public feed and no key: Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Recruitee, Breezy,
   Rippling, Teamtailor, BambooHR, Personio, Jobvite. Or adds jobs by hand. Pull now, hide, remove. The feed
   readers come from Founderhall, with their saved sample feeds as tests.
3. An hourly pull through the job runner. A failed pull shows its problem in plain words and keeps the last good
   jobs; jobs added by hand are kept.
4. The members' board, filtered by company. A public board (admin switch, off by default) showing only company,
   title, location and the apply link. A website widget: a script tag that adds an auto-sized frame, an optional
   company filter, no cookies; only the frame's route may be framed by other sites.
5. Admin page: the public switch, copy link, every linked source with Pull now and Hide, the embed code.

Out: taking applications, job detail pages, email about jobs, Workday/iCIMS (no public feed).

## Small calls taken
- Module id `job-board`, label "Jobs" (so it doesn't read like the platform's timed-jobs runner).
- Pages: `/jobs` (board), `/jobs/yours` (your company's jobs), `/admin/jobs`, `/public/jobs` (public board).
- The frame and scripts are route handlers under `/api/job-board/` (`embed`, `widget.js`, `frame.js`), so the
  architecture tests cover them. The widget only works while the public board is on.
- Any member can link a source; the company name starts from their profile. The source's owner can pull, hide,
  remove and add jobs by hand; an admin can pull and hide any source.
- Limits: 5 sources a member, 500 jobs a source, 50 hand-added jobs a source, Pull now once a minute.
- A removed or banned founder's jobs leave every board.

## Acceptance (checked by a separate verifier)
- Each saved sample feed parses.
- A linked Greenhouse sample shows its jobs on the board and in the widget.
- With the module off, every jobs page and API answers 404.
- With the public board off, visitors get 404.
- A broken feed shows a plain error and keeps the old jobs.
