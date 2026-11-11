# How the console works today (Founderhall's screens on Community's engine)

The admin console's screens copy Founderhall's: Home, Partner report, Intro log, Members, Invites, Asks & digest,
Job board. The look and shared parts come from the foundation (`.ai/features/fh-foundation/NOTES.md`).

## Who asked whom: admins see names
The owner decided on 2026-11-11 that admins see who asked whom, like Founderhall. The Intro log, its CSV and Home's
"Latest in the intro log" name the asker, the person asked for and the connector; the digest preview of another
member names them too. No console read selects an intro's note or reason (the preview blanks them). The partner
report names every connector in Top connectors and never the asker or the person asked for. Members are told on
Your data ("admins see names, states and dates"). The "Credit me in reports" switch on the member card no longer
changes the report (that card belongs to the profile area).

## Pages and where their code is
| Page | Route | Code |
|---|---|---|
| Home (dashboard; launch checklist until its four steps are done once, or `?checklist=1`) | `/admin` | `src/shell/console-home*.ts(x)`, `console-launch*.ts(x)`, `admin-home*.ts(x)`; "launched" is the `console_launched_at` setting |
| Partner report | `/admin/report?period=quarter\|last\|all` | `src/modules/admin/reads-report-stats.ts` (the one read for page, CSV and email), `report-stats.ts`, `components/report-document.tsx` |
| Send to partners | `/admin/report/send` | `components/partner-send-card.tsx`, `service-partner-report.ts` |
| Intro log | `/admin/intros` | `reads-intro-log.ts`, `components/intro-log-*.tsx`, `intro-log-csv.ts`, `/api/admin/intro-log/{csv,outcome-days}` |
| Members (+ Manage page per member) | `/admin/members`, `/admin/members/[memberId]` | `console-members.ts`, `components/member-table.tsx`, `member-manage.tsx`, `member-actions.tsx` |
| Invites | `/admin/invites` | `components/invite-*.tsx`; the email's words in `src/modules/members/contract-invite-email.ts` |
| Asks & digest | `/admin/asks` | `src/shell/admin-asks*.ts(x)`, `weekly-email-settings.ts` (the digest on/off setting `weekly_email_enabled`) |
| Digest preview + test | `/admin/digest` (old `/admin/weekly-email` redirects here, permanently) | `src/shell/digest-*.tsx`, `weekly-email-compose.ts` |
| Job board | `/admin/jobs` | `src/shell/admin-jobs-parts.tsx` |

The period switch (`components/period-switch.tsx`, `console-periods.ts`) uses Founderhall's words in the address;
anything else reads as this quarter.

## Settings added (no new tables)
`console_launched_at` (Home leaves the checklist), the intros module's outcome-question days (1–90, default 14,
`src/modules/intros/contract-outcome-days.ts`; the outcome email, the report's "pending" and the log read it),
`weekly_email_enabled` (the digest switch).

## Where it still differs from Founderhall (on purpose or by engine)
- Mail lines on Home name Resend, not SMTP; DNS shows "not checked yet" (Community doesn't save its DNS check).
- "Asked to delete" on Members reads 0: Community has no deletion request (members delete their own account).
- The profile fill-in consent on Invites is community-wide in Community, not per invite.
- Manage actions still confirm in a dialog (the confirm component is shared with other screens).
- The phone foot keeps a "Job board" link (Founderhall's console has no phone path to it).
