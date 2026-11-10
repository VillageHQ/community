# Charter: the small known bugs (after wave 3)

Approved scope (the owner's build plan, wave 3 fix part). One pull request; each fix small; a failing test first
where one can be written.

1. Sign-in: switching to the password form clears the typed email. Keep it.
2. A switched-off feature's page answers 200 (blank) instead of 404 "not found".
3. Today's reminder to check your own profile card never shows. Find why and make it show when it should.
4. Perks: its security headers (CSP) do not apply when the page is opened from the menu (client-side navigation).
   Make them apply.
5. Slack /ask: when posting takes over 3 seconds, the user gets no follow-up message. Send the follow-up.
6. Profile-word matching: "fund-raising" does not match "fundraising" (hyphens and simple word forms).
7. A single invite cannot set the member's cohort (CSV import can). Add the optional cohort field.
8. On a 360 px phone the Today search box's hint is cut off without "…"; also check a very long fund name in the
   top bar and sidebar at 360, 390 and 1280 px.
9. Roadmap: mark every merged part done in `.ai/roadmap.md` (PRs #20 to #26) and add the final-check follow-ups that
   no other part covers.

Out: the RIGHT / HIDE / FIX weekly-email codes and the Today jobs card (they stay on the profile-confirm-lines spec).

Acceptance (verifier): each item shown fixed in the real app or by a real request; screenshots for 1, 3 and 8.
