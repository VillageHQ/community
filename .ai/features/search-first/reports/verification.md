# Verification: search before connecting your own network

An independent verifier ran this check on branch `this build's branch` at commit "Members can search before connecting their own
network". It used the fake Village, the demo app with made-up people, and throwaway databases. No real accounts, keys or email were used.

**Verdict: FAIL.** One bug blocks the "ask a sharing member for an intro" part of the scope (B1). Everything else passes.

## What ran
- `pnpm lint`: exit 0. `pnpm typecheck`: exit 0.
- `vitest run src/modules/network src/modules/intros src/test/architecture` on a fresh database: 29 files and 1173 tests passed.
- A scratch vitest file (deleted afterwards) with 10 break attempts against the API routes and the fake Village. It covered
  refusers in degree-2 and degree-3 paths, cached paths, intro asks through refusers, a pending Village link, an
  unconfirmed email, a group that was deleted and then recreated, the daily limit, the sync token, Village refusing
  the pooled paths, a member who left the group, and chosen introducers. All 10 passed, but they also logged the
  data behind B1 and O1.
- The real demo app (`pnpm dev`, demo mode) signed in as Sam, after his network row was reset to "never connected". The
  checks were done in a browser at 390 and 1280 px. Screenshots are in `reports/verify/`.

## Checks
1. **PASS.** A brand-new member searches and sees results and paths through members who shared.
   - In the service tests (`search-first.test.ts` plus the scratch tests), searches and paths run as `community-pooled-search` with a full grant.
     Only sharers are connectors.
   - In the demo app, Sam, never connected, searched "Fintech founders in London". He got "10 people members can reach" and "Search the networks
     12 members shared". 9 of 10 targets had one connector, each a sharing member (`v1`, `v2`). The 10th path was dropped
     because the demo's connector for that target doesn't share.
2. **PASS.** The invitation and the "Add your network" flow.
   - The card "Add your network so others can reach people you know" shows between the search box and the results.
   - "Add your network" opens the LinkedIn step, then the consent step ("The deal") (`v4`).
   - "Not now" on the consent step went Home. The database still showed consent, group join and Village link all null. Back on Meet, the search and
     invitation showed again.
   - Consenting then reached ready (the demo syncs at once). The page switched to "Search 12 members' networks, including
     yours" and "10 people in your network", with network settings and no invitation (`v5`). The cached pooled paths
     were cleared (0 rows).
3. **PASS.** After connecting, the member's own contacts count. The service test `pathsByCaller` shows the member's own contact path
   once they're ready, and the search caller is the member's own external id. `includesOwnNetwork` is true. Pooled
   cached paths are deleted when the member joins.
4. **PASS for named connectors and intro asks. One observation (O1).**
   - Pooled searchers never see a refuser as a connector:
     - A degree-2 path whose introducer is a refuser is dropped.
     - A degree-3 path whose starter is a refuser is dropped.
     - A direct (degree 1) path is dropped.
   - `POST /api/intros/create` with `connectorSlug` set to a refuser returns 409 `intro_not_connector`, for both pooled and connected searchers.
   - Cached paths re-read after a sharer leaves no longer contain that sharer, and an ask through them returns 409.
   - A member who leaves the group has their cached paths dropped, and their next search is pooled.
   - Chosen introducers still apply to pooled paths.
5. **PASS.** Village off.
   - With no keys, Meet shows "Village isn't connected yet" (`v6`), and `/api/network/search` returns 503 `not_configured`.
   - With no group, the status says `canSearch: false` and search returns 409.
   - The architecture tests, including the 404-when-off tests, pass.
6. **PASS.** Consent rules.
   - Before consent, the member's own external id is never minted, never joins the group, and never makes a Village call.
   - At the sync step (consented, not synced), searches are still pooled and the member doesn't join.
   - `/api/network/sync-token` returns 409 at the LinkedIn and consent stages, both in the tests and in the demo app as Sam. It returns 200 only at the sync step.
   - The search, paths and status responses never contain `fake-token`, `community-pooled-search` or the service email.
7. **PASS, except B1.** Break attempts.
   - A pending Village link blocks search and paths with 409 `village_link_mismatch`, and the status shows `canSearch: false`.
   - An unconfirmed email blocks with 409 `email_not_confirmed`, and nothing is sent to Village.
   - When the group is deleted, search returns 409. When a new group is created, the search identity joins it again (2 joins).
   - The daily limit returns 429 for pooled search and pooled paths without calling Village.
   - When Village refuses pooled paths, the member gets 409 `pooled_search_unavailable` with the plain message.
   - The creator can leave when only the search identity is left in the group (existing test).

## Bugs
**B1 (high): an intro ask from a member who hasn't connected expires the moment it's made.** It is new with this change.
- `expireDueIntros` (`src/modules/intros/reads.ts`) expires every open ask whose requester or introducer hasn't joined
  the group. `transitionIntro` also requires `hasBothParticipantsJoined`.
- Pooled searchers are never joined. So `POST /api/intros/create` returns 200 with `state: "expired"`, and the connector can never accept the ask.
- The "intro asked" email is still queued to the connector (the outbox row was `intro_asked`, skipped in demo).
- In a real install the connector gets an email about an ask that is already dead.
- Repro in the demo app:
  1. Reset Sam to never connected.
  2. On Meet, search, open Dana Whitfield, and click "Ask Marcus for an intro" with a note.
  3. Send. The ask shows "Expired" on Intros (`v3`).
- Repro in the tests: as a never-connected member with cached pooled paths, call `postCreate` with a sharer's slug. The response has `state: "expired"`.
- The changed intros test ("lets a requester who hasn't joined ask a member who shared") only checks the 200.

## Observations (not blocking)
- **O1: a refuser can still be named as an outside contact.**
  - Case: a degree-3 path whose introducer is a refuser and whose starter is a sharer (sharer → refuser → target). For pooled searchers this path is kept.
  - The refuser's name then appears as `throughName`, as the path's introducer, and in the reason text stored on the ask ("Sharon knows Rufus Person, who can reach Target.").
  - They are never a connector or a member.
  - Connected searchers had the same behaviour before this change. It is arguably the sharer's own contact data, but it conflicts with the module rule "Never name a path through a member who hasn't agreed to share." The owner should decide.
- **O2: the consent step's "You get" box is now out of date.** It still says "You gain access to the networks of the other members in return",
  but members now get that without sharing.
- **O3: the member count doesn't update after connecting.** It still read "12 members' networks, including yours" right after Sam joined, until a reload (13 would be right).

## Could not verify
- Whether live Village lets a never-synced identity with a full grant, in a group, search that group. Only the fake Village
  and the demo answers model it.
- The real Village group-creator leave rules.

## Cleanup
- The throwaway databases were dropped.
- `.env.local` and the scratch test file were deleted.
- The dev server was killed, and nothing listens on its port.
- `git status` shows only `reports/verify/` (6 small JPEGs) and this report.

## Re-check after repair 1
This re-check covers commit d22503c only, with the same rules: throwaway databases, a scratch test file that was deleted
afterwards, and the demo app.

- **Lint, typecheck and tests:** lint and typecheck exit 0. `vitest run src/modules/network src/modules/intros src/modules/asks src/test/architecture`: 33 files and 1340 tests passed.
- **B1: PASS.**
  - In the tests: a never-connected member's ask through a sharer comes back `requested`. It shows on both boards. The
    connector accepts and gets a consent link, the target's "yes" returns 200, and the row becomes `target_agreed`.
  - Break attempts:
    - A banned asker's ask disappears from the connector's board, and accepting it returns 404.
    - A connector who left the group closes the ask (`expired`), and accepting it fails.
    - "I know someone" on an ask whose author never connected creates an intro in `asking_target`, not expired.
    - A helper who never connected can't offer an intro (409).
  - In the demo app: Sam, never connected, asked Marcus about Dana. The ask is `requested` in the database and shows "Waiting for an answer" (`v7`).
- **O1: PASS.**
  - The fake Village returned three paths:
    - sharer → refuser → target;
    - a path whose starter is the refuser;
    - a path through the sharer only.
  - Pooled and connected searchers both see only the sharer-only path. The refuser's slug and name appear nowhere in the paths, connectors, ask response or stored reason. An ask through the refuser is refused.
  - A sharer who is banned disappears from the paths too.
  - A non-sharing member as the target still gets their path through a sharer.
- **O2: PASS, with a wording nit.** The "You get" text no longer says that sharing unlocks search. The new sentence reads
  awkwardly ("Your searches cover … and see who can introduce you"). That's a copy nit, not a blocker.
- **Cleanup:** the databases were dropped, `.env.local` and the scratch test were deleted, the dev server was killed, and nothing listens on its port.
