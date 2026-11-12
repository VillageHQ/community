# How the follow-up works

- **Emailed invite mark.** `service-invite-emailed.ts` signs the invite token with the app's auth secret (purpose
  `invite-emailed`). `queueInviteEmail` puts it in the emailed link as `&e=` (`toInvitePath(token, mark)`); the link
  returned to the admin (`toInviteLink` without a mark) is the copied one. `/invite` passes `e` to `AcceptForm` (and
  through "Sign out and continue"); `/api/invites/accept` checks it with `isEmailedInvite` (constant time).
  `acceptInvite(…, { isFromEmail })` creates the user with `emailVerified` set, the route signs in with
  `signInWithServerLink` (not `signInUnconfirmedMember`, which would set it back) and skips `sendEmailConfirmation`.
  Rotating `BETTER_AUTH_SECRET` only turns older emailed links into copied ones.
- **Job board default.** `jobBoardManifest.isOnByDefault` is true; `enablement.ts` reads a stored `module_state:job-board`
  first, so only an admin's explicit choice (`setModuleState`) overrides it. `job_board_public` is untouched (off).
- **"Copied" words.** `isReplyByEmailOn` (`platform/email/reply-address.ts`) mirrors `sendJoiningEmail`'s choice
  (one thread with the connector copied, or a copy each). The target and connector link views carry `copiesConnector`;
  `renderTargetAsk` takes it too.
- **Email kind.** `EMAIL_KINDS.introTargetAsk` (`intro_target_ask`) for `sendConsentAskEmail`; the timed reminder keeps
  `intro_target_reminder`.
