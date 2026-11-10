# Charter: asks that reach helpers

Approved scope (the owner's build plan, wave 2; the maintainer agreed and reviews after merge). Simulated buyer votes:
asks reaching helpers 14 of 15 must, the asks board 11 of 15 must.

## Direction
An ask should find the people who can help, instead of waiting for them to scroll by. In: Asks on by default, helper
routing with one email per helper, "I know someone" and "I've done this myself", one weekly allowance, a cap on intro
asks per connector, an "update" kind on the board, reports on the new content. Out: AI matching, email replies that
post under an ask, pinning, a feed.

## Steps
1. The Asks module starts on for new communities. A community that already exists keeps the state it had.
2. Helper routing. When an ask is posted, find members who can help:
   - those with a network path to the person the ask names (only members who agreed to share);
   - those whose "can help with" words share a word with the ask (simple word overlap, no AI).
   Each helper gets one email through the outbox, with one-click unsubscribe (a new "Asks you could help with" topic).
   Blocked members, in either direction, are never helpers and never emailed.
3. "I know someone" starts a two-sided intro with that helper as the connector. "I've done this myself" posts an
   answer under the ask. The author can ask a listed path helper for an intro.
4. One weekly allowance shared by posted asks and intro asks (default 5, the admin sets 1 to 100). An intro ask comes
   back when it is declined, expires or is withdrawn. A weekly cap on intro asks each connector receives (default 10).
5. An "update" kind on the board, so wins have a home while the feed is off.
6. Answers and updates can be reported.

## Decisions taken
- The person an ask names is optional: the author pastes a LinkedIn link. The path check uses the author's own path
  lookup (one Village lookup, through the credit ledger). With no link, no Village, or the network off, only word
  matches are used. A failed lookup never stops the ask.
- Word matching: at most 5 word helpers per ask, ranked by shared words, from the ask's title and details against
  each member's "can help with". Short and common words are ignored.
- "I know someone" creates the intro already past the connector's yes (the helper offered), so it waits on the
  target, and the helper makes the consent link on the Intros page. With no named person on the ask, the helper
  pastes the person's LinkedIn link and name. It needs the Intros module on; with it off the button is hidden.
- The author can ask for an intro only through a path helper (word helpers have no known path); for a word helper
  the existing "message" button stays.
- The allowance counts asks posted in the last 7 days (closing one doesn't give it back, so it can't be dodged) and
  intro asks the member sent in the last 7 days, except declined, expired and withdrawn ones. Intros a helper
  offered through "I know someone" don't count for anyone, and don't count toward the connector cap. Updates don't
  count.
- The allowance is a community setting (key in the settings store), edited on the admin features screen.
- The asks module still can't import intros or network: the shell joins them, the same way offers reach Messages.
- Intro rows get a plain `ask_id` (no foreign key across modules) and a flag for helper-offered intros.

## Acceptance checks
A posted ask emails the right helpers once and never blocked members. "I know someone" creates one intro. The
allowance blocks the 6th ask and comes back on a decline. The connector cap blocks the 11th ask to one connector.
Answers can be reported.
