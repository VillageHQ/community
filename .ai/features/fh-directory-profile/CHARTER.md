# Charter: Founderhall transplant, area 4 — Directory, profiles, My profile, Your data

Approved scope: the owner's brief for this area (round 3 of the transplant), written down here. The owner reviews once,
at the end, by putting each screen beside Founderhall's.

## Direction
Community's engine, Founderhall's screens copied exactly (structure, sections in order, parts, words, look, steps) for:
- **Directory** (`/members` → `/directory`): H1 "Directory", the lede, "Jobs at member companies (n)", one search box,
  five selects (stage, sector, city, cohort, "Updated"), the count, two-column rows (photo, serif name, logo + "Role,
  Company · City", the "working on" line, square chips, "fresh as of <date>"). No buttons on rows.
- **A member's profile** (`/members/<id>` → `/people/<id>`): back "Directory", the header on the page (photo, name,
  logo + role · city, chips, "Ask for an intro via <first name>" + Message), "In <first name>'s own words · fresh as
  of", "Filled in from public profiles · refreshed" with dated rows and Past roles, and the right rail "Who <first
  name> can introduce you to" + Search.
- **My profile** (`/members/card` → `/me`): the header as members see you, "In your own words" with one Edit per
  field (one field at a time), the filled-in lines with Correct / Hide and Past roles, Privacy (directory radios,
  intro asks switch, Save privacy, links to Email settings and Your data), My network, Our jobs.
- **Your data** (`/members/data` → `/me/data`): the six sections in Founderhall's order and two columns; "Export my data
  (JSON)"; "Ask to delete my account".
- **Email settings** (new `/me/email`): three rows and Save, out of the old Email card.
- Old addresses answer with permanent redirects; links in the app and in emails point at the new ones.
- Email: "<name> asked to delete their account" to the admins, word for word.

Out: other areas' screens (search, intro ask page, `/me/network`, jobs tools, the console's Members page). Where this
area links to them it uses their Founderhall paths.

**Changed by the owner on 2026-11-11 (follow-up round):** members keep the real "Delete my account" (no request to
the admins, no admin email), and Your data says the admins see who asked whom for an intro.

## Engine work this area needs (owner-approved: bring Founderhall's features over)
- City filter and the "working on" line in the directory; "fresh as of" = when the member last saved their own words.
- Past roles from public profiles (a new filled-in line, hideable as one, "Hide my past roles").
- Edit one field at a time on My profile; directory visibility as two choices; Save privacy.
- "Who can message me" gains "The community's default" (today the default is anyone).
- Ask to delete: a request saved for the admins, an email to each admin through the outbox, and the page shows
  "Asked <date>". The admin's real delete stays as it is.
- The updated filter becomes any time / 30 / 90 days / 12 months.

## Community-only functions kept, rebuilt with Founderhall's parts
Block a member (quiet link at the foot of a profile), the admin's member card on a profile, tags (chips on the profile,
found by the search box), LinkedIn and website, open jobs at the member's company, own photo upload, password, "credit
me in reports", dark mode, network reminder emails, the "look me up" question, leaving the Village group.

## Decisions taken (small, reversible)
- Old routes redirect with `permanentRedirect` from their own page files, so no shared config file changes.
- Directory paging shows only past one page, as a quiet "More" link pair; the tag chips and the Hiring toggle go
  (search finds tags, the Jobs link replaces Hiring).
- The member's own instant delete stays in the code and API; the page offers Founderhall's request. Open question
  for the owner in the PR.

## Acceptance
Every shot of section 4 (`member-directory-populated`, `member-profile-other`, `member-me-profile`,
`member-me-edit-field`, `member-me-profile-new`, `member-me-data`, `member-me-data-saved`, `member-me-data-json`,
`member-me-data-delete-asked`, `member-me-email`, `member-me-email-saved`) retaken from Community in demo mode at 390
and 1280 px beside Founderhall's, by a verifier who did not build it; no difference except community data. The email
matches subject and body. Tests, lint, typecheck green. Pairs saved in `reports/`.
