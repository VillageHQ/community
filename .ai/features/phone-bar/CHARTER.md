# Charter: Intros on the phone's bottom bar

Approved by the owner (their pick from the final check of the merged app, 2026-11-10).

## Direction
- The phone bottom bar becomes **Home · Meet · Intros · Messages · More**.
- Members moves under More. Asks keeps its own entry under More, as today.
- Intros shows its waiting count as a badge, the way Messages does.
- The desktop sidebar follows the same order; no entry is removed there.
- With the Intros module off, the bar falls back with no empty slot (the next entry moves up).
- Out: any other change to navigation, labels or the admin Modules page.

## Deciding facts
- "Home" is the first entry's label when the Feed module is off (the default); with Feed on it stays "Feed", as today.
- The order of the module list also drives the admin Modules page and the timed jobs, so the navigation gets its
  own order in the shell instead of reordering that list.
- The bar keeps its rule: up to five entries show as they are; more than five show four and a More entry.

## Roadmap
- Close the phone-bar line, and close the forwarded-invite line as "owner's call: keep" (no invite lock).

## Journeys and tests
- Navigation tests (`src/shell/navigation.test.ts`, `src/shell/navigation-links.test.ts`), lint, typecheck, the
  architecture tests. A separate agent checks the real app at 390 and 1280 px, light and dark.

## Proof and estimate
- Screenshots of the bar and the More sheet. Build 30 minutes, tests 20 minutes. No migration.
