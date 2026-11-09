# Charter: two-sided intros

Approved scope (the owner's build plan, wave 1 part 2; the maintainer agreed and reviews after merge).

## Direction
Finish the maintainer's open pull request #8 "Double opt-in intros, with outcomes" on top of current main, then fix
what the reliability review found. In: everything #8 does (target consent page `/meet/<token>`, yes / no thanks /
stop all, opt-out table, outcome prompt, Health totals). Out: a job runner or outbox (another part builds them).

## Steps
1. Bring #8 onto current main (main now talks to Village through `@villagehq/sdk`). Conflicts touching the Village
   client go main's way. #8's migration becomes `0014_double_opt_in_intros`, after `0013_asks`.
2. Fix:
   a. A second tap on the target's link shows the answer already given, never a failure, and never counts as a
      failed try against the rate limit.
   b. A new consent link never silently kills one the connector already forwarded: every link for an intro stays
      valid until one is used or the intro closes.
   c. "Did it help?" goes by email as well as in the app: one email 14 days after the intro (was 7 in the app), one
      reminder 3 days later. With no scheduler yet, it is sent from the read-time path, with a TODO for the job runner.
   d. The opt-out record is an HMAC of the slug, keyed with the app's secret, not a plain SHA-256.
   e. A failed consent email rolls back only its own claim, and only while the intro still waits on the target.

## Decisions taken
- (b) Links live in a new `intro_consent_link` table (one row per link). They stay after the answer, so (a) can
  show it. Simpler than a "this link was replaced" page, and safe: a link only ever shows its own intro's answer,
  and never to the requester or connector.
- (d) Keyed with `BETTER_AUTH_SECRET` (or the generated auth secret). Cost: rotating that secret forgets earlier
  stop-all choices. Noted in the module notes and the pull request.
- (c) Outcome emails go only while no answer exists; a "not yet" in the app ends the emails.

## Acceptance checks
Double-click or repeat on create and on the target's yes: exactly one intro and one state change. Connector yes:
target asked. Target yes: intro email to both. Target no: asker told kindly, with no reason. Outcome email arrives
when due. Stop all blocks future asks. A second tap shows a calm page.
