# Journey: sign in

> ⚠ RECONSTRUCTED from code on 2026-11-10 — needs confirmation
> Sources: `.ai/features/email-signin/SPEC.md`, `src/app/sign-in/`, `src/app/api/sign-in-link/`.

Who: any member, usually on a phone.

1. The member opens `/sign-in` → with email set up, "Email me a sign-in link" comes first; "Sign in with a
   password instead" opens the password form. With email off, sign-in is password only.
2. They type their email → the same answer for every address ("If that email belongs to a member here…"); only an
   active member gets an email.
3. They open the emailed link → `/sign-in/link` shows only a "Sign me in" button (a mail scanner opening the link
   signs nobody in). The link works once, for 15 minutes.
4. They tap it → signed in, on Today. A link sign-in also confirms their email.
5. Optional: they add a password under "How you sign in" on their card (`/members/card`) as a backup if email fails.
   Forgot your password (`/forgot-password`) resets it.

Tests: `src/app/api/sign-in-link/route.test.ts`, `src/app/sign-in/page.test.ts`.
Known gap: switching to the password form clears the typed email (roadmap, open).
