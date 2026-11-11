# How Set up works today

- **Set up rows** — `src/shell/admin-setup-rows.ts` builds the list and each row's state from facts the page reads
  (mail on, sending domain, Village keys, modules on, chat posting, perks shown, open reports). A switched-off module
  whose page answers 404 (Village, Integrations) leads to Features. Test: `admin-setup-rows.test.ts`.
- **Settings** — `src/modules/admin/components/settings-form.tsx`, saved by `service-settings.ts` through
  `/api/admin/branding/settings`. New community settings (hosted by, plan, from name, sending domain, logo address,
  default message policy, DKIM selector, reply subdomain, Village region and data agreement, nightly fill-in, perks
  shown) live in `instance_settings` (keys in `src/platform/settings/schema.ts`), no table of their own. The default
  message policy applies to members who never chose (`readCommunityMessagePolicy` in members' `service-privacy.ts`).
- **Mail** — page `src/app/(app)/admin/mail/page.tsx`; reads `src/modules/admin/reads-mail.ts` (counts for 30 days,
  the log with subjects), checklist `mail-checks.ts`, sender from `src/platform/email/mail-settings.ts`. The test
  email is `src/platform/email/test-email.ts` (plain words, Founderhall's).
- **Village** — page `src/app/(app)/admin/village/page.tsx`, parts in `src/modules/network/components/admin-village-*`,
  service `service-village-admin.ts`. Lookups are counted in `village_credit_calls` (migration 0033). The nudge email
  is `src/modules/network/service-nudge.ts`.
- **Import and Sign-in links** — members' `service-import.ts` and `service-invite-links.ts`. Invite tokens are stored
  hashed, so a link shows only after Copy, which makes a new one.
- **Perks** — the admin page and its save belong to the admin module (`src/shell/perks-settings.ts`), because its
  "Show Perks to members" switch turns the Perks module on; the page stays open while Perks is off.
- **Audit log** — rows and words in `src/modules/admin/components/audit-log.tsx`, action words in
  `src/platform/audit/actions.ts`.
- **Features, Reports** — `feature-screen.tsx`, `report-queue.tsx`, restyled with Founderhall's sheets and rows.
- **Shared part added** — `src/components/plumbing-notes.tsx` (the "Running it yourself" box).
