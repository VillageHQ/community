# Intros

A member asks another member for an introduction to someone in their network. The connector says yes or no. On a yes, the person being introduced says yes or no thanks on a public page.
Only then does one message join them. A week later the requester is asked if it helped. Toggleable. Needs network.

- `contract.ts`: states, allowed moves and limits. `INTRO_TRANSITIONS` is the state machine. `REQUESTER_STATES` is what a requester may see of each state.
- `service.ts`: create an ask, move it, issue a new consent link, email the link, record an outcome.
- `service-consent.ts`: issue consent tokens and save the target's answer, including "stop all asks".
- `reads.ts`, `reads-open-asks.ts`, `reads-consent.ts`: boards, counts, details, the public page. Expiry and the outcome prompt happen at read time; a timed job (`integration.ts`) also expires due asks for admin counts.
- `service-blocks.ts`: what a block does to open asks (members' block route calls it).
- `email.ts`: member notices through the outbox. `queueIntroEmail` runs inside the move's transaction; `deliverIntroEmail` for moves outside a request. `email-target.ts`: the target's emails; `target-reminder.ts` (a job): one day-4 reminder, claimed once.
- `queries.ts`: client requests; `limits.ts`: rate limits. `copy.ts`: words; `components/`: UI, `consent-answer-panel.tsx`: public page.
- `components/connector-ask.tsx`: network's slots (ask dialog, promise line).
- `quiet-intro-emails.ts`: connector reminder, expiry email (jobs).
- `service-thread.ts`: intro threads (`.ai/features/reply-by-email/NOTES.md`).

States: `requested` → `asking_target` → `target_agreed` → `completed`. Closed: `declined`, `target_declined`, `withdrawn`, `expired`. `accepted` is the old single opt-in yes; rows already in it can still complete or expire, and nothing new enters it.

Rules:

- Every move is one conditional `UPDATE`, so two moves can't both land.
- The browser sends slugs and a note. The server reads everything else from that member's own cached paths.
- A requester never hears why an ask was withheld.
- A requester can't tell a connector's no from a target's no. `REQUESTER_STATES` maps `asking_target` to `requested` and `target_declined` to `declined`, and the requester's deadline ignores the extension a late yes gives the target.
- Consent links, live tokens and "stop all asks": read `.ai/features/two-sided-intros/NOTES.md` first.
- The target's email is optional, typed by the connector, used only with Resend, and cleared when the ask leaves `asking_target` or `target_agreed` (intro threads keep a copy). Nothing here spends Village credits to find an address.
- Admins see totals only, from `reads-report.ts`: by period asked, no withheld asks, expiries never declines.
- An intro ask uses the shared weekly allowance (passed in by the route) and a connector gets at most 10 a week. "I know someone" on an ask makes a helper-offered intro (`is_connector_offer`) that starts at `asking_target` and counts toward neither.
- `service-erasure.ts`: a deleted account's intros stay, without words or identity.
