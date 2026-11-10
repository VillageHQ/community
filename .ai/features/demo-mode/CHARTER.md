# Demo mode for sales (approved scope)

Approved by the owner as part of the Founderhall-to-Community build plan (wave 3, plan item 12). This page restates
the brief and records the small calls taken while building.

## Direction
One switch turns an install into a sales demo. With it off (the default) nothing of the demo exists.

In:
1. **The switch:** the env setting `DEMO_MODE=true`. Anything else is off.
2. **A made-up fund community**, "Northwind Founders": about 20 made-up members at example.com with initials (no
   photos), profiles, cohorts and tags, members who share their network, intros in every state, asks with offers,
   answers and helpers, a direct message thread, open invites, and enough intro history for a partner report with
   real-looking counts.
3. **"Try the demo"** on the sign-in page: one click signs in as a member or as the admin. No password, no email.
4. **A nightly reset** back to the seed, through the existing job runner.
5. **Safety:** in demo mode no email or Slack/Discord message leaves the server (emails stay in the sending log,
   marked as demo), Village calls get canned made-up answers (no real Village key), any other outside HTTP call is
   refused, and a "Demo" label shows on every screen.
6. **Never by accident:** with the switch on, the app refuses to start when the database holds members the demo did
   not create, and says so in plain words.

Out: real photos, a demo of the setup wizard, Slack or Discord connected for real, a marketing-site change.

## Small calls taken
- The demo's own code: `src/platform/demo/` (the switch, the guard, the outside-call guard, the canned Village
  answers) and `src/shell/demo-*.ts` (the seed and the reset, which write every module's tables).
- "Non-demo members": any member whose email is not at example.com, or any member at all in a database the demo
  did not seed (the seed writes a `demo_seeded_at` setting). An empty database is seeded at start.
- In demo mode an invite can only be accepted for an example.com address, so a visitor can't add a real person who
  would then block the next start.
- Demo sign-in reuses the real sign-in-link session path (a one-minute link made and used on the server), so the
  session is a normal one.
- The reset runs once a night after 04:00 UTC; it empties every app table (the migrations, the sign-in secret and
  the tick secret stay) and re-seeds in one transaction, and it refuses if the demo marker is gone.
- Emails in demo mode finish as "skipped" with the note "Demo: kept in the sending log, not sent."
- The sign-in-by-email option is hidden in demo mode (no email can arrive).

## Acceptance (checked by a separate verifier)
- With the switch on, one click signs in as a member and as an admin.
- Every main screen shows populated made-up data.
- The nightly reset restores the seed after edits.
- No outbound mail or HTTP to real services happens.
- With the switch off nothing of the demo is reachable.
- Turning it on over a database with real members refuses with a plain message.
