# Admin home: how it works

- Address: `/admin` is the home; the setup checklist lives at `/admin/setup` (its "Setup" tab and every "continue
  setup" link point there; once setup is done it sends the admin to the home).
- Read: `src/shell/admin-home.ts` (`readAdminHome`). It reuses the admin tab facts (`admin-badges.ts`: setup steps
  left, open reports, members waiting for the admin's OK, Village trouble), the invite counts (pending), and two
  intro reads.
- Top line: `admin/reads-partner-report.ts` `readQuarterIntroLine` calls the report's own `readIntroReports` with the
  report's own "this quarter so far" period, so asked / made / said it helped always equal the report's. Null while
  intros are off; the page then says intros are switched off.
- Stuck intros ("N intros asked over 4 days ago, still no answer": true in any part of the quarter, so it never seems to contradict the top line): `intros/reads-report.ts` `readStuckIntroCount`: not withheld, and still `requested` 4+ days after the
  ask, or still `asking_target` 4+ days after the person asked for was asked (the reminder days). It links to the
  partner report, because admins never see individual asks.
- Items: `readAdminHomeItems` (pure, tested) lists, most urgent first, Village trouble (keys refused: the keys step;
  not answering: Credits), reports waiting, people waiting for the admin's OK, invites not accepted yet (Members, the
  invite list), stuck intros, setup steps left. Every item at zero is left out.
- View: `src/shell/admin-home-view.tsx`: the serif line, the "Needs you" row, the report link, then the admin tabs
  unchanged. The home doesn't use `AdminSection`, so the tabs sit below the items and the big Village notice is
  replaced by its item.
- `INVITE_SECTION_ID` moved to `admin/contract.ts`: a value exported from a "use client" file reaches a server page
  as a reference, not the string.
