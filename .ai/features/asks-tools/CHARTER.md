# Charter: asks board tabs, search, pin, reopen, and an admin asks page

**Approved:** 2026-11-11, the owner's pick in the build plan (Founderhall merge, wave 1). Spec: `.ai/features/asks-board-tools/SPEC.md`
(board) and the asks part of `.ai/features/admin-console/SPEC.md`.

## Direction
Members find any ask, old or new, and admins keep the board useful.
- **In:** board tabs Open, Mine, Answered, Closed; one search over every ask (title, details, public answers),
  closed and expired ones included; admins pin a few asks to the top of Open; the author or an admin reopens a closed
  ask; a new Admin › Asks page with this quarter's counts, the oldest open asks nobody answered, reported asks, the
  pinned asks, remove and pin buttons, and the weekly allowance setting (moved off the member's Your asks view).
- **Out:** Founderhall's separate "answered" status (here an ask closes with an outcome), editing asks, any count of
  who offered to help whom.

## Deciding facts (the builder's picks)
1. **Tabs.** Open = today's board (open asks and updates, with the kind chips), pinned asks first. Mine = today's
   Your asks view. Answered = asks with at least one public answer, any state. Closed = closed asks, newest first.
2. **Search** ignores the tab and the chips, matches every word typed (case-insensitive) in the title, details or a
   visible answer, and lists newest first. Blocked and removed members' asks and answers stay out, as on the board.
3. **Pin:** at most 3 pinned asks, only open asks; closing an ask unpins it. Pin and unpin are in the audit log.
4. **Reopen:** puts the ask back on the board for a fresh 30 days, outcome cleared; the author's open-ask limit
   still applies. Every reopen is in the audit log, whoever did it.
5. **Admin counts** use the partner report's calendar quarter and add a deleted account's asks the same way the
   report does. Counts only; the lists show only what any member already sees on the board.

## Architecture
Two columns on `ask` (`pinned_at`, `pinned_by_user_id`), migration 0028. The asks module owns the reads and writes;
the admin asks page lives under the asks module's admin tab (404 when Asks is off), and its reported-asks list is
read by `src/shell/admin-asks.ts`, because reports belong to the admin module.

## Journeys and tests
Asks journey (post, find, help, close) and the admin moderation journey. Tests: extend `src/modules/asks/asks.test.ts`
(tabs, search on an answer word, pin limit and audit, reopen and audit, the admin counts), the architecture tests,
lint and typecheck (~10 min). A verifier that did not write the code clicks through at 390 and 1280 px on made-up data.

## Proof and estimate
Screenshots of each tab, a search finding a closed ask by an answer word, a pinned ask on top, a reopened ask, and
Admin › Asks with its numbers. Build ~3 h, tests ~40 min.
