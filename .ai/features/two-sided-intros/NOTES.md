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
