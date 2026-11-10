# Intros

A member asks another member for an introduction to someone in their network. The connector says yes or no. On a yes, the person being introduced says yes or no thanks on a public page. Only then does one message join them. About a week later, the requester is asked if it helped. Toggleable. Needs network.

- `contract.ts`: states, allowed moves and limits. `INTRO_TRANSITIONS` is the state machine. `REQUESTER_STATES` is what a requester may see of each state.
- `service.ts`: create an ask, move it between states, issue a new consent link, email the link, record an outcome.
- `service-consent.ts`: issue consent tokens and save the target's answer, including "stop all asks".
- `reads.ts`, `reads-open-asks.ts`, `reads-consent.ts`: boards, counts, details, the public page. Expiry and the outcome prompt happen at read time. A timed sweep (`integration.ts` jobs) also expires due asks, so admin counts stay right.
- `service-blocks.ts`: what a block does to open asks. The block route passes it to members.
- `email.ts`: notices to members, through the platform outbox. `queueIntroEmail` runs inside the move's transaction; `deliverIntroEmail` is for moves outside a member's request. `email-target.ts`: the two emails to the target. `limits.ts`: rate limits. `copy.ts`: words.
- `queries.ts`: client requests. `components/`: the UI. `components/consent-answer-panel.tsx` is the public page's form.
- `components/connector-ask.tsx`: fills the network slots with the ask dialog and the promise line.

States: `requested` → `asking_target` → `target_agreed` → `completed`. Closed: `declined`, `target_declined`, `withdrawn`, `expired`. `accepted` is the old single opt-in yes; rows already in it can still complete or expire, and nothing new enters it.

Rules:

- Every move is one conditional `UPDATE`, so two simultaneous moves can't both land.
- The browser sends slugs and a note. The server reads everything else from that member's own cached paths.
- A requester hears nothing about why an ask was withheld.
- A requester can't tell a connector's no from a target's no. `REQUESTER_STATES` maps `asking_target` to `requested` and `target_declined` to `declined`, and the requester's deadline ignores the extension a late yes gives the target.
- A consent token is 32 random bytes, stored only as a SHA-256 hash in `intro_consent_link`. Every link made for an intro works while it waits on the target, so a new link never kills one already forwarded. Links stay after the answer: a second tap shows that answer (`readSettledAnswer`) and never counts as a failed try. Only a token nobody issued counts toward the rate limit. A GET never changes anything: the page only reads, and answers go through a POST from its buttons.
- A token is live only while both members are active, joined, unblocked and the ask isn't withheld. Checked in SQL by `isConsentTokenLive`.
- "Stop all asks" saves an HMAC of the target's LinkedIn slug, keyed with the app's auth secret (`opt-out.ts`), in `intro_opt_out`, nothing else, and audits it without a name. A slug is public, so a plain hash could be reversed by guessing. If the auth secret changes, earlier stop-all choices are forgotten.
- The target's email is optional, typed by the connector, used only with Resend, and cleared when the ask leaves `asking_target` or `target_agreed`. Nothing here spends Village credits to find an address.
- Admins see totals only, from `reads-report.ts`: by period asked, no withheld asks, expiries never declines.
- An intro ask uses the shared weekly allowance (passed in by the route) and a connector gets at most 10 a week. "I know someone" on an ask makes a helper-offered intro (`is_connector_offer`) that starts at `asking_target` and counts toward neither.
