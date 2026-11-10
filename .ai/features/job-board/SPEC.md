# Job board and website widget

What it does now.

- Jobs is a module, off by default. An admin turns it on under Admin › Features. Off, every jobs page and API answers 404, the nav entry and the admin tab are hidden, and the hourly pull stops; linked sources and jobs are kept.
- A member opens Jobs › Your company's jobs, types the company (it starts from their card) and pastes the careers link of their hiring tool. The board's name is found in the link for Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Recruitee, Breezy HR, Rippling, Teamtailor, BambooHR, Personio and Jobvite (its XML feed link). The jobs are pulled at once, and the answer says how many were found or what went wrong.
- A link that isn't one of these tools is refused with the list of tools. "Add jobs by hand instead" makes a source with no feed; the member adds a title, an optional location and an apply link.
- Every hour the job runner pulls each linked board from the tool's public feed (no key). A pull that works replaces the pulled jobs; jobs added by hand stay. A pull that fails keeps the last good jobs and shows the problem in plain words on the source, for the founder and the admin.
- The founder can Pull now (once a minute), Hide or Show, Remove, and add or remove jobs by hand. At most 5 sources a member, 500 jobs a source, 50 hand-added jobs a source.
- Members' board (`/jobs`): every listed job, newest first, filtered by company, with who shared it and an Apply link to the company's own page. Hidden sources and banned or removed founders' jobs never show.
- Public board (`/public/jobs`): an admin switch, off by default. Shows only company, title, location and the apply link. Off, visitors get 404.
- Website widget: `<script src="<app>/api/job-board/widget.js" async></script>` adds a frame (`/api/job-board/embed`) that sizes itself; `data-company="<company>"` filters it. The frame reads no session and sets no cookie, and is the only response any site may frame. It follows the public switch.
- Admin › Jobs: the public switch, the public link to copy, every linked source with its status, Pull now and Hide, and the embed code (every company, one company, a plain frame for sites that block scripts).

Not here: taking applications, job pages, email about jobs, tools with no public feed (Workday, iCIMS).
