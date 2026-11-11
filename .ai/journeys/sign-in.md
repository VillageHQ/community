# Journey: sign in

> Sources: `.ai/features/fh-public-signin/NOTES.md`, `src/app/signin/`, `src/app/auth/`, `src/app/api/sign-in-link/`.

Who: any member, usually on a phone. The screens are Founderhall's (one card under the fund's mark).

1. The member opens `/signin` (old `/sign-in` redirects) → "Sign in to <community>", "Email me a sign-in link"
   first; in the demo, "Try it as Maya (admin)" and "Try it as Sam (member)". A quiet "Sign in with a password"
   link opens the password form (Community keeps passwords). With email off and outside the demo, the password
   form leads.
2. They type their email → "Check your email": the same answer for every address; only an active member gets one.
3. They open the emailed link → `/auth?token=` shows "Signing in as <email>" and one Sign in button (a mail scanner
   opening the link signs nobody in). A used or expired link shows "That link doesn’t work any more" before any press.
   The link works once, for 15 minutes.
4. They press it → signed in, on their landing. A link sign-in also confirms their email.
5. Optional: a password on My profile as a backup; Forgot your password (`/forgot-password`) resets it.

Tests: `src/app/api/sign-in-link/route.test.ts`, `src/app/signin/page.test.ts`, `src/app/signin/sign-in-choice.test.ts`,
`src/platform/email/sign-in-link-email.test.ts`.
