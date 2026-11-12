# Charter: accounts, invites and privacy fixes (`fix-accounts-privacy`)

Approved by the orchestrator's brief on 2026-11-12 (Absi chose to continue on Community and fix the parity audit's
list). Brief: `C:/ai/code/.workspace/scratch/founderhall-vs-community/build/fixes/brief-fix-accounts-privacy.md`.
Evidence: the parity audit of 2026-11-12 (`parity-2026-11-12/`, rows named below).

## Direction
Six fixes, nothing else. Parallel builds own intros/report/Village warnings and feed/digest/site.

1. **Forwarded invite** (INV-09, A4, ADM-10). Keep the decision: opening the emailed invite link confirms the invited
   address. The invited person learns their invite was used and has a way out; an impostor is signed out and lands on
   the admin's waiting list ("Wrong person?" gives a new invite).
2. **Lookup consent unticked at onboarding** (ONB-02, PRIV-05).
3. **Search stops offering "Ask X" when X paused intro asks** (PRIV-02).
4. **Expired invites shown in Admin › Invites, labelled, with Resend** (INV-08).
5. **A switch for intro emails and intro reminders** on Email settings (PRIV-09).
6. **A stranger can't lock a member out of password sign-in** (AUTH-10); guessing stays capped.

## Deciding facts (found in the code)
- In Community an invite join always creates the account at the invited address; no member can change their address.
  So "an impostor joins with her own address" can't happen here: a forwarded link makes her an account AT the invited
  address. The brief's "confirm only when the emails match" is therefore always true and would change nothing.
  What closes the hole is the brief's other half: **every join from the emailed link sends the invited address a short
  notice, "Your invite was used. Wasn't you? Use this link."** The link (signed, only in that mailbox) signs out whoever
  joined, removes any password they set, marks the address unconfirmed (so they can only get back in by an email link,
  which goes to the real owner), and puts them on the admin's waiting list flagged "The invited address says this
  wasn't them", where "Wrong person?" locks the account and sends the real person a new invite.
- No new table column (two other builds may add migrations at the same time): the flag is an audit-log entry.
- All member intro emails already sit under one email topic ("intros") with unsubscribe links; Email settings only
  showed its switch to members who had switched it off. Reminders get their own topic so they can go alone.
- Password sign-in counted wrong passwords per account only (5 a minute), so anyone could lock the account.

## Architecture
- Sign-in limit: each try is counted per account AND per requester: a browser that signed in to this account before
  (a signed "trusted browser" cookie) has its own count; others count per IP when the host gives a trusted IP, else
  share one "unknown browser" count. A wider per-account cap still applies to untrusted requesters. A stranger can fill
  only their own count or the unknown-browser count; the member's known browser and the email link keep working.
- Search: connectors who paused intro asks are dropped from paths, like connectors who already said no (also on the
  in-memory saved search).

## Journeys and tests
Join by invite; onboarding; search and ask; admin invites; email settings; sign-in. Tests: one failing repro per item
first (Vitest on Postgres), then the fix; typecheck, lint, the full suite on a throwaway Postgres; a separate agent
re-runs the audit rows in the running app at 390 and 1280 px.

## Proof and estimate
Proof: the repro tests going from red to green, the notice email text, screenshots of Invites (expired row), Email
settings and the onboarding privacy step. Build about 3 hours, tests about 1.5 hours.

## Small calls taken
- Notice only for emailed-link joins (a copied-link join already lands on the waiting list and gets "Confirm your email").
- Revoked invites stay off the Invites page (the brief names expired ones).
- The trusted-browser cookie is set after a successful password sign-in, lasts a year, is httpOnly and signed.
