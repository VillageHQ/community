# Village check: how it works

- Run: `network/service-village-check.ts` `runVillageCheck`, from `POST /api/admin/village/check` (admins, 55 s
  budget). It first claims the `village_check` row (`id = 'latest'`) with a conditional upsert on `started_at`, so a
  second run inside a minute gets 429.
- Keys: `app.get` through the app's lookup identity (the service email, or the checking admin's email), compared with
  the saved public key. A 401/403 is "rejected"; other failures "unreachable". With keys not OK no member is asked.
- Members: every active member. Only those with a `member_network` row that agreed to share, linked, or joined are
  asked; the rest are `not_started`, so the check never sends Village a new email. For each asked member: `user.get`
  (`/v2/user/status`; an email means a Village user exists) and, if provisioned, `groups.list` to see the community
  group's id. 4 at a time, 15 s each; any failure is `unreachable` ("Village didn't answer in time"; "Not asked: the keys didn't work" when the keys failed).
- Group count: Village has no free "members of a group" call, so it counts checked members whose list holds the group.
- Store: `village_member_check` is replaced on each run (cascade-deleted with the user).
- Meet: `reads-village-check.ts` `readOwnVillageState`; connected = provisioned, ready or needs attention, in the group.
- `/admin/village` was once a redirect to `/admin`; the redirect is gone and the address now opens the check.
- Email page: `admin/reads-email.ts` reads `email_outbox` columns without subject or body; `service-email.ts` deletes
  the `email_suppression` row and writes `email_unsuppressed` in one admin transaction.
- Fake Village: `GET /v2/groups` lists the group only for its creator or a member who joined and hasn't left.
