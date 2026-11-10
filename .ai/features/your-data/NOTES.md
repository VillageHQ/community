# Your data and the real delete: how it works today

- Page: `/members/data` (`src/app/(app)/members/data/page.tsx`), linked from both account menus and from Your card.
  It shows what is stored and where, what Village receives (`network/components/village-disclosure.tsx`, with the
  fill-in line when the fill-in is allowed), the consent record, the switches, export and delete.
- Switches: `member_privacy` (one row per member, no row = defaults) through `members/service-privacy.ts` and
  `POST /api/profile/privacy`. "Don't look me up" reuses `POST /api/profile/lookup-choice`; "Share my network" links
  to Network, where joining and leaving the group already live.
- Hide me: `isListedMember()` in the directory, its search, popular tags, new members and neighbours; the profile page
  answers not-found to other non-admin members.
- Who can message me: `shell/message-policy.ts` (`mayMessage`), passed into `startConversation` and `sendMessage`
  (and the ask offer delivery). "Introduced" = an intro between the two where the connector said yes, or a completed
  intro that reached one of them by LinkedIn address. Admins and replies always pass.
- Accept intro asks: `member_privacy.accepts_intro_asks` (null = never answered, treated as yes). Onboarding asks it
  as the `intro_asks` step after the card while intros are on (`shell/onboarding.ts`, `/api/onboarding/intro-asks`).
  Each answer is audit-logged. `createIntroRequest` refuses a connector who said no.
- Export: `shell/member-export.ts`, `POST /api/profile/export`, a JSON download.
- Delete: `shell/account-deletion.ts`, from `POST /api/profile/delete` (types "delete") or
  `POST /api/admin/members/delete`. Order: Village first (`network/service-erasure.ts`: group leave, then
  `POST /v2/user/cancel` per Village identity; never throws), then one transaction under the admin roster lock:
  intros anonymized, asks tallied and deleted, feed, messages, reports, network caches, opt-outs, suppression,
  rate limits, weekly emails, outbox, the account placeholder (`members/service-erasure.ts`), audit scrub, a sweep of
  every text column for the email, and one `account_deleted` audit entry.
- What stays, on purpose: the `user` row as "Deleted member" with `deleted-<id>@reclaimed.invalid` (banned, no
  password or session), `member_removal` with `erased_at`, intro rows with no words or identity of theirs, `ask_tally`
  rows, conversations (their messages show as deleted), audit and moderation entries with no personal text, other
  members' own words (even if they mention the name), and `intro_opt_out` hashes (a do-not-contact list).
- The proof test: `src/shell/your-data.test.ts` scans every text, jsonb and array column of every table.
