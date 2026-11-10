# Two-sided intros: how it works today

- A connector's yes moves the intro to `asking_target` and adds a row to `intro_consent_link` (only the SHA-256 of
  the token). "Make a new link" adds another row; every link works while the intro waits on the target.
- The target's answer is one conditional UPDATE on the intro (`isConsentTokenLive`). A second tap, or a tap on
  another link after one was used, finds the saved answer (`readSettledAnswer`) and returns `isRepeat: true`.
  Only a token nobody issued counts toward the failed-try rate limit.
- Stop all saves an HMAC of the slug keyed with the auth secret (`opt-out.ts`). Rotating that secret forgets
  earlier stop-all choices.
- "Did it help?": in the app from 14 days after the intro; by email once at 14 days and once more 3 days later,
  only while there's no answer (`outcome-email.ts`). It runs from the intros badge and board reads, at most once a
  minute per server, claiming rows with a conditional UPDATE so two servers can't both send.
  TODO: call `sendDueOutcomeEmails` from the shared job runner once it exists, and drop the read-time calls.
- A failed consent email puts back the address and time that were there before, and only while the intro still
  waits on the target.

Known gaps: no outbox, so a crash between a state change and its email loses the email. A target who said
"no thanks" on one link and later stopped all intros sees "You've stopped intro requests" on the first link too.

## Consent links and stop all (moved from `src/modules/intros/AGENTS.md`, word for word)

- A consent token is 32 random bytes, stored only as a SHA-256 hash in `intro_consent_link`. Every link made for an intro works while it waits on the target, so a new link never kills one already forwarded. Links stay after the answer: a second tap shows that answer (`readSettledAnswer`) and never counts as a failed try. Only a token nobody issued counts toward the rate limit. A GET never changes anything: the page only reads, and answers go through a POST from its buttons.
- A token is live only while both members are active, joined, unblocked and the ask isn't withheld. Checked in SQL by `isConsentTokenLive`.
- "Stop all asks" saves an HMAC of the target's LinkedIn slug, keyed with the app's auth secret (`opt-out.ts`), in `intro_opt_out`, nothing else, and audits it without a name. A slug is public, so a plain hash could be reversed by guessing. If the auth secret changes, earlier stop-all choices are forgotten.

> ⚠ UNCLEAR FROM CODE — confirm: still true? (2026-11-10) "no outbox" above predates PR #13, which added the email outbox; intro emails now queue through it (`src/modules/intros/AGENTS.md`).
