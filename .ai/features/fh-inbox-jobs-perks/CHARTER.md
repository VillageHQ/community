# Charter: Founderhall transplant, area 5: Inbox, Jobs, Perks

Approved scope: the owner's transplant brief for this area (round 3, area 5). The owner reviews once, at the end.

## Direction
Community's engine, Founderhall's screens copied exactly (structure, sections in order, parts, words, look, steps) for
the Inbox, the Jobs board (members and public) and Perks. Founderhall is the acceptance test.

In:
- **Inbox.** `/messages` → `/inbox` (list page: "Inbox", lede, thread rows with avatar, serif name, last line, date;
  the dashed empty state). `/messages/<id>` → `/inbox/<id>` (thread page: "‹ Inbox", the name, one line, square-ish
  bubbles with name + date + "by email", the reply box with Send). New `/messages/new?to=<member>`: the empty thread
  page ("No messages yet. Say hello."); the first Send starts the conversation, an existing one forwards to it.
  Permanent redirects from the old addresses; email links follow `ROUTES.messages`.
- **"by email" marker.** A message that arrived as an email reply is saved as such (one new column) and marked.
- **Jobs.** `/jobs`: "Jobs", the counted lede, "Hiring? Add your company's jobs on My profile.", the Company select,
  Founderhall's job rows (logo, serif title, "Company · place · team · posted 10 Nov · via Name", Apply).
  `/public/jobs` → public `/jobs` for signed-out visitors (Founderhall's wide public page with company tags and
  rows); permanent redirect from the old address. `/jobs/yours` keeps working, rebuilt as Founderhall's "Our jobs"
  sheet, which area 4 places on My profile.
- **Perks.** `/perks`: "Perks", "Deals for <community> founders, run by BuiltFirst.", the framed marketplace and the
  line under it; 404 inside the shell when off.
- **Emails:** the new-message email, the relayed intro-thread email's link and the reply-did-not-go-through email
  match Founderhall's words.
- Community-only kept and restyled: delete your own message, report a message, block, older messages, search
  conversations, the demo's made-up deals.

Out: My profile itself (area 4), the intro thread's own page (area 3), the admin job board (area 6), admin perks
(area 7).

## Deciding facts
- Members' and public `/jobs` share one address: a signed-in member gets the board in the app, a visitor the public
  page when the board is public, else sign-in.
- "Add your company's jobs" points at `/jobs/yours` until area 4's `/me` lands; then the orchestrator swaps the
  address (one constant, `JOB_BOARD_PAGES.yours`).
- Admins still never read messages.

## Tests
Messages, job board and perks module tests, the architecture tests, lint, typecheck; side-by-side shots at 390 and
1280 px for each acceptance shot of the area.
