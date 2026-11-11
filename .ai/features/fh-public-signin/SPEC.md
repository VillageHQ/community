---
id: fh-public-signin
status: in-progress
waits-on: [fh-foundation]
touches: ["src/app/signin/", "src/app/auth/", "src/app/invite/", "src/app/(app)/welcome/", "src/app/setup/", "src/app/sign-up/", "src/app/forgot-password/", "src/app/reset-password/", "src/app/recover-admin/", "src/app/confirm-email/", "src/app/unsubscribe/", "src/app/weekly/", "src/app/not-found.tsx", "src/app/(app)/error.tsx", "src/shell/onboarding.ts", "src/shell/welcome-steps.ts", "src/platform/email/sign-in-link-email.ts", "src/platform/email/password-reset-email.ts"]
---
# Spec: Founderhall's sign-in, invite and welcome pages (transplant area 8)

**Added:** 2026-11-11 (the owner's decision: keep Community's engine, copy Founderhall's screens exactly).

## What it does
Sign in at `/signin` with an emailed link first ("Check your email" after), the demo's two one-click buttons, and
Community's password behind a quiet link. The emailed link opens `/auth`, which says who signs in, or that the link
no longer works. An invite opens `/invite`: "Join <community>", one "Accept and sign in" button, no password. New
members answer two welcome steps (about you; your privacy) and land on the directory with "You’re in. This is the
directory." The 404, the in-app error and Community's own public pages (setup, sign-up closed, forgot and reset
password, recover admin, confirm email, unsubscribe, the weekly one-tap answer) use Founderhall's public card. The
sign-in link email is Founderhall's, word for word. Old paths (`/sign-in`, `/sign-in/link`, `/join/<token>`)
redirect permanently.

## Not in it
The invite email's words (console area), the directory page itself (directory area), My profile and Email settings.

How it works: [NOTES.md](NOTES.md). Approved scope: [CHARTER.md](CHARTER.md).
