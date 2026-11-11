# Intros

A member asks another for an intro. The connector says yes or no; on a yes, the person answers on a public page.
Only then does one message join them. Later the requester is asked if it helped. Toggleable. Works without Village.

Two ways in: a named ask from a profile (`components/ask-member-intro.tsx`) and a Village path ask. Intros never
imports network; the shell joins them (`src/shell/intro-*.ts*`). Read `.ai/features/intros-no-village/NOTES.md` first.

- `contract.ts`: states, moves (`INTRO_TRANSITIONS`), limits, and what a requester sees (`REQUESTER_STATES`).
- `service.ts`: create, move, new consent link, email the link, record an outcome.
- `service-consent.ts`: issue consent tokens and save the target's answer, including "stop all asks".
- `reads*.ts`: boards, counts, details, the public page. Expiry and the outcome prompt happen at read time; a timed sweep also expires due asks.
- `service-blocks.ts`: what a block does to open asks.
- `email.ts`: notices to members through the outbox (`queueIntroEmail` inside the move's transaction). `email-target.ts`: the target's emails; `target-reminder.ts`: one reminder on day 4. `limits.ts`, `copy.ts`.
- `queries.ts`: client requests. `components/`: UI; `consent-answer-panel.tsx`: the public page.
- `slots.tsx`: "See who else can help" under a closed path ask, filled by the shell while Network is on.
- `quiet-intro-emails.ts`: connector reminder, expiry email (jobs).

States: `requested` → `asking_target` → `target_agreed` → `completed`. Closed: `declined`, `target_declined`, `withdrawn`, `expired`. `accepted`: old single opt-in rows only.

Rules:

- Every move is one conditional `UPDATE`, so two moves can't both land.
- A path ask: the browser sends slugs and a note; the server reads everything else from that member's own cached paths.
- A named ask (`is_named_target`) needs no network. Its `target_linkedin_slug` is a slug or a name-and-company key, never an email.
- A requester never hears why an ask was withheld.
- A requester can't tell a connector's no from a target's no (`REQUESTER_STATES`), and their deadline ignores a late yes's extension.
- Consent links, live tokens and "stop all asks": read `.ai/features/two-sided-intros/NOTES.md` first.
- The target's email is optional, typed by the connector (prefilled from the asker's `suggested_target_email`), used only with Resend, and cleared when the ask closes. Nothing here spends Village credits to find an address.
- Admins see totals only, from `reads-report.ts`: by period asked, no withheld asks, expiries never declines.
- An intro ask uses the shared weekly allowance (passed in by the route) and a connector gets at most 10 a week. "I know someone" on an ask makes a helper-offered intro (`is_connector_offer`) that starts at `asking_target` and counts toward neither.
- `service-erasure.ts`: a deleted account's intros stay, without words or identity.
