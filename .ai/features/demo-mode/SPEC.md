# Demo mode (what it does now)

One env setting, `DEMO_MODE=true`, turns an install into a sales demo. Any other value, or none, is off, and then
nothing of the demo exists: no buttons, no strip, no route (`POST /api/demo/sign-in` answers 404), no reset job.

## With the switch on
- **Start:** after migrations, an empty database is filled with "Northwind Founders", a made-up fund community
  (`src/shell/demo-seed.ts`, people in `src/platform/demo/people.ts`): 20 members at example.com (Maya the admin,
  Sam a founder), profiles, cohorts and tags, 13 who share their network, 2 open invites, intros in all nine states
  plus 18 finished ones over two quarters, 9 asks with offers, answers and helpers, and one message thread with one
  unread. Network, Intros, Asks and Messages are on; Feed, Jobs, Perks and Slack/Discord are off.
- **Refusal:** a database with any member not at example.com (or anonymised by a removal), or with members but no
  `demo_seeded_at` setting, stops the server at boot with a plain message. Invites in the demo can only be accepted
  for example.com addresses.
- **Sign-in:** "Try it as Sam, a founder" and "Try it as Maya, the admin" on the sign-in page. A one-minute
  sign-in link is made and used on the server, so the session is an ordinary one. Email sign-in is hidden.
- **Label:** a "Demo" strip at the top of every screen (root layout).
- **Nightly reset:** the `demo-reset` job (checked every 15 minutes) runs once after 04:00 UTC. It empties every app
  table except the migrations record and job leases, keeps the sign-in secret and the tick secret, and re-seeds, in
  one transaction. It refuses if the database is not the demo's. Everyone is signed out by it.
- **Nothing leaves:** a fetch guard installed at boot (`src/platform/demo/outbound.ts`) lets the app call itself,
  answers Village (forced to `https://village.demo.invalid`) with canned made-up results, and refuses everything
  else. Emails queue as usual and finish as "skipped" with "Demo: kept in the sending log, not sent."; screens
  treat them as handled.

## Known limits
- Canned search returns the same ten people whatever the query.
- LinkedIn links point at linkedin.com with made-up profile names; Perks (if turned on) frames builtfirst.com in the
  visitor's browser; "Check the domain" in Settings does a real DNS lookup. None of these is server HTTP.
- Settings shows the made-up Village key as stored unencrypted unless `SETUP_TOKEN` is set.
