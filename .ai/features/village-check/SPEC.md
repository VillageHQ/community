---
id: village-check
status: building
waits-on: []
touches: ["src/modules/network/service-village-check.ts", "src/modules/network/reads-village-check.ts", "src/app/(app)/admin/village/", "src/app/(app)/network/page.tsx", "src/app/(app)/admin/email/", "src/modules/admin/reads-email.ts", "site/index.html", "next.config.mjs"]
checks: ["src/modules/network/village-check.test.ts", "src/app/api/admin/email/do-not-send/do-not-send.test.ts", "src/test/deploy-setups.test.ts", "src/shell/admin-home.test.ts"]
---
# Village check, sent-email list, and the website's deploy buttons

What it does now.

- **Village check** (`/admin/village`, from the Village card in Settings and the admin home's Village item). One
  button asks Village, with free calls only, and stores the answer: whether the keys work ("keys valid", "keys
  rejected", "keys don't match"), whether the community group exists and how many members are in it, and for each
  member: has a Village user, connected (synced their network), syncing or not, in the group or not, and when it was
  checked. Members who never reached Village through the join flow show "Hasn't started connecting" and are not
  asked about. The page reads the stored answer; "Check again" runs once a minute at most.
- **Meet** shows each member their own line from the last check: "Village: Connected · your network is shared"
  (has a Village user, synced, in the group) or "Not connected yet". Nothing before the first check.
- **Admin › Email** (`/admin/email`): the latest 100 emails (to, kind, status, time; never a subject or body) and the
  do-not-send list (bounced or marked as spam). Removing an address is recorded in the audit log.
- **Website:** no "Deploy on Vercel" button until a live test shows the weekly email sends there. DigitalOcean and
  the own-server guide stay; the README keeps its Vercel button.

Not here: a scheduled check, paid Village calls, changing anyone's Village state.
