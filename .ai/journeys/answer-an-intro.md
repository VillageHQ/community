# Journey: answer an intro (the connector, then the person asked)

> ⚠ RECONSTRUCTED from code on 2026-11-10 — needs confirmation
> Sources: `src/modules/intros/AGENTS.md`, `.ai/features/two-sided-intros/NOTES.md`,
> `src/modules/intros/components/ask-for-you-card.tsx`, `src/app/meet/[token]/`.

Who: the connector (a member) and the person asked for (often outside the community, no account).

1. The connector sees the ask on Today, on `/intros` and by email → yes, "not this time", or "I don't know them
   well enough". Doing nothing closes it after its deadline.
2. On a yes → they get a private link for the person asked: copy it into their own message, or type the person's
   email so the app sends one email in their name. "Make a new link" never breaks a link already forwarded.
3. The person asked opens `/meet/<token>` → reads who is asking and the note → "Yes" or "No thanks", or stop all
   intro asks from this community. No account needed. If the app emailed them and they don't answer after 4 days, one reminder goes out (a link the connector shared by hand gets none).
4. On their yes → if the app emailed them, it sends one joining email to them and the asker ("<person>, meet
   <asker>", reply all to say hello). Otherwise the connector gets that joining message to copy, sends it however
   they normally reach both, and taps "Mark as introduced".
5. About two weeks later the asker is asked "did it help?" in the app and by email (once more 3 days later).

Tests: `src/modules/intros/intros-consent.test.ts`, `src/modules/intros/intros-outcomes.test.ts`,
`src/modules/intros/components/connector-card.test.ts`.
Known gaps (roadmap, open): a person who said no thanks and later stopped all asks sees "stopped intro requests" on
the first link too; a connector who said no still shows in the asker's paths list.
