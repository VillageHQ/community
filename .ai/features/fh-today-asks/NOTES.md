# How Today and Asks & updates work today (Founderhall's screens)

Area 1 of the Founderhall transplant: Today, Asks & updates and one ask's page, in Founderhall's structure, parts and
words, on Community's engine. Founderhall's markup is ported 1:1 with the `fh-` classes from `src/app/parts.css`.

## Where things are
- **Today** — `/today` (`src/app/(app)/today/page.tsx`). `/` sends members there permanently, keeping the query.
  The screen is `src/shell/today-list.tsx` (`TodayPage`); actions are `src/shell/today-actions.tsx` ("Not this week",
  Right / Hide it / Fix it). Data: `src/shell/today.ts` (`readTodayItems`, shared with the weekly email).
  Sections in Founderhall's order: asks on your paths → Waiting for your yes → Is this right? (main column);
  Your asks in motion → Perks → Jobs → (Community-only) New this week → "That's everything this week." (rail).
  Community-only next steps (connect your network, confirm your email) sit under the main column as Today items.
- **Asks & updates** — `/asks` (`src/app/(app)/asks/page.tsx`): composer (Ask | Update, one line, "Who are you
  trying to reach?" folded), archive search, tabs Open · Updates · Yours · Answered (`?tab=`), posts, "How asks work"
  rail. Components: `asks-board.tsx`, `asks-composer.tsx`, `post-parts.tsx`. Reads: `reads-board.ts`.
  `/asks?view=yours|answered|closed` redirects permanently to the matching tab.
- **One ask** — `/asks/[askId]` (`ask-detail.tsx`, `ask-detail-forms.tsx`): who can help (path helpers draw the
  path), answers, the reply box, "I can help" (I know someone / I've done this myself) or the owner's box; Mark
  answered, Reopen, admin Pin / Close / Remove (`/api/asks/status`, `service-status.ts`). Community-only and kept:
  Report this ask/answer (quiet link, confirm in place), Renew near 30 days.
- **Flash** — `?m=<key>` on the page you land on; words in `ASK_FLASHES` (contract.ts).
- **Feed** — Community-only, off by default: its own page `/feed`, a menu item only while on.

## Rules
- An ask is one line (≤500) plus optional `target_text` (≤160) and `target_company` (≤120). No category is asked:
  with a target it's an intro, else advice (the partner report counts by it). The old LinkedIn target still works.
- Path check: the target words are searched in the author's network (`findAskPaths`, `src/shell/ask-helpers.ts`),
  the first non-member found is looked up for paths; members who share only. Helpers keep `person_name`,
  `person_title`, `warmth`, so "Why you" reads like Founderhall. Profile helpers quote the helper's "can help with".
- Today and the weekly email show only asks the member was routed to (Founderhall's rule).
- "I can help" leaves a public line (`ask_answer.kind` know_someone / done_myself), keeps a private `ask_offer`, and
  emails the asker (`ask_help_offered`). Answers: many per member; the same words within a minute post once.
- "Is this right?": filled-in Role / Company / City not replaced by own words, not hidden, not confirmed
  (`member_fill_in.confirmed_at`; a refresh that changes the words clears it). Fix writes the member's own words.
- Emails are Founderhall's plain text (`renderPlainTextHtml`). A text with `[[unsubscribe-url]]` gets the member's
  unsubscribe link there instead of the usual footer (`outbox-sender.ts`).
- The post allowance error uses Founderhall's words (`assertPostAllowance`); intro asks keep Community's.

## Known gaps (follow-ups)
- "Ask for an intro" opens the network search until area 2 adds Founderhall's guided ask at `/ask` (`GUIDED_ASK_PAGE`).
- Digest: RIGHT / HIDE / FIX reply codes don't exist yet; fact lines link to Today instead.
- "Message" on a helper links `/messages/new?to=` (area 5 adds that page).
