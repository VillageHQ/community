# Partner report: how it works

- One read: `admin/reads-partner-report.ts` gathers the community numbers (`reads-health.ts`), the intro numbers per
  period (`intros/reads-report.ts`) and the asks by need (`asks/reads-report.ts`). `admin/partner-report-rows.ts`
  turns that object into labelled rows; the page, the CSV and the email render those rows and nothing else.
- Periods: this quarter so far, last quarter, since launch, as UTC calendar quarters. An intro belongs to the period
  it was asked in. Due expiries are applied before reading.
- Definitions: connector said yes = `accepted_at` or `asked_target_at` set; person asked for said yes =
  `target_agreed_at` set or completed; introduced = completed; declined = `declined` + `target_declined`; expired is
  separate and split three ways (connector never answered; person asked for never answered; expired after both said yes, or after an old single opt-in yes, before the intro was made); "said it helped" = helped / (helped + not helped).
- Top connectors: at most 5 named, chosen once over the whole history (so every period names the same people, by
  member id), only with `member_profile.credit_in_reports` on and the member still active. Everyone else is one
  count, so named + others always equals intros made. The Founderhall report (`admin/report-stats.ts`): the admin's
  page names every connector, partners only credited ones (`.ai/features/fix-intros-reports/NOTES.md`).
- Send to partners: up to 20 addresses, one outbox email each (kind `partner_report`, no topic), addresses that
  bounced are skipped, the list is remembered in `instance_settings`, the send is audited with the count only.
- Setup: the last step is done once `partner_report_shared_at` is set (first send, or "I shared it another way").
