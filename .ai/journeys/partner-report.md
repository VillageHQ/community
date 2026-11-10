# Journey: the partner report

> ⚠ RECONSTRUCTED from code on 2026-11-10 — needs confirmation
> Sources: `.ai/features/partner-report/NOTES.md`, `src/app/(app)/admin/report/`, `src/modules/admin/partner-report-rows.ts`.

Who: the fund's admin, and the partners who read the report.

1. The admin opens `/admin/report` → this quarter so far, last quarter and since launch: intros asked, connector
   said yes, person asked said yes, introduced, declined, expired (apart from declines), "said it helped", what they
   led to, the community's own numbers, asks by need, and a by-cohort breakdown when cohorts exist.
2. Top connectors are named only if they agreed to be credited (on their card); everyone else is one count. Nobody
   sees who asked whom.
3. They print it, download the CSV, or "Send to partners": up to 20 addresses, an optional note, a preview first.
4. The first send (or "I shared it another way") ticks the last step of the setup checklist.
Payoff: a number the partners believe, built from one source.

Tests: `src/modules/admin/partner-report.test.ts`.
