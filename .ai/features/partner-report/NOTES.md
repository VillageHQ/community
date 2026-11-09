# Partner report: how it works

- One read: `admin/reads-partner-report.ts` gathers the community numbers (`reads-health.ts`), the intro numbers per
  period (`intros/reads-report.ts`) and the asks by need (`asks/reads-report.ts`). `admin/partner-report-rows.ts`
  turns that object into labelled rows; the page, the CSV and the email render those rows and nothing else.
- Periods: this quarter so far, last quarter, since launch, as UTC calendar quarters. An intro belongs to the period
  it was asked in. Due expiries are applied before reading.
- Definitions: connector said yes = `accepted_at` or `asked_target_at` set; person asked for said yes =
  `target_agreed_at` set or completed; introduced = completed; declined = `declined` + `target_declined`; expired is
  separate and split by whether the connector had said yes; "said it helped" = helped / (helped + not helped).
- Top connectors: named only with `member_profile.credit_in_reports` on and the member still active; the rest are
  one count.
- Send to partners: up to 20 addresses, one outbox email each (kind `partner_report`, no topic), addresses that
  bounced are skipped, the list is remembered in `instance_settings`, the send is audited with the count only.
- Setup: the last step is done once `partner_report_shared_at` is set (first send, or "I shared it another way").
