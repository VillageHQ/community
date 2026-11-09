# Partner report (charter)

Approved scope: the owner's build plan (wave 2 of the Founderhall merge). The maintainer reviews after merge.

## Direction
Admins get one "Partner report" page instead of the Health page: the community's numbers and its intro numbers per
period, which they can print, download as a CSV or email to their partners (funds, sponsors). Every number on the
page, in the CSV and in the email comes from one read, so they can never disagree. Expiries are never counted as
declines. Admins see counts and outcomes, never who asked whom.

In: the report page (replaces Health; the old address redirects), print layout, CSV, send to partners through the
email outbox, the member setting "credit me in reports", the "what came of it" choice when a member says an intro
helped, and a last setup step "Your first partner report".
Out: cohorts (the data does not exist), per-intro logs, charts, scheduled sends.

## Deciding facts (the calls made)
1. **Which intros a period holds:** the ones asked in it (created in it). Each period's numbers then add up:
   asked = introduced + declined + expired + withdrawn + open.
2. **Withheld asks** (silently held back, for example after a block) never reached a connector and are left out of
   every number, so no connector looks unresponsive for an ask they never saw.
3. **Funnel:** connector said yes = the connector accepted (the target was asked, or the old single opt-in yes);
   target said yes = the target agreed, or the intro was made; introduced = made. Declined is split into "by the
   connector" and "by the person asked for"; expired is its own line, split the same way (no answer from the
   connector / from the person asked for). Due expiries are applied before the report is read.
4. **"Did it help" share** = said it helped / (said it helped + said no). "Not yet" and "not answered" are shown
   beside it. **Results** (customer conversation, hire, investor meeting) are new: when a member says an intro
   helped, they can tick what came of it. Results start at zero for older intros.
5. **Median days to introduced:** from the ask to the intro being made, over intros made in the period.
6. **Breakdown by need** uses the Asks board's categories (when Asks is on): asks posted per need and how many were
   solved here. Intros carry no need and members no cohort, so there is no such breakdown.
7. **Top connectors:** named only when the member turned on "credit me in reports" (member card, off by default)
   and is still an active member; everyone else is one count ("4 other connectors made 6 intros").
8. **Send to partners:** up to 20 addresses and a note, a preview of the exact email, one outbox email per address.
   The addresses are remembered for next time. Addresses that bounced or complained are skipped. Each send writes
   the audit log (with the count, not the addresses).
9. **Setup's last step** "Your first partner report" is done after the first send, or when the admin marks it
   shared another way (so a community without email can finish setup).

## Architecture
- `intros/reads-report.ts`: the intro numbers for a period (one SQL read per period, after the expiry sweep).
- `admin/reads-partner-report.ts`: the whole report (community numbers + intros + asks + connectors);
  `admin/partner-report-text.ts`: the CSV and email built from that one object.
- `admin/service-partner-report.ts`: send to partners and mark shared.
- Migration 0018: `member_profile.credit_in_reports`, `intro_request.outcome_results`.

## Journeys and tests
- Admin reads the report, prints it, downloads the CSV, sends it: integration tests against a real database with a
  seeded intro in every state (numbers, expiries, privacy, credited/uncredited connector, one outbox row per
  address), plus lint, typecheck and architecture tests. About 30 minutes.
- Member answers "did it help" with results; member turns on "credit me": covered by the same tests.
- Users see it: a separate agent uses the real app and tries to break it.

## Proof and estimate
Screenshots of the report at 390 and 1280 px, the print view, the CSV and the queued emails. Build about 4 hours,
tests under 1 hour.
