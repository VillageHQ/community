# Today home and the weekly email: charter

Approved scope: the owner's build plan for merging Founderhall's strengths into Community (wave 2). The maintainer
agreed and reviews after merge. This page restates that brief; it is the scope of this build.

## Direction

A member should open the app, or one email a week, and see only what needs them this week, then be done.

In:

1. **Today home.** The signed-in home `/` shows, in this order: asks they could help with and why, intros waiting
   for their yes, profile lines to confirm (only when that data exists), their own asks in motion, "New this week"
   with Say hi, and next steps. It ends with "That's everything this week". With nothing to do it shows a calm
   empty state. The feed becomes a switch that starts OFF for new communities; existing communities keep their
   current setting.
2. **Weekly email.** One per member per week, on the day, hour and time zone the admin sets (default Thursday 09:00,
   UTC). Skipped when there is nothing to answer. Numbered items. Queued through the email outbox by a job of the
   job runner, with a progress row per member and week, so a restart picks up where it stopped and never sends
   twice. Each member can turn it off under email preferences; it carries one-click unsubscribe.
3. **Answer by reply.** A reply whose first lines hold codes (HELP 1, SKIP 1, YES 2, NO 2) acts on each item once.
   The reply goes to a signed per-member reply address and arrives through the Resend webhook. Each item also has a
   signed link that opens a confirm page; opening the link changes nothing, only the button does.
4. **Admin.** A weekly email screen: schedule, a preview built from the admin's own items or from a made-up member
   (never another real member's items), and "Send a test to me".

Out: smarter helper matching (the asks-helpers build adds network paths and helper emails), filled-in profile lines
(the profile fill-in build adds that data; this build shows the section only when such data exists, so for now it
never shows), new admin analytics.

## Deciding facts (assumptions)

- **"Could help with, and why."** Until the asks-helpers build lands, an ask counts as one you could help with when
  it is open, not yours, you haven't offered or skipped it, and its words share a word with your "can help with"
  line or your tags. "Why" names the overlap: "You said you can help with hiring."
- **The feed rule.** Migration 0017 stores `module_state:feed = on` when the database already has at least one
  member and no stored feed choice. A brand new install has no members when it migrates, so it gets no row and the
  feed's new default, off, applies. A stored choice, on or off, is never touched.
- **One per week.** The week is named by the local date of its scheduled moment. A member gets at most one weekly
  email per week name, and none if they got one in the last 6 days (so moving the day can't double up). Members who
  joined after the scheduled moment wait for next week. A run interrupted by a restart carries on at the next tick,
  at any point in that week.
- **Replies.** A reply address needs `RESEND_REPLY_DOMAIN` (the domain Resend receives mail on). Without it the email
  has no reply codes, only the links. The reply must come from the member's own address. Resend's `email.received`
  event carries no body, so the app fetches it from Resend's received-email API.
- **Acting once.** Each item number in each weekly email can be acted on once, by link or reply, whichever comes
  first; a repeat changes nothing and says so.

## Architecture

- `src/platform/weekly-email/`: no product opinion. The `weekly_email` table (member, week, numbered items as JSON,
  status) and `weekly_email_action` (one row per item acted on), schedule settings and week maths, signed item links
  and reply addresses, and the reply-code parser.
- `src/platform/email/`: a `weekly` topic and kind, an optional Reply-To on outbox rows, and the inbound event.
- `src/modules/asks/`: `ask_skip` (a member's "not for me") and the "could help with" read.
- `src/shell/today.ts`: reads one member's items across asks, intros and members; the home page and the weekly email
  both use it. `src/shell/weekly-email*.ts`: compose, the weekly job, preview, and acting on an item.
- Routes: `/weekly/[token]` confirm page and `POST /api/email/weekly/act` (platform), inbound handling in
  `POST /api/email/resend-webhook`, `/admin/weekly-email` and `/api/admin/weekly-email/*` (admin).
- Migration 0017.

## Journeys and tests

- Home (Today): integration test of the item reads for a seeded member, plus the empty state.
- Weekly email: integration tests for one run (one per member with items, none to empty ones), a second run the same
  week (nothing), a run stopped part-way then resumed (finishes the rest), unsubscribe/switch off (nothing sent).
- Replies and links: HELP 1 posts the offer once and a repeat does nothing; SKIP; a GET of a link changes nothing;
  a reply from another address does nothing.
- Admin preview: never shows another member's items.
- Feed switch migration rule. `pnpm lint`, `pnpm typecheck`, architecture tests.

## Proof and estimate

Proof: screenshots of the Today home (full and empty) and the admin screen at 390 and 1280 px, the real weekly
email text from a run against the fake Resend server, and the HTTP output of a HELP 1 reply and its repeat. Build
about 6 hours, tests about 1.5 hours.
