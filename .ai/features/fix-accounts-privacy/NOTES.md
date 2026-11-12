# How the account and privacy fixes work

- **Invite notice.** `members/service-invite-notice.ts`. `acceptInvite(…, { isFromEmail, notice })` queues
  `invite_used` (transactional, no switch) in the join's transaction; the accept route sends it at once. The link is
  `/invite/not-me?m=<user id>&s=<HMAC of purpose invite-not-me + id with the auth secret>`. The page changes nothing on
  GET (mail scanners); its button posts to `/api/invites/not-me` → `reportNotMe`: needs the join's invite (accepted,
  not revoked, accepted under 14 days ago) and an un-reclaimed email; sets `email_verified` false, deletes sessions and
  `account` rows (passwords), writes audit `invite_reported_not_me` (actor "The invited address"). A second press
  finds the audit row and does nothing. `readWaitingMembers` reads that audit row as `isReportedNotThem`, sorts those
  first; `waiting-members.tsx` hides "Yes, this is them" for them. No schema change.
- **Welcome consent.** `readWelcomePrivacyStart` (`shell/welcome-steps.ts`): fill-in on only with `consented_at`.
- **Paused connectors.** `network/service.ts`: `leaveOutPausedIntroducers` drops paths whose introducer (or starter)
  is a paused member, except the person looked up; `describePathsForViewer` also drops paused connectors; a saved
  search goes through `leaveOutPausedConnectors` on the way out.
- **Expired invites.** `readOpenInvites` (`admin/reads-members.ts`) returns open invites with `isExpired`; Resend
  already worked on expired ones (`rotateInvite` checks only accepted/revoked).
- **Intro topics.** `EMAIL_TOPICS.introReminders` / `EMAIL_KINDS.introReminder`; `intros/email.ts` maps
  `connectorReminder` and `outcomeReminder` to it. `shell/email-settings.ts` always shows both intro rows.
- **Sign-in counts.** `platform/auth/auth-guards.ts` `readSignInCounts`; cookie `community_sign_in_device`
  (`sign-in-device.ts`: random id + HMAC of email and id, session-cookie attributes, one year), set in the after hook
  on a successful password sign-in. `createAuth` passes the environment so the guard reads the trusted IP header.
- **Pill fix.** `.fh-pill.fh-needs` in `app/parts.css` stays inline: the admin home's `.fh-needs` grid shared the name.
