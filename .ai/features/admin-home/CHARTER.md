# Admin home (charter)

Approved scope: the owner's build plan for the Founderhall merge (follow-up "an admin home led by the intro count").
The maintainer reviews after merge.

## Direction
Today an admin lands on the setup steps, or on Members once setup is done, under 12 tabs. The admin's first page
becomes a home in the merged look:
1. One serif line: this quarter's intros, for example "6 intros asked, 2 made, 2 said it helped", read by the
   partner report's own intro read (never a second count).
2. Then a row of small items, each a link, each hidden at zero: reported posts waiting, invites waiting, intros
   stuck (asked, no answer), the Village-down notice while it is on, and the setup steps left while any are left.
3. A link to the full partner report and the admin tabs, which stay as they are.
Admins never see who asked whom: the home shows counts only, like the report.

In: the home at `/admin`, the setup steps moved to `/admin/setup`, the links that said "open admin setup" pointed
there. Out: new admin tabs, a member-view switch, the mail page, per-intro lists for admins.

## Deciding facts (the calls made)
1. **Address:** the home takes `/admin` (the "Admin" link everyone already uses). The setup checklist moves to
   `/admin/setup`; its "Setup" tab and every "continue setup" link point there. Once setup is done, `/admin/setup`
   sends the admin to the home.
2. **Top line:** this quarter so far (UTC calendar quarter), asked / made / said it helped, from
   `readIntroReports` with the report's own period. With intros switched off, the line says so instead.
3. **Invites waiting:** two items. Invites sent and not yet accepted (to Members, the invite list), and people who
   joined and wait for the admin's OK (the Members tab's own badge count).
4. **Intros stuck:** an ask still waiting on its first answer past the reminder day (4 days): waiting on the
   connector, or on the person asked for since they were asked. Counts only; it links to the partner report,
   because admins never see the asks themselves.
5. **Village down:** the same trouble the admin pages already show; on the home it is one small item (to the keys
   step when Village refused the keys, else to Village credits) instead of the big notice.

## Journeys and tests
- The admin's first visit and the setup flow: `src/shell/admin-setup.test.ts`, `src/shell/next-steps.test.ts`, the
  architecture tests, plus a new test for the home's numbers (equal to the report's, hidden at zero, members
  refused). About 10 minutes.
- Usability check (a separate agent, made-up data, 390 and 1280 px): the top numbers equal the partner report's;
  each item links to the right place and hides at zero; a fresh install with setup left shows the setup item;
  members cannot open the page.

## Proof
Screenshots of the home at 390 and 1280 px, with items and on a fresh install, in `reports/`.
Estimate: build about 1.5 hours, tests about 30 minutes.
