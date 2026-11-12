# fix-host-findings: independent check, round 2

Checked: 2026-11-12, HEAD `7427beb`, using the production build in `.next` (`next start -p 3123`).

Setup:
- Fresh database `verify4` in `community-fhf-pg`, demo mode, `APP_URL=http://localhost:3123`.
- Signed in as Maya (admin).
- I seeded four invites with SQL:
  - Sam's revoked invite: `insert into invite (email, token_hash, invited_by_name, expires_at, revoked_at, created_at) values ('sam.lee@example.com','verify-fake-hash-r2','Maya Ortiz', now()+interval '10 days', now(), now()-interval '20 days')`. Sam already has an account.
  - Ruby's demo invite, revoked with SQL. Ruby has no account; this is the control row.
  - An expired invite for "Lee Park".
  - Sofia's demo invite, left open.

| # | Repair | Result |
|---|--------|--------|
| 1 | A revoked row's Resend lines up with the other rows' Resend at 1280 px; no extra gap at 390 px; Tab skips the invisible button | **PASS** |
| 2 | A revoked invite for an email that already has an account is not listed | **PASS** |

## 1. Alignment
- **At 1280 px,** every Resend button has the same position: left 659 and right 734 px, for revoked Ruby, open Sofia and expired Lee. Screenshot: `verify-round-2-1280.png`.
- **The invisible button** is the page's only `aria-hidden="true"` button. It has `tabIndex=-1` and `visibility: hidden`. Below lg, its `display` is `none`.
- **Keyboard:** with focus on Ruby's Resend, one Tab moved focus straight to Sofia's Resend. It did not stop on the invisible Revoke.
- **At 390 px,** the invisible button is `display: none`. Ruby's row is 86 px tall and its actions area is 32 px, which is only Resend. Rows with Revoke are 93 px with a 68 px actions area. So there is no empty gap under Resend, and no sideways scroll (scrollWidth equals clientWidth, 380). Screenshot: `verify-round-2-390.png`. The focus ring on Sofia's Resend is left over from the Tab test.

## 2. A revoked invite of an existing member
- Sam's revoked invite exists in the database: `revoked = t`, no `accepted_at`, and 1 account with that email.
- It is not on Admin › Invites: no element has `title="sam.lee@example.com"`, and the screenshots show no Sam row.
- Ruby's revoked invite (no account) is still listed with the Revoked pill and Resend. So the filter removes only the account case.

The server log had no errors and no pg warning. I closed the browser and stopped the server.
