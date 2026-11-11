# Charter: Founderhall transplant, area 2 — Search and asking for an intro

Approved scope: the orchestrator's brief for round 3, area 2 (the owner approved the transplant plan, the route
renames with permanent redirects, and bringing Founderhall's features over where a screen needs them).

## Direction
Community's engine, Founderhall's screens copied exactly (structure, sections in order, parts, words, look, steps).
Founderhall is the acceptance test: every acceptance shot of this area, retaken from Community at 390 and 1280 px
with the same made-up demo people, matches the Founderhall shot except community data (names, counts).

**In**
- Search moves to `/search` (label "Search"), with a permanent redirect from `/network`: H1 "Who are you trying to
  reach?", the search field, the In our network | Everywhere segmented control, example chips, the strip line
  "Paths come from N members who share their network so far." (+ "Connect yours to search your own network too."
  when the member has not connected), the result rows (member rows with the Member pill and "See X' profile";
  path picture; "via X (role) Close"; "Ask X for an intro"; "You already know X: reach out yourself"), the no-results
  empty card ("Ask the community" / "Search everywhere").
- The intro ask becomes a page at `/intros/new` (owned by this area): one-step from search (one note box,
  "Send to X", "Back to results") and the three-part forwardable note from a profile (`?via=<member>`), with the
  weekly allowance pips, the Through card, the mail-style note, the character count, the consent line and the
  "How an intro works" rail. The modal dialogs go.
- The guided ask `/ask` (new): what do you need (four need cards) → who → the best way in (known people, the best
  path) → the note.
- My network `/me/network` (new page): the connect screen and the connected screen; "Your network settings"
  moves there from the search page.
- The email to the connector ("X, would you introduce Y to Z?") matches Founderhall's subject and body word for word.
- Every link to `/network` (menus, emails, pages) points at `/search`.

**Out** (other areas): the intro tracker after sending and its flash (area 3), the profile page itself and its
buttons (area 4), the Asks composer (area 1), the console.

## Deciding facts (assumptions)
1. The weekly ask allowance ("3 of 5 asks left this week", shared by posted asks and intro asks) is new engine work
   if Community does not count it today; built in the network/intros engine without a new table when possible.
2. Community's intro needs the target's details the connector forwards; the three note parts are joined into
   Community's one note field (no schema change unless the intro record cannot hold them).
3. "Everywhere" maps to Village's global scope when Community supports it; otherwise it is built.
4. Community-only functions in this area (LinkedIn step, sync step, sharing consent, leaving the group, the Village
   trouble notice, the own-Village line) keep working, rebuilt with the foundation's parts on `/me/network`.

## Proof and tests
- Side-by-side pairs for every acceptance shot in `.ai/features/fh-search-ask/reports/`, at 390 and 1280 px.
- The network and intros tests touched, the architecture tests, lint, typecheck; full suite in CI.
- An independent verifier retakes every shot and lists every difference.
