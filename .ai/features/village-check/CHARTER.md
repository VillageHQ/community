# Charter: a Village check through Village's own API, a sent-email list, and the Vercel button

Approved scope: the owner's pick in the merge plan (wave brief "village-check"). The owner's words: "use the APIs to
check if the user got provisioned and has access via the Village API".

## Direction
In:
1. **Admin › Village check** (`/admin/village`), reached from a button on the Village settings card and from the admin
   home's Village item. It asks Village and shows, in plain words: the keys work (app.get's public key matches the
   saved one) or "keys rejected"; the community group exists and how many members are in it; and for each member:
   has a Village user (provisioned), connected (synced their network) or not, in the community group or not, and when
   it was checked. Only free calls: tokens.create, app.get, user status, the member's group list. Never search, paths
   or enrich. The last result is stored, so the page opens without calling Village; "Check again" re-runs it, at most
   once a minute.
2. **Meet** shows each member their own line from the same check: "Connected · your network is shared" or "Not
   connected yet". Nothing shows before the first check.
3. **Admin › Email** (`/admin/email`): the sent emails (to, kind, status, time; never subject or body) and the
   do-not-send list with a remove button. Removing is an admin action recorded in the audit log.
4. The website's (`site/`) "Deploy on Vercel" button comes off until a live test shows the weekly email sends there.
   DigitalOcean and the self-host guide stay. The README's button stays (the brief names only the website).

Out: paid calls, a scheduled check, changing anyone's Village state, a Vercel live test.

## Deciding facts (assumptions taken)
- **Who is asked about.** Village is only asked about members who already reached Village through the join flow
  (agreed to share, linked, or joined the group). Asking about the others would send their email to Village before
  they agreed, so they show "Hasn't started connecting" without a call.
- **Provisioned** = Village's user status has an email (a Village user is linked to this member). **Connected** =
  status ready or needs attention (syncing shows "Syncing"). **In the group** = the member's own group list holds the
  community group's id. Village has no free "group members" call, so the member count is the number of checked
  members whose list holds it.
- Minting a member token is free and is what the join flow already does; it never connects or joins anyone.
- Rate limit: one check a minute for the whole community, claimed in one conditional write so two clicks can't both run.
- The check runs in the request with a 55-second budget; members it couldn't reach in time show "Not checked this time".

## Architecture
- Network module: `schema.ts` gains `village_check` (one row: when, keys, group, counts) and `village_member_check`
  (one row per member), migration 0028. `service-village-check.ts` runs the check; `reads-village-check.ts` reads it.
  New page `/admin/village` and route `POST /api/admin/village/check`, both owned by the network module.
- Platform Village client gains `listVillageGroups`. The fake Village answers the group list only with groups the
  caller is in.
- Admin module: `/admin/email` page, `Email` admin tab, `reads-email.ts` (outbox list, do-not-send list) and
  `DELETE /api/admin/email/do-not-send` with a new audit action `email_unsuppressed`.

## Journeys and tests
- Admin checks Village; member sees own status on Meet; admin manages email. Tests: one new Vitest file for the
  check (3 members, wrong keys, no paid call, rate limit, Meet line), one for the email page reads and the remove
  (audited), the deploy-setups test updated for one Vercel button, plus lint, typecheck, architecture tests.
- Usability check by a separate agent with the fake Village and made-up members.

## Proof and estimate
Screenshots of the check page, the Meet line and the email page at 390 and 1280 px. Build about 3 hours, tests about 1 hour.
