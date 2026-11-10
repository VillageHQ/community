# First-run admin landing: how it works

- `src/shell/landing.ts` `readLandingPath` (pure, tested) picks the landing from three facts: welcome steps done,
  admin, setup complete. `src/app/(app)/start/page.tsx` reads them (setup progress only for an admin who is past the
  welcome steps) and redirects.
- The welcome page's "done" redirect and the welcome's "Not now" / "Continue" finish (`not-now-action.tsx`) go to
  `ROUTES.landing`, so the landing decides; for a member that is still the feed.
- The stuck-intros wording lives in `src/shell/admin-home.ts` `readAdminHomeItems`.
