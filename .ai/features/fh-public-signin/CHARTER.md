# Charter: Founderhall's sign-in, invite and welcome pages on Community (transplant area 8)

Approved scope: the owner's brief for area 8 of the Founderhall transplant (round 3). Community keeps its engine;
the public pages and the welcome steps are copied from Founderhall exactly (structure, sections in order, parts,
words, look, steps). Founderhall's screens are the acceptance test.

## Direction
- In: sign-in, the sign-in link page, the invite page, the two welcome steps, the 404 and error pages, and the
  Community-only public pages (setup, sign-up closed, forgot and reset password, recover admin, confirm email,
  unsubscribe, the weekly one-tap answer) rebuilt with the foundation's public page and parts. The sign-in link email
  word for word.
- Routes renamed to Founderhall's paths, old ones answer with a permanent redirect: `/sign-in` → `/signin`,
  `/sign-in/link?token=` → `/auth?token=`, `/join/<token>` → `/invite?token=<token>`. Emails link to the new paths.
- Out: other areas' screens (the directory itself, My profile, the invite email's words, the console).

## Decisions (taken under the brief; listed on the pull request)
1. **Email link leads, password stays below** (the brief: "owner to confirm"). The password form opens from a quiet
   "Sign in with a password" link under the card's last line. Where no email can be sent (no mail set up, not the
   demo), the password form leads, as today.
2. **The demo shows the email form too**, as Founderhall's demo does; submitting shows "Check your email" like
   any other address (no email leaves a demo).
3. **Accept an invite with one button** (Founderhall), no password and no name on the invite page. Engine work: the
   invite creates a passwordless account and signs it in through a one-time link made on the server (the demo's
   pattern). The account stays unconfirmed and the email confirmation is still sent, so accepting from a copied
   link proves nothing about the address. The name is asked in welcome step 1. A password can be added later on
   My profile, as today.
4. **Welcome = two steps** (`/welcome`, `/welcome/privacy`): name, what you work on, who you could help, role,
   company, city; then directory visibility, intro asks, profile fill-in. Done lands on the directory with "You're
   in. This is the directory." Community's network steps (LinkedIn, share your network) leave onboarding; they stay
   on the network page.
5. **The sign-in link page shows who signs in** ("Signing in as …") and tells a used or expired link apart before
   any press, by reading the link without using it. Nobody is signed in until the button is pressed.

## Proof and acceptance
Every acceptance shot of area 8 retaken from Community (demo mode, the same made-up people) at 390 and 1280 px
beside Founderhall's, by a verifier who did not build it; the pairs saved in `reports/`. Lint, typecheck, the
architecture tests and the tests for the changed pages green; the full suite in CI.
