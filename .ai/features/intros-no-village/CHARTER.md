# Charter: intros without Village, and "Ask for an intro" on profiles

**Approved:** 2026-11-11, the owner's pick in the build plan (Founderhall merge, wave 1). This page is the approved scope.
**Spec:** [intros-from-profile](../intros-from-profile/SPEC.md) (this build covers its first two items).

## Direction
Intros work when the fund has no Village, or Village is down. A member asks another member to introduce them to someone
they name: name, company, and optionally an email address or a LinkedIn link. The ask keeps today's double opt-in,
reminders, expiry, outcomes and privacy. Every member's profile gets "Ask <name> for an intro", which opens the ask
dialog with that member as the connector. With Village on, the profile also shows "Who <name> can introduce you to".
The Intros module no longer needs Network. Village paths stay as an extra way to start an ask when Village is on.

Out: the finer intro rules in the same spec (7 days per step, the admin's outcome day, an event history, the connector
on the joining email). They stay on the roadmap.

## Deciding facts (and the call made on each)
1. **Who the named person is.** An ask from a profile has no Village path. The person is kept as the name and company
   the asker typed. The LinkedIn link, if given, becomes their LinkedIn slug, so "stop all asks" and "no thanks" match
   the same person across every ask. Without a link, the key is the name and company together, never the email.
2. **The asker's email for the person.** It is kept only while the ask is open, and only the connector sees it. It
   fills in the address field when the connector emails the yes-or-no link. It is cleared when the ask closes, as the
   connector's own address already is. A member's own address is refused.
3. **No network membership needed.** Today an ask closes if either member hasn't joined the Village group. A named ask
   needs only two active members. Path asks keep the old rule.
4. **"Who <name> can introduce you to"** follows Founderhall. Village never hands over a member's contact list, so the
   panel says whether the member shares their network with the community, then offers Search: when they know the person,
   the path shows "via <name>". It never lists their contacts.
5. **Network becomes optional.** Intros still imports Network's public files for path asks, but only uses them when
   Network is on. A path ask with Network off is refused. The admins' "chosen introducers" Village setting applies to
   named asks only while Network is on.

## Architecture
One migration (0028) on `intro_request`: `is_named_target`, `suggested_target_email` (open asks only),
`introducer_linkedin_slug` may be empty. The manifest drops `requires: [network]` and `needsVillage`. The create route
takes either a path ask (`targetSlug` + `connectorSlug`) or a named ask (`connectorId` + the person). The profile page
renders an intros button and a network panel, each only when its module is on.

## Journeys and tests
- Ask for an intro (core journey): the existing intro tests, plus new tests for a named ask with Village off (create,
  connector yes, the person's yes by email, the joining email, the partner report count) and for the profile
  button and panel.
- Lint, typecheck, architecture tests. The full suite runs in CI.

## Proof and estimate
Proof: screenshots of the profile with the button and the dialog (390 and 1280 px), the panel with Village on, and the
real HTTP run of the whole named-ask flow. Build about 3 hours, tests about 1 hour.
