# Notes: the small known bugs (how they work now)

- **404 for a switched-off module's pages:** `src/proxy.ts` looks up the page's owner (`src/shell/module-off-pages.ts`,
  from each manifest's `paths.pages`) and, when that module is off, rewrites to a path nothing serves, so the app's
  own not-found page answers with a real 404. The page guard (`modulePage`) stays: it still covers client-side
  navigation. Why the proxy: `(app)/loading.tsx` starts streaming, which commits a 200 before the page can call
  `notFound()`.
- **Today's "Check your card":** `readLinesToCheck` (members, `service-fill-in.ts`) lists the filled-in words on show
  on the member's card (not hidden, not replaced by their own words, no photos or logos) that arrived in the last
  `LINES_TO_CHECK_DAYS` (7). They don't make a weekly email on their own: the email has no way to answer a line yet.
- **Full page loads in the menu:** a navigation entry with `isFullPageLoad` renders a plain link, so per-route security
  headers in `next.config.mjs` apply (Perks).
- **Slack /ask when slow:** past `SLACK_REPLY_WITHIN_MS` (2.5 s) the command answers "Posting your ask…" and, after the
  response, sends the result (or a plain failure) to the command's `response_url`. Only addresses under
  `SLACK_RESPONSE_BASE` (default `https://hooks.slack.com`) are called.
- **Word matching:** a hyphenated word also counts whole ("fund-raising") and is named alone in the reason. Forms:
  hyphens dropped, plurals made singular ("es" only after s, x, z, ch, sh), and an "-ing" or "-ed" word stands for its
  root with or without a final "e" (hiring → hir / hire). "-eed" words keep their "ed". At least 3 letters stay.
- **Single invite cohort:** optional, at most 80 characters, goes on the new member's card like a CSV cohort.
