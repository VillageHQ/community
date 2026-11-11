# Intros

A member asks another for an intro. The connector says yes or no; on a yes, the person answers on a public page.
Only then does one email join them. Later the asker is asked if it helped. Toggleable. Works without Village.
Screens, words and emails are Founderhall's: read `.ai/features/fh-intros/NOTES.md` and
`.ai/features/intros-no-village/NOTES.md` first. Intros never imports network; the shell joins them (`src/shell/intro-*`).

- `contract.ts`: states, moves (`INTRO_TRANSITIONS`), limits, what an asker sees (`REQUESTER_STATES`), the two
  Community-only switches (`REQUESTER_SEES_WHO_ANSWERED` off; `ADMINS_SEE_INTRO_NAMES` on, as the owner decided).
- `service.ts`: create, move, consent links, email the person, record an outcome. `service-answers.ts`: the connector's
  one-step answer and answers through email links. `service-consent.ts`: the person's answer and "stop intro asks".
- `reads*.ts`: boards, counts, details; `reads-links.ts` and `reads-consent.ts`: what `/i/<token>` shows.
- `email-copy.ts`: every email's words (checked against Founderhall in `email-copy.test.ts`). `email.ts`: member emails
  through the outbox, in the move's transaction. `email-target.ts`: the person's emails and the introduction.
- `answer-links.ts`: email links that answer without signing in (hash only). `target-reminder.ts`,
  `quiet-intro-emails.ts`, `outcome-email.ts`: timed emails.
- `components/`: `intros-list`, `intro-page`, `intro-decision`, `public-intro`; words in `intro-words.ts`.

States: `requested` → `asking_target` → `target_agreed` → `completed`. Closed: `declined`, `target_declined`, `withdrawn`, `expired`. `accepted`: old single opt-in rows only.

Rules:

- Every move is one conditional `UPDATE`, so two moves can't both land. A GET never changes anything.
- A path ask reads everything but slugs and note from the asker's cached paths. A named ask (`is_named_target`) needs
  no network; its `target_linkedin_slug` is a slug or a name-and-company key, never an email.
- An asker never hears why an ask was withheld, nor (while `REQUESTER_SEES_WHO_ANSWERED` is false) whose no it was.
- Consent links, live tokens and stop-all: `.ai/features/two-sided-intros/NOTES.md`.
- The person's email is typed by the connector (prefilled from the asker's), used only with email on, cleared when the
  ask closes (intro threads keep a copy). Nothing here spends Village credits.
- Admins see totals only (`reads-report.ts`). Members never see each other's addresses (the connector's copy of the
  introduction shows none).
- Each step has 7 days. An intro ask uses the shared weekly allowance (passed in by the route); a connector gets at most
  10 a week. A helper-offered intro (`is_connector_offer`) starts at `asking_target` and counts toward neither.
- `service-erasure.ts`: a deleted account's intros stay, without words or identity.
