# Charter: answer messages, intros and asks by replying to the email

**Approved:** 2026-11-11 by the owner (the build brief is the approved scope; the maintainer reviews after merge).

## Direction
Today only the weekly email can be answered by reply. With the same Resend inbound webhook and signed reply
addresses, four more emails can be answered by replying:

1. **Messages:** replying to a "new message" email posts the reply into that conversation.
2. **Connector's answer:** the connector replies YES or NO to the "asked you for an intro" email (and its reminder).
3. **Intro thread:** after the joint introduction, the asker and the outside person write to each other by replying.
   The app keeps the thread, passes each reply on by email, and the asker also sees it on the intro's page.
4. **Asks:** replying to a "someone may need you" helper email posts that reply as an answer on the ask.

Out: Postmark, raw MIME, SMTP (Resend only); attachments (never stored); writing into the intro thread from the
app (the asker reads it there and answers by email; a follow-up); bounce-backs for the weekly email (unchanged).

## Deciding facts (assumptions taken)
- **Signed addresses:** `reply+<kind><id>-<signature>@<RESEND_REPLY_DOMAIN>`. The signature binds the address to
  the person it was sent to (a member, or the outside person's address), signed with the app's auth secret. The
  weekly email's addresses keep their old form and keep working.
- **Sender check:** the reply counts only when it comes from the address of the person that email went to.
- **Limits:** the webhook's 64 KB body cap and 20,000-character text cap stay; each reply must also fit the place it
  lands (a message, an answer, a 4,000-character thread entry). A longer reply is refused, never cut.
- **Quoted text:** the existing quote and signature stripping is shared by every kind.
- **Bounce-back:** a reply we can't use (wrong sender, empty, too long, closed, unclear YES/NO) gets one plain email
  saying why, with a link to the app; at most one per address per day. A forged address gets no email (no backscatter),
  and neither does automatic mail (mailer-daemon, no-reply).
- **Outside person's address:** kept on the intro thread so replies can reach them; erased with the asker's account;
  replies are accepted for 90 days after the introduction.
- **No reply domain:** nothing changes in behaviour; the emails say "Reply in the app" (the joint introduction keeps
  its "reply all" email).

## Architecture
- `platform/email/reply-address.ts`: make and read the signed addresses (no product knowledge).
- `shell/email-replies.ts`: routes a received reply to messages, intros or asks through their own services, and sends
  the bounce-back. The webhook tries the weekly email first, then this.
- `modules/intros`: a new `intro_thread` and `intro_thread_message` table (migration 0028), the split joint
  introduction when replies are on, the relay email, and the thread on the asker's intro page.
- Emails gain a Reply-To and one line of copy; new email kinds `intro_thread` and `reply_notice`, both transactional.

## Journeys and tests
- Messaging, intros (two-sided), asks helpers, the weekly email. Tests: a new `src/shell/email-replies.test.ts` with
  fake Resend inbound posts and made-up people (each kind lands, wrong sender and forged address refused, quoted text
  stripped, no reply domain), plus the existing weekly-email, messages, intros-consent, asks-helpers tests, lint,
  typecheck and the architecture tests (about 15 minutes).

## Proof and estimate
Proof: real webhook posts and what lands in the database and outbox, saved in `reports/`. Build about 4 hours,
tests about 1 hour.
