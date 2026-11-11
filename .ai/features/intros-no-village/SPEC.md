---
id: intros-no-village
status: in-progress
waits-on: []
touches: ["src/modules/intros/", "src/shell/intro-*", "src/app/(app)/members/", "src/modules/network/"]
---
# Spec: Intros without Village, and "Ask for an intro" on profiles

**Added:** 2026-11-11 (the owner's pick in the Founderhall merge plan). Part of [intros-from-profile](../intros-from-profile/SPEC.md).

## What it does
Intros work when the fund has no Village, or Village is down. On any member's profile, "Ask <name> for an intro"
opens one dialog: the person's name and company, optionally their email (only the connector sees it) or LinkedIn
link, and why. The ask then runs the same double opt-in as a path ask: the connector says yes, the person says yes
on a private link, one email joins them, and the partner report counts it. With Village on, the profile also shows
"Who <name> can introduce you to": whether their network is shared, and a Search button, never their contacts.
The Intros module no longer needs Network; Village paths stay a second way in.

## Not in it
7 days per step, the admin's outcome day, an event history, the connector on the joining email
(in [intros-from-profile](../intros-from-profile/SPEC.md)).

How it works: [NOTES.md](NOTES.md). Approved scope: [CHARTER.md](CHARTER.md).
