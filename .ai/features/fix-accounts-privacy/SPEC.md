---
id: fix-accounts-privacy
status: building
---
# Accounts, invites and privacy fixes (`fix-accounts-privacy`)

Six fixes from the parity audit of 2026-11-12. Charter: [CHARTER.md](CHARTER.md). How it works: [NOTES.md](NOTES.md).

What it does now:
1. **Forwarded invite** (INV-09, A4, ADM-10). A join from the emailed invite link still confirms the invited address
   (the owner's call). The address also gets "Your invite to <community> was used", with an "It wasn't me" link
   (signed, works for 14 days after the join). Pressing it signs out whoever joined, removes any password they set,
   marks the address unconfirmed and puts them first on the admin's waiting list with "Not them" and no "Yes, this is
   them": "Wrong person?" locks the account and sends the real owner a new invite. A copied-link join gets no notice
   (it already gets "Confirm your email" and the waiting list).
2. **Profile fill-in consent** (ONB-02, PRIV-05): the welcome step's "Fill in my profile from public profiles" starts
   off; only the member's yes turns it on.
3. **Paused intro asks** (PRIV-02): search, saved searches and the paths API leave out a member who switched off
   "Let members ask me for intros" as the one to ask (a path TO them still shows).
4. **Expired invites** (INV-08): Admin › Invites lists them under "Waiting to sign in", marked Expired with the end
   date, with Resend and Revoke. Revoked and used invites leave the list.
5. **Intro email switches** (PRIV-09): Email settings has "Email me about intro asks and introductions" and "Remind
   me about intros" (its own topic, `intro_reminders`, for the connector reminder and the second "was it helpful?").
6. **Sign-in lockout** (AUTH-10): wrong passwords count per account and per requester. A browser that signed in to
   the account before counts alone; others count per trusted IP plus a shared cap of 20 a minute, or share one count
   when the host gives no IP. 5 a minute per count.

Not done: revoked invites on the Invites page; a brand-new browser can still be slowed by a stranger's guesses
(the email sign-in link still works); the paths API still returns Village's own summary sentence, which can name a
paused member (no screen shows it).
