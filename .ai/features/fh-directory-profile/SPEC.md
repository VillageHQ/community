---
id: fh-directory-profile
status: in-progress
waits-on: [fh-foundation]
touches: ["src/app/(app)/directory/", "src/app/(app)/people/", "src/app/(app)/me/", "src/app/(app)/members/", "src/modules/members/", "src/shell/email-preferences-card.tsx", "src/shell/email-settings.ts", "src/shell/my-network-sheet.tsx", "src/shell/directory-hiring.ts", "src/shell/message-policy.ts"]
---
# Spec: Directory, profiles, My profile, Your data (Founderhall transplant, area 4)

**Added:** 2026-11-11 (the owner's decision: Community's engine, Founderhall's screens copied exactly).

## What it does
- **Directory** (`/directory`): one search box (name, company, city, skill or tag), five selects (stage, sector, city,
  cohort, "Updated": any time / 30 / 90 days / 12 months), the count, two columns of rows that each open the profile:
  photo, name, logo + "Role, Company · City", the "working on" line, chips and "fresh as of" (the last save of the
  member's own words). "Jobs at member companies (n)" while the job board is on.
- **A member's profile** (`/people/<id>`): the head (photo, role line, chips, "Ask for an intro via <first name>" or
  "<first name> has paused intro asks", Message), "In <first name>'s own words · fresh as of", "Filled in from public
  profiles" with dated lines and Past roles, and "Who <first name> can introduce you to" while search is on. Kept from
  Community: tags, LinkedIn and website, open jobs, Block, the admins' card.
- **My profile** (`/me`): the head as members see it; each own-words field with its source ("you" or "from public
  profiles") and Edit, one field open at a time (`/me?edit=<field>`); the filled-in lines with Correct and Hide, Past
  roles with "Hide my past roles"; Privacy (directory radios, intro asks switch, Save privacy); My network; the jobs
  section; password and "credit me in reports".
- **Your data** (`/me/data`): what is stored and where, what the lookup service receives, the consent record; Your
  switches (don't look me up, hide me, who can message me with "The community's default", one Save); share my network;
  export (JSON); "Ask to delete my account", which saves the request and emails each admin once.
- **Email** (`/me/email`): the weekly digest, ask emails and message emails, one Save.
- The old addresses (`/members`, `/members/<id>`, `/members/card`, `/members/data`) redirect permanently.

## Not in it
Search, the intro ask page (`/intros/new`), `/me/network`, the job tools inside "Our jobs" and the console's Members
filter for deletion requests belong to the other transplant areas.

How it works: [NOTES.md](NOTES.md). Approved scope: [CHARTER.md](CHARTER.md).
