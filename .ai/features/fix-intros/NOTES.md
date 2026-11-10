# Intro fixes: how they work today

- **Empty note on a no.** `declineReasonSchema` takes `null`, `""` or nothing; all mean no note.
- **A yes on a forwarded link.** When email is on and the intro has no address for the person asked, the public
  page (`/meet/<token>`) shows "Your email" and sends it with the yes (`targetEmail` on the answer body). The server
  refuses the asker's or connector's own address, keeps an address the connector already gave (`coalesce`), then
  joins them with the one joint email and completes the intro, as when the connector emailed the link. The field is
  required only for a yes; "No thanks" never needs it. With email off nothing changes: the connector joins them.
- **Quiet intros** (`src/modules/intros/quiet-intro-emails.ts`, two jobs on the runner every 15 minutes):
  - Connector reminder: an ask still `requested` 4 days after it was made, live between two active joined members,
    gets one email to the connector. `connector_reminder_at` is the claim, set once.
  - Expiry email: an ask that hit its deadline (`expired`, `expires_at` past) in the last 2 days, whose asker is
    still an active joined member, gets one kind email to the asker that never names who didn't answer.
    `expiry_email_at` is the claim. The `intro-expiry` job expires due asks, then sends these; read-time expiry only
    changes the state, and the next job run sends the email.
  - Each claim and its queued outbox email commit in one transaction; the outbox job sends them.
- **Paths after a no.** `readOpenAsks` (passed into network by the paths route) also returns the connectors whose ask
  from this requester to this person ended in a no, either kind; network drops them from `connectors`. Both kinds
  count, because the asker sees them the same way. The raw `paths` and `summary` in the API response are unchanged
  (the screen shows only `connectors`).
- **The answer on each intro.** `target_answer` (yes, no thanks, stop all) is saved with the answer, and on the other
  asks a no closes. A "no thanks" link opened after a later stop-all says both, in order. Rows from before the column
  fall back to the old reading (state plus the opt-out list).

Follow-ups: the paths empty state then says "Nobody's network reaches <name> right now", which is not quite true
after a no; the joint email still goes straight to Resend, not through the outbox.
