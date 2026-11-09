---
status: building
---
# Sign-in by email link, and bulk invites

## Sign-in by email link
- When email is on, /sign-in shows "Email me a sign-in link" first; "Sign in with a password instead" opens the
  password form. With email off, sign-in is password-only and admin Settings says so in the Email card.
- Every address gets the same answer ("If that email belongs to a member here…"). The email goes only to an active
  member with a real address (not banned, not removed). Limits: 5 requests a minute per IP when the host names a
  trusted IP header (Better Auth), 2 links a minute per address and at most 5 live links per address.
- The email goes through the email queue (kind `sign_in_link`), queued after the response as the password reset is,
  so known and unknown addresses answer in the same time. The queue clears the body, and so the link, once it is sent
  or given up; an admin sees only its subject.
- The link opens /sign-in/link, which only shows a "Sign me in" button. The button POSTs to /api/sign-in-link, which
  calls Better Auth's magic-link verify on the server. Wrong links are limited per IP only when the IP is trusted
  (one shared bucket would let anyone block every member); a sign-in gives its slot back. The verify endpoint itself answers 404 over HTTP, so a GET of
  any link never signs anyone in.
- A link lasts 15 minutes, works once, and is stored only as a SHA-256 hash.
- A link sign-in confirms the email. If the account was not yet confirmed, Better Auth first deletes its password and
  sessions (whoever set them never proved they own the address); the confirm page says so.
- A member without a password adds one under "How you sign in" on their card page (/api/profile/password).
  Changing a password stays with Forgot your password.

## Bulk invites
- Admin › Members › "Invite many people": paste a list (one per line: `Name, email`, `Name <email>` or a bare email;
  up to 500) or upload a CSV (name, email, optional company and cohort, header in any order or none; up to 20,000
  rows or 8 MB; quoted cells, semicolon files, BOM, CR/LF/CRLF).
- Each person gets the usual single-use 14-day invite, audited per person ("From a list"). Members and pending
  invites are skipped, expired invites renewed, repeated emails skipped; every skip and bad line is named by line.
- Name, company and cohort are kept on the invite. The join form starts with the name; the company goes onto the new
  member's card.
- Leading formula characters (= + - @ tab CR) are dropped from imported text. With email off, the admin downloads
  the links as a CSV whose cells cannot run as formulas.
- Each invite email is queued in the transaction that issues its invite, so none is lost; the email queue sends them
  and retries a failed one. A renewed invite stops its older queued email.
