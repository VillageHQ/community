---
id: admin-home
status: building
---
# Admin home

The admin's first page (`/admin`): this quarter's intros in one serif line, then what needs the admin, then the
full partner report and the admin tabs.

- **Top line:** "N intros asked, N made, N said it helped" for this quarter so far (UTC calendar quarter), from the
  partner report's own intro read, so the two never differ. "No intros asked yet this quarter" at zero; "Intros are
  switched off" while they are off.
- **Needs you:** each a count and a link, hidden at zero: Village trouble (to the keys step or Credits), reports
  waiting (Reports), people waiting for the admin's OK (Members), invites not accepted yet (Members, the invite
  list), intros asked over 4 days ago with still no answer (the partner report), setup steps left
  (`/admin/setup`).
- **Setup** lives at `/admin/setup`; a new admin lands there until it is done ([admin-firstrun](../admin-firstrun/SPEC.md)), then it sends the admin to the home.
- **Privacy:** counts only. Admins never see who asked whom. Members are sent away.
