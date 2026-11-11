# Charter: members can search before connecting their own network

Approved scope: the owner's build brief for this wave (the owner picked it; the maintainer reviews after merge).

## Direction
Any signed-in member can search the community's pooled networks at once. These are the networks of the members who
chose to share. Before this change, "Meet" showed the search only after the member entered their LinkedIn link,
agreed to share and synced. Connecting and sharing your own network becomes an invitation shown with the results
("Add your network so others can reach people you know"). It is never a gate.

In: search and the intro paths for members who haven't connected, the invitation, and asking a sharing member for an
intro from those paths. Out: changing how a member connects, consents or syncs; Teams; new settings.

## Deciding facts
1. **Whose identity runs the search before a member syncs.** Village runs a search as a user, and a user sees a
   group's pooled networks only after they join the group. Joining the group with the member's own identity
   before they agree would share their network as soon as they later sync, without their yes. So the search runs as
   one app-owned identity, "community search". It has a full grant (Village needs a real user to join a group; a
   `public` grant creates no user). It joins the community group once and never syncs, so it brings no network
   of its own. It uses the service email from Settings, or else the first admin's email (the same rule as the
   profile fill-in). Its token never leaves the server. This follows Founderhall's community token.
2. **Consent stays as it is.** A member's own network is searched, and shared, only after they agree and sync (which
   joins the group with their own identity). Then their searches run as themselves, and their own contacts count.
3. **Paths only through members who shared.** Pooled paths keep only steps through members who joined the group.
   A path through anyone else is dropped before anything reads it. The "chosen introducers" setting still applies.
4. **Unverified with live Village:** whether a never-synced identity in a group may search the group. The fake
   Village models it as allowed. If Village refuses, the member sees a plain message and the invitation to add their
   network. No real Village account is used in this build.
5. Members still need a confirmed email, a configured Village and an existing community group to search. A
   pending Village link (a different email) still blocks until an admin approves it.

## Journeys and tests
- Meet / network search (`.ai/journeys/`): network module tests (service level, fake Village), the network-search
  component test, lint, typecheck, architecture tests. CI runs the full suite.
- Verification: a separate agent, fake Village, made-up members. A brand-new member searches and sees paths
  through sharers. The invitation shows. After connecting, their own contacts count. A member who refused sharing
  is never a path. Nothing breaks with Village off.

## Proof and estimate
Proof: screenshots of Meet for a member who never connected (390 and 1280 px), and the service output.
Build about 2–3 hours, tests about 1 hour.
