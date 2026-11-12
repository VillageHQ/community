# How the feed, weekly-email codes, hiring cards and site sign-up work today

- **Feed default** — `src/modules/feed/manifest.ts` `isOnByDefault: true`; `enablement.ts` uses it only when no
  `module_state:feed` row exists. Migration 0021 still writes "on" for old communities with members and never changes a
  stored choice. The demo seed (`src/shell/demo-seed.ts`, `seedFeed`) saves "on" and adds the made-up posts.
- **Profile lines in the weekly email** — `numberWeeklyItems` (`src/shell/today.ts`) numbers asks, then intros, then
  `profileLines` as kind `fact` with `ref` = the field (`title`, `company`, `location`) and title "Label: value".
  `readItemActions` (`weekly-email-compose.ts`) gives each kind its codes; links and reply codes both go through
  `answerItem` → `answerProfileLine` (`weekly-email-answers.ts`), which re-reads the member's lines to check first, so
  a line already checked in the app answers "gone". Outcome `needs_words` releases the claim.
- **Redirects after a form button** — `/api/email/weekly-answer` and `/api/email/unsubscribe` answer 303 with a
  relative `Location`. `new URL(path, request.url)` used the server's own address (`next start -H 127.0.0.1` sees
  `localhost`), and `form-action 'self'` in `next.config.mjs` blocks a redirect to another origin, so the page
  stayed put. Any new form-posting route should redirect by path.
- **Hiring line on a directory card** — `MemberRow` in `src/modules/members/components/member-directory.tsx` reads
  `hiringJobCount` (0 while the job board is off). It matches jobs by the company shown on the card, as the profile does.
- **Site sign-up** — `site/index.html` `#pricing` and `#get`; `setUpSignup` in `site/assets/site.js`; styles at the end
  of `site/assets/site.css` on the page's own colour names (dark mode follows). `site/README.md` says what the endpoint
  must answer and what to confirm before publishing.
