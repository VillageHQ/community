# How reply by email works

- **Addresses** (`src/platform/email/reply-address.ts`): `reply+<kind><id>-<signature>@RESEND_REPLY_DOMAIN`. Kinds:
  `m` a conversation, `i` an intro ask (connector), `t` an intro thread, `h` an ask (helper). The signature (HMAC with
  the auth secret, 20 lowercase hex) covers the kind, the id and the person the email went to: a member id, or the
  outside person's address. The weekly email keeps its own `reply+<32 hex>-<sig>` form (`platform/weekly-email/tokens.ts`).
- **Emails that carry one:** the new-message email (`messages/email.ts`), the asked email and connector reminder
  (`intros/email.ts`), the joint introduction and relayed thread replies (`intros/email-target.ts`,
  `intros/service-thread.ts`), the helper email (`asks/service-helpers.ts`). Without a reply domain they carry none and
  say "Reply in the app."; the joint introduction then stays one email to both, answered by reply all.
- **Inbound** (`/api/email/resend-webhook` → `shell/weekly-email-answers.ts` first, then `shell/email-replies.ts`):
  1. Find our address among To and Cc; none, or no reply domain: not routed.
  2. Automatic mail (mailer-daemon, no-reply, our own reply domain, an Auto-Submitted header, an "Automatic reply" or
     "Out of office" subject): ignored, nothing sent back.
  3. For each of our addresses in order, find whom it was signed for among the thing's people (the two members of a conversation, the
     connector, the ask's helpers, the thread's asker or outside person). No match: forged, nothing sent back.
  4. The sender must be that person's address, or the reply is refused and the sender gets one bounce.
  5. The module must be on; the reply text (from the event, or Resend's received-email API) is stripped of quoted
     history and signature (`stripQuotedReply`), must not be empty, and must fit the place it lands (message 4,000,
     answer 1,000, thread 4,000 characters). Longer is refused, never cut. Attachments are never read or stored.
  6. It lands through the module's own service: `sendMessage` (with `mayMessage`, a client key derived from the
     received email's id so a repeat posts once), `transitionIntro` (+ `emailConsentLink` when an address follows
     YES on the first line; addresses further down, like a signature, are never used), `postIntroThreadReply` (unique `source_email_id`), `answerAsk` (one answer per member).
  7. A refusal from the service (closed, blocked, not allowed, rate limited) becomes the bounce's reason.
- **Bounce-back:** `reply_notice` kind, transactional, one per address per day (dedupe key `reply-bounce:<address>:<day>`),
  plain words, a link to the place in the app, never the refused text. After a YES, the connector gets one
  `reply_notice` with the consent link to forward (or "we emailed them").
- **Intro thread:** `intro_thread` (the intro, the outside person's address) and `intro_thread_message` (who wrote,
  the words). Opened when the joint introduction goes out with replies on. Takes replies while the intro is completed,
  the asker is an active member, and for 90 days; at most 20 replies a day per side. The asker sees it on
  `/intros/<id>` (`components/intro-thread.tsx`); the connector and admins never do. Deleted with the account of
  anyone in the intro (`service-erasure.ts`).
- **Tests:** `src/shell/email-replies.test.ts`.
