# Independent verification: area 4 (Directory, profiles, My profile, Your data, Email)

Date: 2026-11-11. Checked by a reviewer who did not build it. Production build of the branch, demo mode, at
http://127.0.0.1:47841 on the throwaway demo database (made-up people). Shots were taken fresh (1280x800 and 390x844 at
device scale 2) into `.ai/tmp/verify/shots/` and set beside `fh-reference/shots/` at native size (`.ai/tmp/verify/pairs/`).
Words were compared against `fh-reference/copy/<name>.md`.

Classes: **a** community data only · **b** Community-only function kept on purpose · **c** owned by another area or the
shared foundation · **d** a real defect of this area.

## Shots

### member-directory-populated
| Width | Difference | Class |
|---|---|---|
| both | 21 members, other names, logos, portraits, cities, sectors, the filter options and "fresh as of" dates; jobs count 14 | a |
| both | Team members carry "Fund" and "Venture" pills, and "Fund" shows up as a stage option (the demo team's stage and sector) | a |
| both | Nadia Cole's card has no pills (she has not filled in stage, sector or cohort) | a |
| 390 | "fresh as of 30 Oct" drops to its own line on some cards: the date and the "Pre-seed" pill are wider than in Founderhall's cards | a |
| both | Badges on Asks, Intros, Inbox; Perks in the menu; "Jobs · Perks" links above Sign out on the phone; fund mark "NF" instead of a logo | c |
| both | Structure, search box, five filters (2+2+1 on the phone), count line, two-column cards, pills, rules, spacing: same | none |

### member-profile-other
| Width | Difference | Class |
|---|---|---|
| both | Different portrait and logo, refreshed dates (22 Oct, fresh as of 30 Oct) | a |
| both | A "Looking for" block (Ada has one in the demo data; Founderhall's Ada has none) | a |
| both | Tags (Climate, Hardware), Links (LinkedIn), "Block Ada Okafor" | b |
| both | The Message button's icon is a round speech bubble; Founderhall's is a square one. The button comes from the Inbox area's `start-conversation-button.tsx` (`MessageCircle`) | c |
| both | Sidebar badges, Perks, phone foot links | c |
| both | Head, chips, two buttons, "In Ada's own words" sheet, filled-in sheet, past roles, "Who Ada can introduce you to" with Search and the consent line: same words and layout | none |

### member-me-profile
| Width | Difference | Class |
|---|---|---|
| both | City is marked "you" (Sam's own words in the demo) and the City filled-in line says "(your own words show instead)"; dates 22 Oct / 9 Aug | a |
| both | Extra rows Tags, LinkedIn, Website; cards "Credit me in reports" and "How you sign in" (password) | b |
| both | The jobs card is "Your company's jobs" with "Manage or link another", not Founderhall's "Our jobs" with the job list | c (jobs area) |
| both | **Privacy option cards are 16 px apart; Founderhall's are 8 px apart** (`.fh-opt + .fh-opt` already adds 8 px, and the wrapper in `privacy-sheet.tsx` line 63 adds `grid gap-2` on top) | **d** |
| both | Head, "In your own words" with you/from public profiles marks and Edit links, the "you" note, filled-in lines with Correct and Hide, past roles with "Hide my past roles", Privacy, My network: same words and layout | none |

### member-me-edit-field
| Width | Difference | Class |
|---|---|---|
| both | Same as member-me-profile (rows a/b/c and the option-card gap) | a/b/c/**d** |
| 390 | Founderhall's shot has its top bar drawn over the name field (a capture artefact on its side); Community's field shows whole | none |
| both | The open field shows a focus ring (the input has focus on load); Founderhall's capture shows it without focus | none |
| both | Input, Save, Cancel in place of the value, other rows unchanged: same | none |

### member-me-profile-new (Nadia Cole)
| Width | Difference | Class |
|---|---|---|
| both | The "NC" avatar tint is grey-green; Founderhall's is sand (the foundation picks the tint from the name) | c |
| both | Extra rows Tags, LinkedIn, Website ("Not filled in"); Credit me in reports (off); How you sign in | b |
| both | Jobs card: "Your company's jobs", Company + Careers link, "Link our hiring tool" / "Add jobs by hand instead" (and "From your card" wording) instead of "Our jobs" with Hiring tool and "Pull our jobs" | c (jobs area) |
| both | Privacy option cards 16 px apart instead of 8 | **d** (same as above) |
| both | "Not filled in" rows, "Nothing filled in from public profiles yet.", "Not connected" network sheet with "Connect my network": same | none |

### member-me-data
| Width | Difference | Class |
|---|---|---|
| both | "Hosted by Northwind Founders, EU, Frankfurt, DigitalOcean." vs "EU (Frankfurt)."; privacy@example.com | a (hosting settings) |
| both | "admins see counts, not names." where Founderhall says "admins see names, states and dates." (Community's rule: admins never see who asked whom) | b |
| both | Consent record: one line ("recorded that you agreed in its membership terms on 25 Apr") instead of three; dates 22 Oct / 9 Aug | a |
| both | Extra consent rows "Members can ask you for intros", "Named in partner reports"; a Dark mode row under Your switches | b |
| both | The "Your switches" heading icon is Lucide `sliders-horizontal` (three lines); Founderhall's is `settings-2` (two lines with knobs) | **d** (minor) |
| both | "Who can message me" option cards are 16 px apart instead of 8 (`your-data-switches.tsx` line 105, `grid gap-2` on top of the part's own margin) | **d** |
| both | Founderhall's "Your picture" row has overlapping words (a bug on its side); Community's reads cleanly | none |
| both | Export is a button that downloads `my-data-<date>.json` (Founderhall: a link to /me/data.json). Looks the same; the download works (26 sections) | b |
| both | Order and words of the other sheets (What is stored, What the lookup service receives, Share my network, Take it with you, Delete my account): same | none |

### member-me-data-saved
| Width | Difference | Class |
|---|---|---|
| both | Flash "Privacy settings saved." at the top: same. Address stays /me/data (Founderhall: /me/data?m=privacy#switches) | none (not visible) |
| both | Rest as member-me-data | a/b/**d** |

### member-me-data-json
| Width | Difference | Class |
|---|---|---|
| both | Founderhall's shot is the same page as -saved; Community's is too. Same differences as -saved | a/b/**d** |

### member-me-data-delete-asked
| Width | Difference | Class |
|---|---|---|
| both | Flash "Sent. The admins have your request and tell you by email.", the "Asked 11 Nov" pill and the line under it replace the button: same words | none |
| both | Rest as member-me-data | a/b/**d** |

### member-me-email
| Width | Difference | Class |
|---|---|---|
| both | Words identical to the copy file; sheet, three switches, Save: same | none |
| both | Sidebar badges, Perks, phone foot links | c |

### member-me-email-saved
| Width | Difference | Class |
|---|---|---|
| both | Flash "Email settings saved." and the page: same | none |

## The deletion email

Outbox row (kind `deletion_request`), sent to the admin (maya.ortiz@example.com), one row only after two tries:

- Subject: `Sam Lee asked to delete their account`: same as Founderhall.
- Text body, word for word the same as `copy/emails/email-delete-request-to-admin.md`:
  "Hi, / Sam Lee (sam.lee@example.com) asked Northwind Founders to delete their account, from the Your data page. /
  See them in Members: <base>/admin/members?f=delete / Sent by Northwind Founders via its member portal."
  Only the host differs.
- Community also stores an HTML part with the same four paragraphs (Founderhall's is plain text only). The outbox needs an
  HTML part; the words are the same. Class b.

Result: **pass**.

## Break-it results

| Check | Result |
|---|---|
| Edit "Looking for", Save | Value saved, editor closes, flash "Saved.", survives reload. Put back. |
| Save an empty Name | Refused with "Enter your name."; name unchanged after reload. |
| Cancel an edit (City typed "Nowhere") | Editor closes, address back to /me, City still New York after reload. |
| Correct links | 2nd Correct opens /me?edit=company with the Company field open; 1st opens /me?edit=role with Role open, in view. Loading /me?edit=company directly opens Company. |
| Edit link | Opens the field in place without changing the address (Founderhall's link goes to ?edit=...). Works; not visible. |
| Hide / Show a filled-in line | Hide City → line struck, button turns to Show, flash, survives reload; Show undoes it. Hide Role → another member (Nadia) no longer sees the Role line on Sam's profile; Show brings it back. |
| Hide / Show past roles | Hidden roles struck, "Show my past roles" appears; Nadia no longer sees them; Show brings them back. |
| Save privacy: Nobody | Flash "Privacy settings saved." plus "You are hidden from the directory. Admins still see you in the member list." Nobody stays checked after reload; Your data's "Hide me from the directory" is on; Sam is gone from the directory for himself and for Nadia (20 members); Nadia gets the not-found page on Sam's profile. Put back to Everyone; Nadia sees Sam again. |
| **Hidden member's name in the page title** | **With Sam hidden, Nadia opening /people/<Sam's id> gets the not-found body but the tab title "Sam Lee · Northwind Founders" (the HTML has the name twice).** `generateMetadata` in `src/app/(app)/people/[memberId]/page.tsx` (line 45) reads the profile without the hidden check. On main the old profile page used a fixed title. Class **d** (privacy). |
| Let members ask me for intros | Switch off → saved → off after reload; put back on. |
| Your switches Save | Hide me + "Only people I've been introduced to" → flash, both kept after reload; Nadia no longer sees Sam; /me shows Nobody. Put back. |
| Email Save | Weekly digest off → flash "Email settings saved." → off after reload; put back on. |
| Directory filters | City Lagos → Ada only; Cohort Fund I → Felix, Marcus, Ravi; Updated last 30 days → narrows; Series A + Fintech → both kept in the address; Health → Oliver, Sam; search "Gridwise" and "hardware" → Ada; "zzzqqq" → "No member matches" with Clear; /directory?city=Lagos&q=ada fills the controls. |
| **Old /members addresses** | **In a browser they land on the right page with the query kept** (/members?q=ada&city=Lagos → /directory?q=ada&city=Lagos; /members/card?edit=role → /me?edit=role; /members/data?m=privacy → /me/data?m=privacy). **But the HTTP status is 200 with a `<meta http-equiv="refresh">`, not 308** (`curl` with a member's cookie: 200 for all four). `permanentRedirect()` runs inside pages that stream under the `(app)` loading screen, so Next.js can only send a client redirect. Class **d**. |
| Query on /members/<id> | /members/<id>?x=1 → /people/<id> (query dropped; the other three keep it). Class **d** (minor). |
| Unknown /people/xyz | Shows "We can't find that page", title "Member · …"; HTTP status 200 (a soft 404). /intros/xyz does the same on this build, so it comes from the shared streaming layout, not this area. Class c. The page also has two `<main id="main-content">` elements (shell plus not-found page), class c. |
| Phone layouts (390) | /directory, /people/<id>, /me, /me with an open field, /me/data, /me/email, empty search, as Sam and as Nadia: page width 390, nothing past the edge (only the visually hidden switch inputs), no controls overlapping. |
| Export my data | Downloads my-data-2026-11-11.json with 26 sections. |

State put back afterwards: Sam's words, lines, privacy, switches and email settings are as before. Sam's "fresh as of"
date is now 11 Nov because of the test edits. Sam has one deletion request and one deletion email, as before the run
(the earlier one was cleared and made again by this run).

## Verdict

**FAIL**: four class (d) defects, all small to fix:

1. **Hidden member's name leaks in the page title**: `/people/<id>` for a member who chose Nobody shows the not-found body but
   the title "<name> · <community>". Fix: in `generateMetadata` (`src/app/(app)/people/[memberId]/page.tsx`), apply the same
   rule as the page (own profile, admin, or not hidden; also not found), otherwise use `PAGE_TITLES.profile`.
2. **Old addresses are not HTTP 308**: /members, /members/<id>, /members/card, /members/data answer 200 with a meta refresh.
   Fix: send the redirects before the page renders: `redirects()` in `next.config` with `permanent: true`, or in the proxy/middleware,
   keeping the query. Also keep the query on /members/<id>.
3. **Option cards 16 px apart instead of 8**: My profile → Privacy (`privacy-sheet.tsx` line 63) and Your data → Who can message
   me (`your-data-switches.tsx` line 105). Fix: drop `grid gap-2` (the part already spaces cards 8 px).
4. **"Your switches" icon**: `SlidersHorizontal` where Founderhall uses Lucide `settings-2` (`your-data-switches.tsx`). Fix: use `Settings2`.

Everything else is community data (a), kept Community function (b) or owned elsewhere (c). The deletion email matches word for word.
