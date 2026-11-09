# Charter: sign-in by email link + bulk invites

Approved scope (wave 1 of the Founderhall → Community merge, part 4). Security change: the owner approves the merge.

## Direction
1. **Sign-in by emailed link.** Shown first on /sign-in when email is configured. Password sign-in stays for anyone
   who has a password, and a member without one can add one on their card page. Hardening, all required:
   - single use, 15-minute expiry, token stored hashed;
   - the link opens a confirm page with a button; a GET of the link never signs anyone in (mail scanners);
   - the same answer for known and unknown emails;
   - per-email and per-IP rate limits;
   - banned or removed members get nothing;
   - Better Auth's route allow-list stays closed except what this needs;
   - an email-link sign-in counts as email confirmed;
   - an admin never sees a member's sign-in link anywhere.
   Only offered when email is configured; otherwise sign-in stays password-only and admin Settings says why.
2. **Bulk invites.** Admins paste a list (one per line: `Name, email`, `Name <email>` or a bare email, up to 500) or
   upload a CSV (name, email, optional company and cohort; up to 20,000 rows / 8 MB). Duplicates and bad lines are
   named; each person gets the existing single-use 14-day invite. Formula-injection safe. The members module owns
   invites.

Out: changing invite acceptance, an email outbox (a separate part builds it), member CSV export.

## Deciding facts (assumed)
- Better Auth's magic-link plugin does the token work (hashed storage, atomic single use); its GET verify endpoint is
  closed to HTTP and only our POST confirm route calls it on the server.
- "Email confirmed" is `user.emailVerified`. Better Auth clears the password and sessions of a not-yet-confirmed
  account when its email owner proves the address; the confirm page tells the member and points them to add one.
- Name, company and cohort from a list are kept on the invite (migration 0016); the join form starts with the name,
  and the company goes onto the new member's card.

## Acceptance checks (verifier)
Link sign-in works once and expires; a GET of the link alone does not sign in; an unknown email gets the same answer;
a banned member gets no link; password sign-in still works; 50 founders from a CSV with 1 bad row and 1 duplicate →
50 invites, 1 problem, 1 skip; a pasted list in all 3 formats works.
