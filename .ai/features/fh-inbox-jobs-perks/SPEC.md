---
id: fh-inbox-jobs-perks
status: in-progress
waits-on: [fh-foundation]
touches: ["src/app/(app)/inbox/", "src/app/(app)/messages/", "src/app/(app)/jobs/", "src/app/(app)/perks/", "src/app/public/", "src/modules/messages/", "src/modules/job-board/", "src/modules/perks/", "src/proxy.ts"]
---
# Founderhall transplant, area 5: Inbox, Jobs, Perks

The Inbox (`/inbox`, `/inbox/<id>`, `/messages/new?to=`), the members' and public job boards (`/jobs`), "Our jobs", and
Perks (`/perks`) look, read and step exactly like Founderhall's screens, on Community's engine. Approved scope:
[CHARTER.md](CHARTER.md). How it works: [NOTES.md](NOTES.md). Proof: `reports/` (side-by-side pairs at 390 and 1280 px).

## Depends on / check-ins
- Area 4 (My profile, `/me`): place `OurJobsSection` on My profile, then point `JOB_BOARD_PAGES.yours` at `/me#jobs` and
  redirect `/jobs/yours` there; place `DirectoryJobsLink` under the Directory's head.
- Area 1 (Today): `PerksCard` is Founderhall's link card now.
- Foundation: once the Directory and Today links exist, drop Jobs and Perks from the phone foot (`PhoneMoreLinks`).
