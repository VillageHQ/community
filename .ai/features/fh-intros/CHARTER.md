# Charter: Founderhall transplant, round 3, area 3 — Intros (both say yes)

Approved scope (the owner's brief for this build, 2026-11-11). Community keeps its engine; Founderhall's intro screens,
words, steps and emails are copied onto it exactly. Founderhall is the acceptance test: every acceptance shot retaken
from Community at 390 and 1280 px must match the Founderhall shot except for community data.

## In
- **Your intros** (`/intros`): Founderhall's page head and lede, the weekly allowance line (pips, "4 of 5 asks left this
  week"), "Waiting for your answer" rows, "Your asks" rows with state pills, the dashed empty state. No tabs, no cards.
- **One intro** (`/intros/<id>`): back link "Your intros", the title "Sam ↔ Rosa, via Marcus" with its state pill, the
  lede, and two columns: the asker's tracker (stepper: asked · connector decides · target decides · introduced by
  email · was it helpful?) with Withdraw my ask / Open the intro thread / the outcome question / "Find another way in";
  or the connector's decision form (three option cards, the person's email, "Edit the note before it goes on", Send my
  answer). The note sheet on the right. The flash after asking and after withdrawing.
- **Public pages**: `/i/<token>` for the connector (answer without signing in, from the email's links), for the person
  asked (yes / no thanks) and for the outcome question; "Thank you", "You're introduced", "Nothing to do";
  `/intro/optout/<token>` (stop intro asks). `/meet/<token>` redirects permanently to `/i/<token>`.
- **Emails** (plain words, word for word): ask to the connector, ask to the person and its reminder, the introduction,
  declined and expired to the asker, closed to the connector (withdrawn, declined, expired), the outcome question and
  its reminder, thanks to the connector (new). Links in emails point at the new paths.
- **Engine work Founderhall needs** (owner-approved): a connector link that answers without signing in (new token
  table), the connector's yes carrying the person's email and an edited note in one step, an outcome link that answers
  without signing in, the thanks email, the connector told when an ask closes.
- **Community-only functions kept**, rebuilt with the foundation's parts: Report this note, Message the asker, the
  intro thread, "who else can help" after a closed ask, the copy-the-link path when the community sends no email,
  blocks, the helper-offered intro.
- **Demo data**: Community's demo intros mirror Founderhall's (Marcus asks Sam for Rachel Kim; Sam's ask to Alex Kim
  via Priya, introduced), so the side-by-side shots compare like with like.

## Kept as Community's rule, behind one named constant (owner to decide at the end)
- **Who said no.** Community never lets the asker tell the connector's no from the person's no; Founderhall names
  them ("Marcus said yes and asked Rosa", "Rosa can't take this one"). Kept by default; one constant switches to
  Founderhall's behaviour. None of the acceptance shots shows a declined or half-way ask, so the shots still match.
- **What admins see.** The note sheet's privacy line says what is true for Community (admins see counts, not names)
  until the owner decides area 6's question; the same constant style switches it to Founderhall's words.

## Out
- The intro ask pages (`/intros/new`, the guided ask, search): area 2. The Intro log and partner report: area 6.

## Proof and acceptance
Side-by-side pairs for every acceptance shot at both widths in `reports/`, a list of differences per pair, the emails
compared word for word, then tests, lint and typecheck. A verifier who did not build it checks the pairs.
