# Asks that reach helpers

What it does now.

- Asks is on by default for a new community. A community that already had members when this shipped keeps the state it had.
- A member posts an ask or an update. An ask can name one person to reach, by LinkedIn link.
- When an ask is posted, members who may help are found:
  - members on the author's network path to the named person, only members who joined the community group (and so agreed to share);
  - up to 5 members whose "can help with" line or tags share a real word with the ask (plain word overlap; stop words and everyday words such as "first" or "team" never count; the same rule picks the Today list, and every helper emailed sees the ask on Today).
  Members blocked in either direction are never helpers. Each helper gets one email ("Asks you could help with" topic, one-click unsubscribe). A failed path lookup never stops the ask.
- On the board, a helper sees why they were picked. Anyone else can:
  - "I know someone": starts a two-sided intro with them as the connector, waiting on the person's yes. They make the consent link on the Intros page. Their note also reaches the author as an offer. With Intros off, it saves a private note instead.
  - "I've done this myself": posts one public answer under the ask. Answers can be reported, and admins remove them from the report queue.
- The author sees the helpers under Your asks, and can ask a path helper for the intro.
- One weekly allowance (default 5, admin sets 1 to 100 under Your asks) counts asks posted and intro asks sent in the last 7 days. An intro ask that is declined, expires or is withdrawn gives its place back. Updates and helper-offered intros don't count. Closing an ask doesn't give it back.
- A connector receives at most 10 intro asks a week (helper-offered intros and withheld asks don't count).
- Updates have their own filter on the board, get no helpers and no answers, and can be reported like an ask.
