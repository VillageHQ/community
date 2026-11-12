# Charter: fix build, the small leftovers (`fix-cleanup`)

Approved scope: Absi approved one cleanup build for the small leftovers from the checks (decision page
LVzU4aenwkVczhRlC-QLXQ, 2026-11-12). Open items come from `.ai/bugs.md` and the orchestrator's brief. One pull request;
the orchestrator merges it. Founderhall is the reference where it has the behaviour. The website is never published.

## Direction
1. Sign-in: switching to the password form keeps the typed email; an empty field never blocks sign-in silently.
2. Declining an intro with the note left empty works.
3. A member emailed as someone who can help with an ask sees it on Today and in the weekly email.
4. "Can help with" matching ignores everyday words such as "first" (stop-word list).
5. A switched-off module's pages answer 404, not 200 with an "off" notice.
6. Perks opened from the in-app menu gets the /perks security policy.
7. Slack's /ask gives a follow-up when posting takes longer than Slack's 3 seconds.
8. The single invite form gets a cohort (group) field, like the list and CSV import.
9. A founder's "Hiring" line follows who linked the jobs, not the company name on her card.
10. Feed: an empty Post shows one note only; Feed is in the phone tab bar when it is on (fitted like Founderhall's).
11. The person asked for an intro no longer reads "Send Rosa this private link" once the connector gave the email;
    the app's date style on that page and the connector's intro page.
12. One word for a revoked invite in the message and the label; invite rows keep their date at about 1034 px.
13. Website sign-up form: above 2,000 members it offers the right plan.
14. With the feed on, the "fill in your profile?" card comes before the Today list on phones.

Out: anything not listed; deploying or publishing the website.

## Proof and tests
A failing test (or a recorded failing step) per item first, then the fix; typecheck, lint and the full suite on a
throwaway Postgres; a separate agent re-runs each item in the running app and retakes changed screens at 390 and
1280 px beside Founderhall's. Proof in `reports/`.
