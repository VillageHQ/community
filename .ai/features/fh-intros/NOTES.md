# How the Founderhall intro screens work today

Founderhall's intro screens, steps and emails on Community's intro engine. Founderhall's own code was the model:
`intros/views.mjs` (screens), `mail/templates.mjs` (emails), `intros/flow.mjs` (steps).

## Screens and where they live
- **Your intros** `/intros`: `components/intros-list.tsx`, server-rendered. Allowance line (pips + note), "Waiting for
  your answer", "Your asks", "Asks you were part of", the dashed empty state. The weekly allowance comes from
  `src/shell/ask-helpers.ts` (`readAskAllowance`), read by the page.
- **One intro** `/intros/<id>`: `components/intro-page.tsx` (server) + `intro-page-actions.tsx` (client). The asker sees
  the tracker (`readTrackerSteps` in `intro-words.ts`), Withdraw my ask, Open the intro thread, "Was it helpful?". The
  connector sees the answer form (`intro-decision.tsx`) while the ask waits on them, then Community's follow-ups
  (`connector-follow-up.tsx`: share the person's link by hand, join them by hand, Report this note). Flashes come from
  `?m=asked|withdrawn|outcome` (`FlashOnArrival`).
- **The intro thread** `/intros/<id>/thread`: the replies to the introduction email, for the asker and the connector.
- **Public pages** `/i/<token>` (`src/app/i/[token]/page.tsx`, views from `reads-links.ts`, forms in `public-intro.tsx`):
  the connector's question (a connector link), the person's question (a consent link), the outcome question (an outcome
  link), "Nothing to do" with the reason (answered, withdrawn, expired, or a link nobody issued). A GET never changes anything; `?a=yes` only
  picks the answer. `/intro/optout/<token>` takes the person's consent token. `/meet/<token>` redirects there (308).
- All words are in `intro-words.ts` (screens) and `email-copy.ts` (emails); `email-copy.test.ts` checks every email
  against Founderhall's text (`email-copy.fixtures.json`, captured from Founderhall's demo).

## Engine added for Founderhall's flow
- **Answer links** (`answer-links.ts`, table `intro_answer_link`): a token per email for the connector (in the ask and
  its reminder) and for the asker's outcome question. Only the SHA-256 is kept. `service-answers.ts` answers for the
  member the link was sent to: `answerAsConnector` (yes + the person's email + the edited note in one step, or no with
  Community's private note) and the outcome. A token nobody issued counts toward the failed-try limit.
- **Stop intro asks from a closed link**: `stopIntroAsks` in `service-consent.ts` saves the opt-out even after the ask
  closed.
- **Emails** all go through the outbox now, including the person's ask and the introduction. The introduction goes
  to the asker, the person and the connector (copied); the connector's copy shows no address (members never see each
  other's addresses). Intro thread replies reach the two others (`INTRO_THREAD_AUTHORS.introducer`, migration 0033).
- New emails: withdrawn and "no answer" to the connector, thanks to the connector when the asker says it helped.
  "Sam withdrew" goes only to a connector who got the ask by email (the cooldown may have held it).
- **7 days per step** (`INTRO_LIFETIME_DAYS = 7`): the connector has 7 days, then the person has their own 7. The
  outcome question comes 14 days after the intro and its one reminder 14 days later; "Two weeks ago" counts whole days.
- The asks-left line in emails reads the shared allowance through `src/platform/allowance/weekly-allowance.ts`; the
  reader is provided at boot in `src/instrumentation.ts`. Without it (scripts, tests) the line says only "Your ask is
  back."
- Replies by email: the person's address may be on the YES line or the line after it (Founderhall's words).

## Kept as Community's rule, pending the owner (`contract.ts`)
- `REQUESTER_SEES_WHO_ANSWERED = false`: the asker never learns whose no it was. Founderhall says "Marcus can't make this
  one"; Community says "They can't make this one" (pill, tracker, email), and the asker's tracker shows the
  connector's step until the person said yes. `true` gives Founderhall's words exactly.
- `ADMINS_SEE_INTRO_NAMES = false`: the note sheet says admins see counts, never names (Founderhall: "names, states and
  dates"). Area 6 decides it for the Intro log.

## Known gaps
- Founderhall sends from "Marcus Webb via Northwind Founders"; the outbox has one sender name for the community.
- Founderhall's emails are plain text; Community also sends the same words as simple HTML.
- The phone shell's "Jobs · Perks" links and the menu count badges are the foundation's.
