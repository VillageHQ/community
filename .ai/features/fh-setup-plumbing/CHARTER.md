# Charter: Set up and the plumbing pages, Founderhall's screens on Community's engine

Approved scope: the owner's brief for the Founderhall transplant, round 3, area 7 (the owner reviews once at the end).
Founderhall is the acceptance test: every screen below must match its Founderhall shot at 390 and 1280 px (same
sections in the same order, same parts, same words, same look), except the community's own data.

## Direction
- Keep Community's engine; copy Founderhall's Set up pages exactly, using only the foundation's parts.
- Rename the pages to Founderhall's addresses, with permanent redirects from the old ones.
- Build what a Founderhall screen needs and Community lacks (the owner approved bringing those features over).
- Keep every Community-only function of this area working, rebuilt with Founderhall's parts.

## Pages (old address → new)
| Founderhall page | Community today | After |
|---|---|---|
| Set up `/admin/setup` | setup checklist + brand card | Founderhall's list of plumbing pages, each with one line and a state; plus Community's Features and Reports rows |
| Settings `/admin/settings` | checklist, email card, Village cards, data home, version | Branding · Mail · Hosting & data · Plan · Save settings; right: Mail checklist, Village, Audit log; Community's "Version and updates" kept as a sheet |
| Mail `/admin/mail` | `/admin/email` (log, do-not-send) + Settings' email card | one page: addresses, DNS checklist + Check DNS now, mail service, replies, unsubscribe, DNS settings, test, last 30 days, do-not-send list, sending log |
| Village `/admin/village` | `/admin/village` (check) + `/admin/credits` + Settings' Village parts | one page: connection and keys, limits and switches, profile fill-in, what Village sees, lookups meter, members connected + nudge, what this costs; the Village check kept |
| Import members `/admin/import` | CSV upload on Members | its own page |
| Sign-in links `/admin/links` | copy an invite link on Members | its own page: links waiting to be sent by hand |
| Integrations `/admin/integrations` | `/admin/chat` | Founderhall's Slack and Discord page |
| Perks `/admin/perks` | same | Founderhall's form, with a "Show Perks to members" switch and a Status sheet |
| Audit log `/admin/audit` | `/admin/audit-log` | Founderhall's rows, actions in words |
| (Community-only) Features, Reports | own pages with chip tabs | restyled with Founderhall's parts, listed as Set up rows |
| (Community-only) Health | redirect to the report | unchanged |

Old addresses `/admin/email`, `/admin/audit-log`, `/admin/chat`, `/admin/credits` redirect permanently. The chip row of
plumbing pages under the title goes; the Set up list replaces it. Community's setup checklist stays as a part for Home
(the console area); each of its steps is reachable from a Founderhall page (Settings, Village, Invites, Partner report).

## Emails
- Mail test: subject "Test from <community>", Founderhall's plain words.
- Village nudge: subject "Find warm paths through your own network and <community>’", Founderhall's plain words.

## Engine work (approved: bring Founderhall's features over)
- New community settings: hosted by, plan, Village set-up date, from name, sending domain, logo address, default
  message policy, DKIM selector, reply subdomain, Village data region and data-agreement link, sync-screen switches,
  nightly fill-in, Perks shown to members. Stored in the existing settings table (no migration).
- Mail counts for the last 30 days and the sending log with subjects and senders.
- The CSV import as its own page; the Sign-in links page.

## Safety stops (reported, not built without the owner)
- Showing an emailed sign-in link (a login token) to admins when its email failed: an auth change. Invite links, which
  admins can already copy today, are listed; sign-in links are not, until the owner decides.

## Proof and tests
- Side-by-side pairs (Community at 390 and 1280 px beside each Founderhall shot) for: admin-setup, admin-first-setup,
  admin-settings, -saved, -error, admin-mail, admin-mail-test-sent, admin-first-mail-not-set, admin-village,
  admin-village-nudged, admin-first-village-not-connected, admin-import, admin-signin-links, admin-first-signin-links,
  admin-first-invites-mail-off, admin-integrations, admin-perks, admin-perks-error, admin-perks-on,
  admin-first-perks-off, admin-audit. Saved in `reports/`.
- Tests: the existing tests of the pages touched, extended for new behaviour; lint, typecheck, architecture tests.
- A separate verifier who did not build it compares every pair and tries to break the pages.
