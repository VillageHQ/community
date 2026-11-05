# Network

Village search, sync, the community group and intro paths. Toggleable. The only module that uses a Village account.

- `service.ts`: the join flow, search, paths, keys, the group, leaving and link approval.
- `service-departure.ts`: taking a removed member out of the Village group. It never throws.
- `service-settings.ts`: group, domain and the admin's daily limit.
- `reads-*.ts`: progress for next steps, reachable members and credit usage.
- `contract*.ts`: Zod schemas and constants. `queries.ts`: client requests. `components/`: the UI.
- `slots.tsx`: `ConnectorAskSlot` and `ConnectorPromiseSlot`. Intros fills them, so network never imports intros.

The Village client, credentials, credit ledger and error mapping live in `src/platform/village`.

Rules:

- The secret key and member tokens stay on the server.
- Never name a path through a member who hasn't agreed to share.
- Every paid call goes through `withCreditCall`.
- Departure runs whatever else happens. A removed member's network must stop being shared.
