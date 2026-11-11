# Verification: Search and asking for an intro (independent verifier)

Date: 2026-11-11. Community in demo mode at http://127.0.0.1:47821, signed in as Sam. Shots at 1280x800 (DPR 1) and
390x844 (DPR 2), full page, demo band and dev badge hidden. At 390 the tab bar was set to `position:static` and moved
to the end of the body, as the builder's capture does, so it shows in the same place as Founderhall's shot.
My shots: `.ai/tmp/verify/<name>-<width>.png`. Side-by-side pairs (Founderhall left): `.ai/tmp/verify/pairs/*.jpg`.
Words: each page's `main` innerText, compared line by line against `fh-reference/copy/<name>.md`.

## Environment problem found first (not part of the screens, but serious)
At the first try, every search showed "Search is unavailable right now. Village ... isn't answering." Cause: the dev
server had hot-reloaded twice after edits ("Fast Refresh had to perform a full reload when ./src/shell/intro-ask-forms.tsx
changed"). After that, every Village call failed with `code:"network"` in 2-10 ms, and `village_trouble=down` was
written to `instance_settings`. The demo fetch guard (`installDemoFetchGuard`, put in place once in instrumentation)
no longer catches calls after the hot reload. I restarted the dev server (`next dev -p 47821 -H 127.0.0.1`, log in
`.ai/tmp/dev-verify.log`) and search worked again. Real, but dev-only: a production demo does not hot-reload. It does
leave a "Village is down" mark behind that admins can see.

## Not counted as differences
- Shell, from the foundation PR, the same on every screen: the "NF" initials where Founderhall has a logo (no logo
  uploaded: data); the Perks sidebar item (a Community module; Founderhall's own not-connected shots show Perks too);
  the unread badges on Asks/Inbox (counts: data); the Jobs · Perks link row above Sign out on phones (shell); the
  sidebar items sit about 2px higher.
- People, photos, company marks, "12 members" vs "3/4 members", Tomas Novak as a third CTO, Jonas Lind in place of
  Jo Wright, "Finished 9 Aug." vs "22 Oct.", and the not-connected shots using Nadia Cole in Founderhall vs Sam here: data.
- The allowance state. Sam has 0 of 5 asks left in the demo, Founderhall's shots have 1, 3 or 4 left. So the
  "You've used this week's 5 asks..." box and the greyed (disabled) Send/Ask button come from the data. They are
  Founderhall's own words for that state.
- At 390, about 64px of empty space before the moved tab bar. That is the room kept free under the fixed bar, which
  shows up only because of the capture trick.
- The "(now)" / "(to come)" timeline labels are in innerText but never show on screen (screen-reader text).
- The "· from the last 10 minutes" note after the result count is in Founderhall's 390 shots too (it depends on the cache).

## Shot table

| shot | width | differences (real) | differences (data) | verdict |
|---|---|---|---|---|
| member-search-empty | 1280 | 1. The people icon before "Paths come from..." is a different drawing (Founderhall: small head, wide shoulders; Community: the lucide `users` icon) | member count | near match (1 small) |
| member-search-empty | 390 | 1. same icon | count | near match (1 small) |
| member-search-results | 1280 | 1. icon | count, Tomas Novak as 3rd result, photos, company marks | near match (1 small) |
| member-search-results | 390 | 1. icon | same | near match (1 small) |
| member-search-results-know-directly | 1280 | 1. icon | photos, marks, count | near match (1 small) |
| member-search-results-know-directly | 390 | 1. icon | same | near match (1 small) |
| member-search-results-none-in-network | 1280 | 1. icon | Jonas Lind vs Jo Wright, photos | near match (1 small) |
| member-search-results-none-in-network | 390 | 1. icon | same | near match (1 small) |
| member-search-no-results | 1280 | 1. icon. 2. "Ask the community" goes to `/asks?draft=...` where Founderhall goes to `/asks?ask=...#compose` (cannot be seen; fine if the composer opens with the words; not checked) | count | near match |
| member-search-no-results | 390 | 1. icon | count | near match (1 small) |
| member-search-everywhere | 1280 | 1. icon | Jonas Lind, photos | near match (1 small) |
| member-search-everywhere | 390 | 1. icon | same | near match (1 small) |
| member-search-not-connected | 1280 | 1. icon | user (Nadia vs Sam), count | near match (1 small) |
| member-search-not-connected | 390 | 1. icon | same | near match (1 small) |
| member-search-not-connected-query | 1280 | 1. icon | Founderhall's "NC" initials as the first dot on the path vs Sam's photo (user), Tomas Novak | near match (1 small) |
| member-search-not-connected-query | 390 | 1. icon | same | near match (1 small) |
| member-intro-ask-onestep | 1280 | none | the allowance box and the disabled Send (Sam has 0 asks left) | match |
| member-intro-ask-onestep | 390 | none | same | match |
| member-intro-ask-onestep-error | 1280 | none (empty note, focus ring and "Please fill out this field" bubble all the same; I removed the button's `disabled` to press it) | allowance box | match |
| member-intro-ask-onestep-error | 390 | none | allowance box | match |
| member-intro-ask-from-profile | 1280 | 1. Timeline "Ada decides": "14 days, then the ask closes..." vs Founderhall's "7 days". 2. "They decide": "one reminder, 14 days." vs "7 days." (Community's `INTRO_LIFETIME_DAYS = 14`, written up in NOTES; the owner decides) | 0 of 5 dots and allowance box; Ada's photo and company mark | 2 real |
| member-intro-ask-from-profile | 390 | none (the timeline is hidden on phones in both) | allowance box | match |
| member-intro-ask-from-profile-error | 1280 | the same 2 "14 days" lines | allowance box | 2 real |
| member-intro-ask-from-profile-error | 390 | none. The sticky top bar shows mid-page in my shot because the page scrolled to the field on click (a capture effect) | allowance box | match |
| member-ask-guided-start | 1280 | 1. Timeline "They decide": "14 days" vs "7 days". 2. The "A customer" icon is a different building (Founderhall: building with window lines; Community: lucide `building-2`). 3. The "A hire" icon is a different user-plus (the plus sits lower and to the right in Founderhall) | dots 0 vs 4 | 3 real |
| member-ask-guided-start | 390 | 1. customer icon. 2. hire icon (no timeline on phones) | dots | 2 real |
| member-ask-guided-need-1 | 1280 | 1. "14 days" | dots | 1 real |
| member-ask-guided-need-1 | 390 | none | dots | match |
| member-ask-guided-need-2 | 1280 | 1. "14 days" | dots | 1 real |
| member-ask-guided-need-2 | 390 | none (words checked; picture not opened separately; same component as need-1/4) | dots | match |
| member-ask-guided-need-3 | 1280 | 1. "14 days" (words checked; picture not opened separately) | dots | 1 real |
| member-ask-guided-need-3 | 390 | none (words checked; picture not opened separately) | dots | match |
| member-ask-guided-need-4 | 1280 | 1. "14 days" (words checked) | dots | 1 real |
| member-ask-guided-need-4 | 390 | none | dots | match |
| member-ask-guided-step-3 | 1280 | 1. "14 days" | dots, photos | 1 real |
| member-ask-guided-step-3 | 390 | none | dots, photos | match |
| member-me-network | 1280 | 1. An extra line under the privacy note: "Change my LinkedIn or stop sharing" (a disclosure; not in Founderhall). Also "Back to my profile" goes to `/members/card` vs `/me#network` (route; cannot be seen) | "Finished 9 Aug." | 1 real |
| member-me-network | 390 | 1. the same extra "Change my LinkedIn or stop sharing" line | date | 1 real |
| member-me-network-connect | 1280 | 1. "Where it is processed": "In EU, Frankfurt, DigitalOcean. You can stop sharing any time: you leave the community's group in Village." vs "Ask Northwind Founders where the data is processed: privacy@northwind.example. You can disconnect any time: your link here is deleted and your Village account is cancelled." The first sentence may follow the data (Community has a data location set); the second is different on purpose. 2. The tickbox hint: "Connecting shares your network with Northwind Founders, so tick it to go on. You can stop sharing any time." vs "Leave it unticked and your network powers only your own searches. You can change it any time." (Community needs the tick to connect, written up in NOTES; engine work the owner decides on) | user | 2 real |
| member-me-network-connect | 390 | the same 2 | user | 2 real |

Lit sidebar item / phone tab: Search on every search screen; Intros on /intros/new and on every /ask step; My profile
(sidebar) and no tab on /me/network. The same as Founderhall at both widths.
Sideways overflow: none. `scrollWidth` equals the viewport on all 17 screens at 1280 and 390.

## Broke it?
Not checked. The coordinator asked for the report before these ran: odd characters in search (quotes, %, emoji, 500
characters), switching In our network/Everywhere, back links, `/network` -> `/search` permanent redirect that keeps `?q=`,
the guided ask's Change links and example chips, `/intros/new?via=<bad id>`, `/search/ask` with a bad target.
Seen in passing: the result links carry the right `back=` (`/search?q=cto&scope=network`). The Change links go to `/ask`
and `...&edit=1`, and the chips go to `/ask?need=...&who=...`. All are links, not followed.

## Email word-for-word test
Not checked: `pnpm vitest run email-asked` was not run, and `renderAskedEmail` was not compared with
`copy/emails/email-intro-ask-to-connector.md`.

## Summary
Words for search, the one-step ask, the profile ask and the guided steps match Founderhall word for word, except
"14 days" (vs 7) on the intro timeline, the two lines on the connect screen, and the extra LinkedIn/stop-sharing line.
Look and layout match, except three icons (the people icon on search, and the customer and hire icons on the first
guided step).

## Repair round 1 (builder)
- Icons: the people icon before "Paths come from…" and the need-card icons now use Founderhall's own drawings
  (`src/components/ui/fh-icon.tsx`); search shots and the guided start retaken, pairs rebuilt.
- Left for the owner, on purpose:
  - "14 days" on the ask rails: Community closes asks after 14 days (`INTRO_LIFETIME_DAYS`), Founderhall after 7.
  - My network's connect words: Community needs the sharing tick to connect, and leaving the group does not cancel the
    Village account, so the hint and the second "Where it is processed" sentence say what Community does.
  - "Change my LinkedIn or stop sharing" on My network: Community's LinkedIn and leave settings had to live somewhere
    (Founderhall keeps Stop sharing and Disconnect on My profile, area 4).
- Not changed: "Ask the community" opens Community's composer address (`/asks?draft=`), "Back to my profile" goes to
  `/members/card`; both follow when areas 1 and 4 rename. The hot-reload break of the demo's fake Village is a
  development-only issue older than this branch (follow-up).
