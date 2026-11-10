# Charter: intro fixes from the final check

Approved scope (the owner's brief after wave 3 of the Founderhall merge; the maintainer reviews after merge).
Evidence: the merged app's final reliability check (scenarios C5, C6, C7, F2) and the parity map in `.ai/roadmap.md`.

## Direction
Five intro bugs, each with a failing test first, then the fix. Nothing else.

1. **Empty note on "no".** Saying no with the private note left empty fails: the browser sends no note, the server
   only took text. The server accepts an empty note.
2. **A forwarded link ends the intro.** When the connector copies the link and forwards it, the person who says yes
   was never asked for their email, so the joint email never went out and the intro waited on "Mark as introduced".
   The yes page now asks for their email when the app doesn't have it (and email is on), then sends the one joint
   email to both and counts the intro as made. "Mark as introduced" stays for intros made outside the app.
3. **Unanswered intros go quiet.** One reminder to a connector who hasn't answered 4 days after the ask (the same
   pattern as the target's day-4 reminder), and one kind email to the asker when the intro expires. Each sent once,
   through the outbox and the job runner.
4. **A connector who said no still shows as a way in.** They leave that asker's paths list for that person.
5. **The "no thanks" link later says "stopped intro requests".** Each answer is saved on its intro, so the link
   shows the answer given on it, in plain words, and mentions a later "stop all" only as a later step.

## Decisions taken
- (2) The email is required for a yes only when email is on and the app has no address; with email off the page
  works as before ("the connector will connect you"). The asker's or connector's own address is refused.
- (3) The expiry email goes to the asker only, and never says who didn't answer (the asker can't tell a connector's
  silence from the person asked). The connector reminder skips withheld or blocked asks.
- (4) Only a connector's own no (state `declined`) hides them; it stays hidden for that asker and that person.
- (5) A new `target_answer` column holds the answer; rows from before it fall back to the old reading.

## Out
Village paths themselves, the asker's allowance wording, reply by email, the intro expiry length.
