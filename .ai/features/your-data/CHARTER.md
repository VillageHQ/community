# Your data page with real delete: charter

Approved scope: the owner's build plan for merging Founderhall's strengths into Community (wave 3). The maintainer
agreed and reviews after merge. This page restates that brief; it is the scope of this build. It deletes personal
data, so the pull request is opened and verified but not merged until the owner says yes.

## Direction

Every member can see what the community keeps about them, take it with them, change who can reach them, and delete
their account for real.

In:

1. **Your data page** (`/members/data`, linked from the user menu and from Your card). What the community stores about
   the member and where; what Village receives (the existing disclosure, with the profile fill-in line); their consent
   record (each choice with its date and how it was made); their switches: hide me from the directory, who can message
   me (anyone / only people I was introduced to), don't look me up, share my network, accept intro asks.
2. **Export my data.** One JSON file with everything about the member: account, profile, tags, filled-in lines,
   privacy and consent, network link dates, posts and replies, asks, offers and answers, the intros they are part of,
   their own messages, email settings, and their own actions in the audit log. Never another member's private notes or
   messages, and never another member's email.
3. **Delete my account, for real.** After a confirm step (the member types "delete"), the account's sign-in methods,
   sessions and pending sign-in links; profile, photo, tags, filled-in lines, privacy choices and blocks; the network
   link, after Village is asked to take them out of the group and to cancel their Village user; their posts, replies
   and reactions; their asks, offers and answers; their own messages (the other member sees "deleted"); invites to
   their email; outbox emails to them or naming them; their weekly emails, usage counters and rate-limit buckets.
   Intros they were part of stay only as anonymous rows for the partner report's counts. Audit and moderation copies
   keep no personal text. Admins can run the same delete from a member's panel in Members.
4. **Accept intro asks** becomes a required yes/no step in onboarding when intros are on (no default), with one line
   on what it means. Members can change it on Your data. A member who said no can't be asked to make an intro.

Out: backups ageing out (a host setting, written down in the PR), outside people's emails after 90 days (the
double opt-in build), Slack and Discord, the connect meter, i18n.

## Deciding facts (assumptions)

- **What "deleted" leaves behind.** Every other row points at the account by its random id, so the account row stays
  as an empty placeholder: the name becomes "Deleted member", the email `deleted-<id>@reclaimed.invalid`, it is
  banned, and it has no password, session or sign-in link. It holds no email, name or text of theirs. A placeholder
  can't be unbanned or re-invited (the existing reclaimed-email guard), and the person can join again with a new
  invite as a new account.
- **Partner report counts.** Intro rows stay, with every text field emptied and the member's LinkedIn address
  replaced, so every intro count is unchanged. An intro still open when the member is deleted becomes "withdrawn"
  (the asked total is unchanged; it moves from open to withdrawn). Deleted asks leave one anonymous tally row each
  (category, outcome, date), so "needs" counts are unchanged too. Member counts drop by one: they are no longer a
  member.
- **Village.** Before the local delete, the app leaves the Village group for them and calls Village's
  `POST /v2/user/cancel` (deactivates their Village user and revokes its tokens) for each Village identity the member
  ever linked. Village being down never stops the delete; the outcome is recorded with no personal detail and shown
  to whoever deleted.
- **Unanswered "accept intro asks".** Members who finished onboarding before this build never answered. They keep
  today's behaviour (they can be asked) until they choose on Your data, so the pool doesn't shrink quietly.
- **"Introduced to".** Two members count as introduced when they share an intro where the connector said yes, or a
  completed intro reached the other member by their confirmed LinkedIn address. Admins can always write, and a
  member can always answer someone they already wrote to.

## Architecture

- `src/modules/members/`: `member_privacy` table (hidden, message policy, accept intro asks with date and place),
  `service-privacy.ts`, and `service-erasure.ts` (profile, tags, photo, filled-in lines, blocks, network link,
  invites, and the account placeholder). `member_removal.erased_at` marks a deleted account.
- Each module erases its own rows: feed (`eraseMemberFeed`), asks (`eraseMemberAsks`, with `ask_tally`), messages
  (`eraseMemberMessages`), intros (`anonymizeMemberIntros`), network (`eraseFromVillage`, run before the delete).
- `src/shell/account-deletion.ts` runs them in one transaction in a fixed order, then scrubs audit, moderation and
  report copies, the outbox, weekly emails and auth tables. `src/shell/member-export.ts` builds the export.
- Routes: `/members/data` page, `POST /api/profile/privacy`, `POST /api/profile/export`, `POST /api/profile/delete`,
  `POST /api/admin/members/delete`. Onboarding gains an "intro asks" step.
- Migration: the next free number at build time (renumbered at merge).

## Journeys and tests

- Your data page, switches and export: route tests against a real database.
- Delete: a route test that seeds a member everywhere, deletes them, and scans every text column of every table for
  their email, name and texts; checks the partner report numbers before and after, the fake Village cancel and leave
  calls, and that they can't sign in. The same for the admin delete.
- Hide me: directory and search. Message policy: a non-introduced sender is refused; an introduced one isn't.
- Onboarding step: required, and saved with its date and place.
- Plus lint, typecheck and the architecture tests. A separate verifier uses the real app with made-up data.

## Proof

Screenshots of Your data at 390 and 1280 px, the confirm step, the exported JSON, and the cross-table scan's output
after a delete.
