# Journey: your data

> ⚠ RECONSTRUCTED from code on 2026-11-10 — needs confirmation
> Sources: `src/app/(app)/members/card/page.tsx`, `src/shell/email-preferences-card.tsx`,
> `src/modules/members/components/` (fill-in, lookup question, report credit, password cards).

Who: any member who wants to see or control what the community keeps about them.

What works on main today, all on the member's card page (`/members/card`):
1. "Your card": what members see; the email stays private.
2. Filled-in lines from public profiles (when the admin recorded the legal basis): each line can be hidden, and own
   words always win. The member can say no to being looked up.
3. Email choices per topic (weekly email, intros, messages, network, asks); account emails always come.
4. Whether to be named in the partner report as a connector.
5. How you sign in: add a password.
6. Network: leave the shared network group (Network page, or this page when Network is off).

Not on main yet (the Your data page, open on roadmap): one "Your data" page listing what is stored and what Village
receives, the consent record, export as one JSON file, delete my account for real, hide me from the directory, and
who can message me.

Where the data is kept and whom to ask (2026-11-10): when an admin fills in Settings' "Where your data is kept"
card, the Your data page (`/members/data`) shows that place and the data-request contact, word for word, under
"What is stored, and where". With nothing set, it shows nothing about them.
