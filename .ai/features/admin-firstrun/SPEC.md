---
id: admin-firstrun
status: building
---
# First-run admin landing

- Every sign-in lands on `/start`. It sends unfinished welcome steps to `/welcome`; an admin whose setup is
  unfinished to the setup checklist (`/admin/setup`); everyone else, and an admin whose setup is done, to the feed.
- The welcome steps end back on `/start` (not straight on the feed), so a brand-new admin goes on to setup.
- Once every setup step is done, `/admin/setup` sends the admin to the admin home ([admin-home](../admin-home/SPEC.md)).
- The admin home's stuck-intros item reads "N intros asked over 4 days ago, still no answer". It says it counts
  older asks, so early in a quarter it doesn't seem to contradict "No intros asked yet this quarter", and mid-quarter
  it doesn't read as extra intros on top of the quarter's count (it can include this quarter's asks).
