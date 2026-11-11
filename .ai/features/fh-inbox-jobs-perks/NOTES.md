# How the Inbox, Jobs and Perks work today (Founderhall's screens)

Area 5 of the Founderhall transplant: Community's engine, Founderhall's screens. Reference shots and words live outside
the repo (the transplant's reference folder); the side-by-side pairs are in `reports/`.

## Addresses
- `/inbox` (list) and `/inbox/<conversation>` (thread). `ROUTES.messages` is `/inbox`; emails and links follow it.
- `/messages/new?to=<member>`: Founderhall's "Message" page. An existing conversation opens in the Inbox; otherwise
  the empty thread ("No messages yet. Say hello."), and the first Send starts the conversation. A member who takes
  messages only after an intro gets Founderhall's "<Name> takes messages after an intro" page. The members slot's
  Message button is now a link here (`toNewMessageHref`), so a click never makes an empty conversation.
- `/jobs`: a signed-in member gets the members' board; a visitor gets the public board (`src/proxy.ts` rewrites to
  `/public/board`, the page's real home), or is sent to sign in while the board isn't public. `JOB_BOARD_PAGES.public`
  (the link admins share) is `/jobs`.
- Permanent redirects (`next.config.mjs`): `/messages` → `/inbox`, `/messages/<id>` → `/inbox/<id>`, `/public/jobs` → `/jobs`.
- A switched-off module's page for a signed-in member: `src/proxy.ts` answers a full page load with the in-app 404
  (`(app)/not-here/[reason]` → `(app)/not-found.tsx`, "That page isn’t here · Go to the start") and status 404, by
  fetching that page from the app's own address (`resolveAppUrl`, never the Host header). An in-app navigation is a
  plain rewrite. A visitor still gets the root 404.

## Inbox (`src/modules/messages/components/`)
- `conversation-list.tsx`: Founderhall's `.threads` rows (avatar, serif name, last line, "9 Nov"), the dashed empty
  state. The search box shows only on an inbox longer than one page (Founderhall has none).
- `thread.tsx`: back link, the name (`fh-h2`), Founderhall's one line, `.msg` bubbles, the `.reply` box, then a quiet
  "Block <name>" link. Polling, retries, older messages, mark-read and the live region are unchanged.
- `message-row.tsx`: under each bubble, who · date · "by email" (`direct_message.is_via_email`, set when the words came as
  a reply to the new-message email); Delete / Report is a quiet link there, shown on hover, focus or tap.
- `message-composer.tsx`: Send stays ready, as Founderhall's; a blank or too-long message sends nothing.

## Jobs (`src/modules/job-board/`)
- `components/job-list.tsx`: Founderhall's job rows (logo or building icon, serif title, "Company · place · team ·
  posted 10 Nov · via Name", Apply), the Company select (members) and the company tags (public). Words in `copy.ts`.
- The public board now also shows the team, the posted date and the company logo; still never who shared a job.
- `components/our-jobs-section.tsx`: Founderhall's "Our jobs" sheet (anchor `#jobs`) for My profile; `/jobs/yours`
  shows it on its own until My profile carries it. `components/shared/directory-jobs-link.tsx`: the Directory's
  "Jobs at member companies (5)" link, for the Directory to place.

## Perks (`src/modules/perks/`)
- `/perks`: "Deals for <community> founders, run by BuiltFirst.", the marketplace in Founderhall's `.perks-frame`, the
  line under it. The demo puts its made-up deals inside the frame. `shared/perks-card.tsx`: Today's `.perks-card` link.

## Emails
- New message: subject "<Name> sent you a message"; "<Name> sent you a message." · "Reply to this email to answer, or
  open it in the portal: <link>" · the stop line · "Sent by <community> via its member portal." It never carries the
  message itself: every email is kept in the outbox and the admins' email log, and admins must never read messages.
- The unsubscribe footer goes above a Founderhall sign-off (`placeTextFooter`); direct messages say "Stop emails about
  new messages: <link>".
- A refused email reply: subject "Your reply did not go through", the reason, "Use this link instead: <link>", the sign-off.

## Demo
The demo's thread (Priya ↔ Sam, Sam's answer by email) and jobs (5 jobs at Kilnworks, Tallyhealth, Ledgerline) are
Founderhall's made-up ones, so the pairs compare like with like.
