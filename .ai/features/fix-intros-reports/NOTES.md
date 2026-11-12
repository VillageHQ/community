# How the fix-intros-reports fixes work

- **Partner report names.** `ReportIntroRow.connectorCredited` (in `admin/reads-report-stats.ts`) is
  `credit_in_reports` and an active account. `computeReportStats` builds `connectors` (credited only: email, CSV,
  print) and `allConnectors` (the admin's page). `readConnectorRows(stats, { everyone })` picks one. The page draws
  both tables: the admin's with `fh-no-print`, the partner copy with `fh-print-only` (`parts.css`).
- **No answer.** `BreakdownRow.noAnswer` and `IntroStats.noAnswer` count `expired`; `declined` counts only real nos.
  Console Home's `countIntroLedger` has the same `noAnswer` (stateWord "no answer from …").
- **Village alerts.** `platform/village/trouble-alerts.ts`: `alertAdminsAboutVillage` claims
  `village_alerted_<kind>_at` with one conditional upsert (free, or over a day old) and queues one `village_alert`
  email per active admin in that transaction. Callers pass only a new spell: `recordVillageOutOfCredits` inserts
  `village_out_of_credits_at` only if absent (a charged call clears it); `recordVillageOutcome` (`health.ts`) treats a
  trouble as new when none was stored or the kind changed. Home: `ADMIN_HOME_ITEMS.villageCredits`.
- **Credit spend.** `network/reads-village-admin.ts` `readCreditSpend` groups `village_credit_call` by UTC day and by
  member (no member = fill-in). `CreditSpendTables` draws it under Latest lookups.
- **Member as target.** `intros/reads-target-member.ts` `isAwaitingMemberAsTarget` (SQL): the intro waits on its
  person, has a consent link, the member is neither asker nor connector, no block with the asker, and either their
  verified (or admin-approved) email equals `target_email` / `suggested_target_email`, or their LinkedIn slug equals
  the target's and is confirmed. Nothing is stored; it is read each time. `answerAsTargetMember`
  (`service-consent.ts`) takes one of the intro's consent links and runs the emailed page's save, with the member's
  account email for a yes. Anything not waiting on that member answers 410 the same way, so nothing leaks. UI:
  `components/target-member-ask.tsx` on Today (`introsForYou`) and Your intros; the badge adds
  `countIntrosForTarget`. `Intro.targetEmailedAt` (connector only) changes the "Now ask" words.
- **Word helpers.** `asks/service.ts` `readHelperForAuthor` returns a path or a words helper; `shell/ask-helpers.ts`
  makes a named intro (`namedIntroBodySchema`) for a words helper. `BoardPost.targetName` prefills the form.
- **Faces.** `components/ui/avatar.tsx` is a client component: the `<img>` is in the server HTML; `onError` (or a
  ref that finds it already broken) hides it.

Known gaps: the alert is at most once a day per kind, so a second spell the same day shows only on the console. The
company logo beside a face still shows the browser's broken-image icon when its host never answers. A member is
matched only when an email or a confirmed LinkedIn ties them to the person; the profile intro form has no member
picker.
