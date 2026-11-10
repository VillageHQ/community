# Slack, Discord and perks: charter

Approved scope: the owner's build plan for merging Founderhall's strengths into Community (wave 3). The maintainer
agreed and reviews after merge. This page restates that brief; it is the scope of this build.

## Direction

A community that already lives in Slack or Discord should see new asks there, and members should be able to post an
ask without leaving Slack. A community with a BuiltFirst perks marketplace should show it inside the app. All of it
is off until an admin turns it on.

In:

1. **Chat module, off by default.** Admin › Chat connects Slack (an app manifest generated for this site, paste the
   bot token and the signing secret, pick a channel, send a test post, pause and resume, disconnect) and Discord
   (bot token and channel id, REST calls only, no gateway). Tokens and the signing secret are sealed with the setup
   token, like the Village secret.
2. **Posts.** Each new ask is posted once per connected channel. One weekly line ("this week: N intros made, M asks
   open") goes out after the weekly email run. Both go through the job runner and a post ledger, so each item posts
   once per channel, whatever restarts or retries happen. A "slow down" answer (429) is waited out. A revoked token
   shows on the admin page in plain words.
3. **Slack `/ask`.** A member types `/ask <what they need>` in Slack. The request's signature must be valid and at
   most 5 minutes old. The member is found by the email Slack holds for them, which must match a member's verified
   email. The ask is posted as that member and counts against the weekly allowance.
4. **Perks module, off by default.** Admin › Perks takes a BuiltFirst embed code and keeps only the iframe's address,
   and only when it is https on builtfirst.com or a subdomain. Members see it at `/perks` in a sandboxed frame, with
   that page's own Content-Security-Policy. While it's on, Today shows a Perks card.
5. **Setup checklist.** The admin's checklist offers "Post new asks to your Slack" as an optional step that never
   holds back "setup complete".

Out: Slack OAuth install flow (the admin pastes tokens), Discord gateway or slash commands, posting updates or
answers, reading anything back from Slack or Discord, BuiltFirst accounts or single sign-on.

## Deciding facts (assumptions)

- **Who is named.** A post names the author by first name only. Community has no "hide me from the directory"
  switch yet, so the rule hooks onto the one place that decides directory listing: a member not listed there
  appears as "a member". Today every active member is listed.
- **The silent block.** A channel is read by everyone in it, so a block can't be applied per reader. An ask whose
  author blocked someone, or was blocked by someone, is not posted to chat at all. Nobody is told.
- **What posts.** Open asks (kind "ask", not updates) by active members, created after the channel was connected,
  so connecting doesn't flood the channel with old asks.
- **The weekly line.** It posts once per week name (the weekly email's week), after the weekly email job has
  finished for that week, and only for channels connected before that week's moment.
- **`/ask` with Asks off.** Slack gets a plain refusal; nothing is posted.

## Journeys and tests

- Admin connects Slack and Discord against fake servers, picks a channel, sends a test post.
- A new ask posts exactly once per channel, also after a forced 429 and a second job run.
- `/ask` with a bad or old signature is refused; from an unknown email is refused; from a member posts the ask and
  uses the allowance.
- A non-BuiltFirst embed is refused; a BuiltFirst one keeps only its https src.
- Both modules off: every page and API they own answers 404 (the architecture test covers this for every module).

Tests: Vitest service and route tests against a fake Slack/Discord server (new, under `src/test/`), plus lint,
typecheck and the architecture tests. About 30 minutes. Build: about 4 hours.

## Proof

Screenshots of Admin › Chat and `/perks` at 390 and 1280 px, the fake server's received posts, and the `/ask`
answers, in `reports/`.
