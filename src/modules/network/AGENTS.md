# Network

Village search, sync, the community group and intro paths. Toggleable. The only module using Village.

- `service.ts`: joining, search (one bulk paths call, kept 10 minutes), paths, keys, the group, leaving, link approval.
- `service-search-pool.ts`: members who haven't joined search as the app's identity (in the group, unsynced).
- `service-departure.ts`: takes a removed member out of the group. Never throws.
- `service-settings.ts`, `contract-village-settings.ts`: group, daily limit, and the Village settings: search scope, who can introduce, the service email.
- `reads-*.ts`: progress, reachable members, credit usage, search's member rows.
- `contract*.ts`: schemas, constants. `queries.ts`: client requests. `components/`: the UI (`search-*`: /search; `my-network-screen`: /me/network).
- `service-fill-in.ts`, `rules-fill-in.ts`, `integration.ts`: the profile fill-in: email first, then LinkedIn every 30 days; nightly (02:00–05:59 UTC) or on request. Lookups run as the app's public identity, never as a member.
- `service-nudge.ts`: the connect meter and the admin's reminder to unconnected members, once per 30 days.
- `components/village-disclosure.tsx`: "What Village receives", on the member's card page. Update it when a call sends Village something new.
- `*-village-check.ts`: the admin's Village check and the member's line on My network. Free calls only, once a minute.
- `slots.tsx`: `ConnectorAskSlot` and `ConnectorPromiseSlot`. Intros fills them, so network never imports intros.

The Village client, credentials, credit ledger and error mapping live in `src/platform/village`. `health.ts` there records Village's last answer and any trouble since; admins see it, members see "Search is unavailable right now".

Rules:

- The secret key stays on the server. A member token leaves it only through `/api/network/sync-token`, for the signed-in member at the sync step.
- Never search or share a member's own network before they agree and sync.
- Never name a path through a member who hasn't agreed to share. With "chosen members" on, paths through other members are dropped before anything reads them, and only the chosen can offer intros.
- Every paid call goes through `withCreditCall`. It reserves the estimate against the monthly cap (and the member's day, except fill-in) first, and emails admins once at 80% and 100%.
- Departure always runs: a removed member's network must stop being shared.
- `service-erasure.ts`: before a real delete, leave the group and cancel the Village user (`POST /v2/user/cancel`).
