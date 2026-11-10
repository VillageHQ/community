# Where the data is kept, and whom to ask: charter

Approved scope: the owner's build plan for merging Founderhall's strengths into Community (after the fix waves). The
maintainer agreed and reviews after merge. This page restates that brief; it is the scope of this build. Build slug:
`data-setting`; it lives in this item's existing feature folder so the item keeps one spec.

Why: four simulated buyers in the final check asked where the data is kept and whom to ask about it.

## Direction

In:

1. **An admin setting** in Settings, one card "Where your data is kept":
   - where this install keeps its data, free text the admin types (for example "EU, Frankfurt, DigitalOcean");
   - a contact for data requests: a name or role, and an email.
   All optional. The email must be an email address; a bad one is refused with a plain message. A name with no
   email is refused too ("add the email, or clear the name"), because a contact with no way to reach them helps no one.
2. **Members see it on Your data**, in the "What is stored, and where" panel, only when the admin filled it in. The
   email is a `mailto:` link.
3. **The admin sees it** on that Settings card, so a buyer sees it in a demo.
4. **Demo mode** fills both with made-up values (an example.com address).
5. Saving writes the audit log, in the same transaction, like every admin change.

Out:

- No privacy or terms page exists in the app, so nothing is added there.
- The partner report is unchanged (the brief allows Settings instead).
- The data agreement link from the old spec's rough scope (not in this brief).
- No automatic region detection, no compliance badges, no claim the admin did not type.

## Deciding facts

- The values live in the existing key–value settings table, so no migration is needed.
- Nothing new leaves the server: the values only render in pages the app already serves.
- With nothing set, Your data shows exactly what it shows today.

## Journeys and tests

- Member › Your data, Admin › Settings. Tests: the settings read/save and its checks (database test), the route
  refusing a bad email and a non-admin, the demo seed values; lint, typecheck, architecture tests.
- A separate verifier uses the real app with made-up data: sets both, sees them as a member, clears them, checks demo.

## Estimate

Build about 1 hour, tests about 30 minutes.
