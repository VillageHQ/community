# How the asks board tools work

- **Tabs:** `/asks?view=board|yours|answered|closed` (Open, Mine, Answered, Closed). `rules-board-url.ts`
  `readBoardTab` maps a view to the board read's `tab`; Mine is the separate Your asks view (`your-asks.tsx`).
- **Board read:** `readAskBoard` in `src/modules/asks/reads.ts`. Open = `isOpenAsk`; Answered = asks (not updates)
  with an answer from an active, unblocked member; Closed = `closed_at` set. Newest listing first, cursor paging.
- **Search:** `?q=` in the URL, `search` in the request. It ignores the tab and the chips. Every word (case-insensitive,
  LIKE wildcards taken literally) must match the title, details or a visible answer. 120 characters at most.
- **Pins:** `ask.pinned_at`, `ask.pinned_by_user_id` (migration 0029; a check keeps a closed ask unpinned).
  `setAskPinned` in `service.ts` takes an advisory lock (7260414), refuses a closed or expired ask and a 4th pin, and
  audits `ask_pinned` / `ask_unpinned`. The unfiltered first page of Open returns them as `pinnedAsks` and leaves them
  out of `asks`. Closing an ask unpins it; an expired pinned ask keeps its place until renewed, unpinned or closed.
- **Reopen:** `reopenAsk` — the author, or an admin through `withAdminTransaction`. Clears the outcome, sets
  `listed_at` to now (a fresh 30 days), keeps the author's open limit, audits `ask_reopened` with the actor.
- **Admin › Asks:** `/admin/asks` (`src/app/(app)/admin/asks/page.tsx`), 404 with Asks off. `src/shell/admin-asks.ts`
  reads it: counts from `readAskAdminCounts` (`reads-admin.ts`) for the partner report's quarter, asks only,
  `ask_tally` rows added in, an answer counted only from an active member; the oldest open unanswered asks; every
  pinned ask; open reports on asks and answers (grouped per target, resolved with the Reports queue's own
  delete/dismiss requests); the weekly allowance (`allowance-form.tsx`, moved off Your asks).
- **UI:** `asks-screen.tsx` (search box, tabs), `ask-board.tsx` (pinned list, per-tab empty states),
  `ask-card.tsx` (state and pin tags, pin in the admin menu, Reopen), `admin-ask-list.tsx`, `src/shell/reported-asks.tsx`,
  `src/shell/admin-asks-view.tsx`, and the Asks tab in `src/shell/admin-tabs.tsx`.
- **Tests:** `src/modules/asks/asks.test.ts` ("the board tabs and search", "pinning", "pinning an ask that came down",
  "reopening", "the admin asks page"), `rules.test.ts` (URL), `components/asks-ui.test.ts`.
