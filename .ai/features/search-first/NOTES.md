# How search before connecting works

- `src/modules/network/service.ts` `readSearcher`: a member who joined the group searches as themselves; anyone
  else is a "pooled" searcher. Search, paths and the intro ask's connector check all go through it.
- `src/modules/network/service-search-pool.ts`: the pooled session. It runs as one app identity
  (`createVillageSearchSession` in `src/platform/village/client.ts`, id `community-pooled-search`, full grant, the
  service email or else the first admin's). It joins the community group once; the group id it joined is kept in
  the `village_search_group_id` setting, cleared when the group is deleted. It never syncs, and its token never
  leaves the server.
- Why not the member's own identity: Village shows a group's networks only to group members, and joining with the
  member's identity before they agree would share their network the moment they later sync.
- `keepSharingMembersPaths`: pooled paths keep only steps through members who joined the group. Direct paths and
  steps through anyone else are dropped before anything reads them. The admin's "chosen introducers" rule applies after.
- The search identity counts as a group member, so Village would block the group's creator from leaving while it
  is in. `leaveSearchIdentityForLastMember` takes it out first when the creator is the last member (leaving, and
  removal by an admin).
- Status: `canSearch` is true when the stage is ready, or for the LinkedIn, consent and sync stages once a group
  exists and no Village link waits for approval. `network-flow.tsx` then shows `NetworkSearch` with
  `ConnectInvitation`. Moving to ready clears search and path results kept in the browser; the server deletes the
  member's cached paths when they join.
- Not confirmed with live Village: that a never-synced identity in a group may search the group. The fake Village
  allows it (`isUnsyncedGroupSearchRefused` turns that off), and the app answers a refusal with
  `pooled_search_unavailable`.
- Tests: `src/modules/network/search-first.test.ts`.
