# How the public pages and the welcome steps work today

Founderhall's sign-in, invite and welcome screens on Community's engine (transplant area 8). Every signed-out page
is Founderhall's public page: `PublicPage` (fund mark, one card, a 12 px footer) from `src/components/public-page.tsx`;
`PublicMessage` there is Founderhall's message page (heading, lede, one button row) for the Community-only pages.

## Routes (Founderhall's paths; the old ones redirect permanently in `next.config.mjs`)
| Page | Route | Old route |
|---|---|---|
| Sign in, "Check your email" | `/signin` (`src/app/signin/`) | `/sign-in` |
| Sign-in link confirm, bad link | `/auth?token=` (`src/app/auth/`) | `/sign-in/link?token=` |
| Invite | `/invite?token=` (`src/app/invite/`) | `/join/<token>` |
| Welcome step 1, step 2 | `/welcome`, `/welcome/privacy` (`src/app/(app)/welcome/`) | — |
`ROUTES.signIn`, `ROUTES.signInLink`, `ROUTES.join` hold the new paths; `toInvitePath(token)` builds an invite link.
`/invite` and `/auth` carry tokens, so they get `Referrer-Policy: no-referrer` and `X-Robots-Tag: noindex`.

## Sign in
- `SignInScreen` (client) is the whole page: the link form, the demo buttons, the invite-only line, and a quiet
  "Sign in with a password" switch (Community keeps passwords; Founderhall has none). After a link is asked for, the
  same page becomes "Check your email" (one answer for every address).
- The link form shows where email is set up and in the demo (whose links go nowhere, as anywhere with no mail).
  Elsewhere the password form leads. A new admin (`?adminCreated`) gets the password form and a note.
- `/auth` reads the link without using it (`readSignInLinkEmail`) to show "Signing in as <email>" or "That link
  doesn’t work any more"; only the Sign in button's POST (`/api/sign-in-link`) signs in.
- The email is Founderhall's plain text, word for word (`src/platform/email/sign-in-link-email.ts`); the HTML part
  is the same words (`plain-text-email.ts`). The password reset email uses the same frame.

## Invites
- One button, "Accept and sign in": `POST /api/invites/accept` with only the token creates a passwordless account
  (`acceptInvite(…, null)`, name = the invite's name or the start of the address) and signs it in through a one-minute
  server-made link (`signInUnconfirmedMember` in `src/platform/auth/server-link-sign-in.ts`, the demo's pattern). The
  link sign-in would mark the email confirmed; it is set back to unconfirmed, because a copied invite link proves
  nothing, and the confirmation email is sent as before. A join from the EMAILED link (its `e=` mark) stays confirmed
  and gets no confirmation email (the owner's call, 2026-11-12; `.ai/features/fh-followup/NOTES.md`). A name and a password in the body still work.
- Every unusable invite (used, expired, withdrawn, unknown) reads the same, as Founderhall's bad-link page; too many
  tries from one place get the wait-a-minute line.

## Welcome (two steps, inside the member shell)
- `resolveOnboardingStep`: no profile or finished → done; step 1 not saved → `card`; else `introAsks` (= step 2,
  privacy). Sharing a network is no longer a step; it waits on the network page.
- Step 1 posts to `/api/onboarding/welcome` (`welcomeAboutBodySchema` in `src/shell/welcome-steps.ts`): name,
  "What are you working on?" (the card's `bio`), "Who could you help with?" (`canHelpWith`), role, company, city.
  Founderhall's errors: the name first, then "Answer both questions; a line each is enough."
- Step 2 posts to `/api/onboarding/privacy`: directory visibility (`isHidden`), intro asks (while intros are on,
  saved with place "onboarding"), profile fill-in (while an admin turned fill-in on), then onboarding is done. A
  member lands on the directory with the flash "You’re in. This is the directory."; an admin on the console.

## Seams with other areas
- The directory flash is shown by the shell's client flash on `ROUTES.members`; when the directory moves to
  `/directory`, `finishWelcome` returns the new route and the flash follows it.
- The fund mark shows initials while the community has no logo (the demo has none).
- `StepPills` now draws the dots above "Step n of 2", as Founderhall does (also used by two network screens).
- Old onboarding parts (`CardStep`, `IntroAsksStep`, `ConfirmationStep` in the members module) are no longer used by
  `/welcome`; the members area removes or reuses them.
