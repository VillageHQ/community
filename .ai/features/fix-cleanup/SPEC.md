---
id: fix-cleanup
status: in-review
waits-on: []
touches: ["src/modules/job-board/reads-hiring.ts", "src/shell/directory-hiring.ts", "src/modules/members/reads-directory.ts", "src/app/(app)/people/[memberId]/page.tsx", "src/modules/feed/components/composer.tsx", "src/shell/navigation.ts", "src/shell/navigation-links.tsx", "src/app/parts.css", "src/modules/intros/components/", "src/modules/admin/components/invite-flashes.ts", "src/modules/admin/components/invite-sheet.tsx", "src/app/(app)/admin/invites/page.tsx", "src/modules/members/contract-bulk-invites.ts", "src/modules/members/queries-invites.ts", "src/app/api/admin/invites/bulk/route.ts", "site/assets/site.js"]
---
# Fix build: the small leftovers (`fix-cleanup`)

What these fixes do now. Charter: [CHARTER.md](CHARTER.md). How it works: [NOTES.md](NOTES.md).

- **Already fixed before this build** (proved again by their tests): sign-in keeps the typed email (PR #28), an
  empty "no" note on an intro (PR #27), helpers emailed see the ask on Today and in the weekly email, and everyday
  words never match (PR #22), a switched-off module's pages answer 404, Perks from the menu loads the whole page
  with its security policy, Slack's /ask answers later through Slack's reply address, and the setup step's single
  invite has a cohort (PR #28). Today has no feed column any more, so the "fill in your card from public profiles?"
  card leads the Today list on phones too.
- **Cohort on Admin › Invites:** the "Invite members" sheet has an optional Cohort field; everyone in that pasted
  list gets it on their card when they join. Over 80 characters is refused with "Keep the cohort under 80 characters."
- **Hiring line:** a member's jobs are their company's jobs plus every job they linked themselves, on their profile
  and in the directory's Hiring chip and filter, so changing the company's words on their card never hides them.
- **Feed:** pressing Post clears the last "Your post is live." before the new answer, so only one note shows. While
  the feed is on, Feed is a phone tab (seven tabs, eight for an admin), in equal columns like Founderhall's; with
  eight, the labels are 10 px.
- **Intro pages:** once the connector has the app email the person asked, the panel says "We emailed Rosa on
  12 Nov…" at once, not "Send Rosa this private link". The connector's intro pages write dates as "12 Nov".
- **Invites:** the message after Revoke says "Invite revoked.", the same word as the row's Revoked label; the
  "Sent …, ends …" line wraps instead of being cut on narrow rows.
- **Website:** above 2,000 members the sign-up form says "Priced for your size: above 2,000 members, Village quotes
  a plan with you" instead of the 2,000-member plan. Not published.

## Depends on / check-ins
- None. Shared files touched lightly: `src/app/parts.css` (two tab bar lines), `src/shell/navigation*.ts(x)`.
