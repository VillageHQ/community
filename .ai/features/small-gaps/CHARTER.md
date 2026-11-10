# The smaller gaps and follow-ups: charter

Approved scope: the owner's build plan for merging Founderhall's strengths into Community (wave 3). The maintainer
agreed and reviews after merge. This page restates that brief; it is the scope of this build. One pull request, each
item kept small.

## Direction

Close the small gaps left after waves 1 and 2, and fix four follow-ups the earlier builds left behind.

In:

1. **Directory.** The member card gains three optional lines: stage, sector and cohort. A cohort an admin set on an
   invite (single invite or list/CSV, which already stores it) fills the new member's cohort when they join. The
   directory filters by stage, sector, cohort (the values members use) and by how recently the profile was
   updated. The partner report adds a "By cohort" breakdown when at least one member has a cohort.
2. **Intro reminder to the person asked.** When the connector emailed the person asked and they haven't answered
   after 4 days, they get one reminder with a fresh link. Queued through the email outbox by a job of the job runner,
   claimed with one conditional update, so it goes at most once.
3. **Email setup checker** in admin Settings: a live DNS check of the sending domain (SPF, DKIM, DMARC) that shows
   the record to add for each one missing, and "Send a test to me".
4. **Village settings for admins:** where member searches look (members' networks, or everyone), who can introduce
   (every member who shares their network, or only the members the admin picks), and the service email Village
   sees for the app's own lookups.
5. **Follow-ups:** a queued sign-in-link email gets its own expiry, so a late retry never sends a dead link; the
   "Your Your community" subject; the schema-files architecture test on Windows paths; the flaky one-click
   unsubscribe test.

Out: new profile fields beyond the three, admin editing of a member's cohort after they join, reminders to anyone
other than the person asked, changing DNS for the admin, any change to how paths are scored.

## Deciding facts (assumptions)

- **Stage, sector, cohort** are short free text (at most 80 characters), written by the member on their card; the
  cohort starts from the invite. Filters match a whole value, ignoring case, and offer the values active members
  use. "Updated" means the member's card was last saved within 7, 30 or 90 days.
- **By cohort** counts intros by the cohort of the member who asked, per report period, and members per cohort as
  of today. Counts only, as everywhere in the report.
- **Day 4** counts from the last time the app emailed the person asked. A person whose connector shared the link by
  hand has no address here, so gets no reminder. A reminder needs the intro still waiting on them, both members
  active, and no "stop all asks".
- **The sending domain** is the domain of `RESEND_FROM_ADDRESS`. Resend's records: SPF on `send.<domain>` with
  `include:amazonses.com`, DKIM at `resend._domainkey.<domain>`, DMARC at `_dmarc` on the domain or its parent.
  The resolver is injectable, so tests use a stub and no real DNS.
- **"Everyone" search** asks Village for a global search and shows those people without naming any path; paths are
  still only through members who agreed to share, and with "chosen members" only through those chosen. The default
  stays "members' networks". The service email defaults to the first admin's address, as today.
- **The flaky test** was "adds one-click headers and a link to optional email only": the outbox stores "send after"
  rounded to the millisecond, so about half of new rows are up to half a millisecond in the future, and a send in the
  same instant skips them. Fixed at the cause: the default truncates instead of rounding.

## Journeys and tests

- Directory and profile card: extend the directory and profile tests; filters return the right members.
- Intros: a test that a target with no answer by day 4 gets exactly one reminder, and none before day 4 or after an
  answer.
- Admin settings: DNS checker against a stub resolver showing the missing records; test send; Village settings saved
  and applied to search.
- Email: a sign-in link queued longer than its life is never sent; the unsubscribe test passes 20 runs in a row.
- `pnpm lint`, `pnpm typecheck`, the architecture tests (the Windows one passes locally). Full suite in CI.

## Proof and estimate

Screenshots at 390 and 1280 px of the directory filters, the card, the settings screen (email checker and Village
settings) and the report's cohort section; real output of the reminder job and the expired sign-in link. Build about
5 hours, tests about 1 hour.
