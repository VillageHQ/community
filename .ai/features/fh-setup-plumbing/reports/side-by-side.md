# Set up area: side by side with Founderhall (independent check, 2026-11-11)

Founderhall is on the left of each picture, Community on the right. Community demo pages at 1280 and 390 px, signed in
as the demo admin. Fresh-install pages come from an empty database named "Harbor Ventures".

Not counted as differences:
- community data: names, counts, dates, the fund colour and logo, the sending addresses and the server's own URLs;
- the "Village isn't answering" notice, which is the environment: the demo's fake Village was not running.

Shell items that show on every page belong to the foundation, not to this area. They are listed once at the end.

| Shot | Width | File | Verdict |
|---|---|---|---|
| admin-setup | 1280 | pairs/admin-setup-1280.jpg | Matches except data. Adds Features and Reports rows (Community-only, in the charter). |
| admin-setup | 390 | pairs/admin-setup-390.jpg | Matches except data, plus the same two extra rows. |
| admin-first-setup | 1280 | pairs/admin-first-setup-1280.jpg | Matches except data, plus Features and Reports rows. |
| admin-first-setup | 390 | pairs/admin-first-setup-390.jpg | Matches except data, plus Features and Reports rows. |
| admin-settings | 1280 | pairs/admin-settings-1280.jpg | Same sections in the same order. Kept Community parts: Short descriptor, Logo file upload, "Who handles data requests", and the "Version and updates" sheet. The Hosting line and empty From name, Sending domain and Logo URL are data. |
| admin-settings | 390 | pairs/admin-settings-390.jpg | As at 1280. |
| admin-settings-saved | 1280 | pairs/admin-settings-saved-1280.jpg | Flash "Settings saved." matches. Otherwise as admin-settings. |
| admin-settings-saved | 390 | pairs/admin-settings-saved-390.jpg | As at 1280. |
| admin-settings-error | 1280 | pairs/admin-settings-error-1280.jpg | Flash and field error match. Two small differences: the invalid colour field gets a red border (Founderhall keeps the normal border), and the contrast hint keeps the old 8.5 : 1 where Founderhall's changes to 9.6 : 1. |
| admin-settings-error | 390 | pairs/admin-settings-error-390.jpg | As at 1280. |
| admin-mail | 1280 | pairs/admin-mail-1280.jpg | Same parts in the same order. Engine differences: one sender address for everything, Resend in place of SMTP, the reply domain falls back to the sending domain, and the do-not-send list is for bounces and spam. |
| admin-mail | 390 | pairs/admin-mail-390.jpg | As at 1280. |
| admin-mail-test-sent | 1280 | pairs/admin-mail-test-sent-1280.jpg | Flash "Test email sent to you." matches. The log shows the kind as "email_test" where Founderhall shows "test". |
| admin-mail-test-sent | 390 | pairs/admin-mail-test-sent-390.jpg | As at 1280. |
| admin-first-mail-not-set | 1280 | pairs/admin-first-mail-not-set-1280.jpg | Matches, apart from Resend in place of SMTP, the webhook "not set", and the do-not-send wording. |
| admin-first-mail-not-set | 390 | pairs/admin-first-mail-not-set-390.jpg | As at 1280. |
| admin-village | 1280 | pairs/admin-village-1280.jpg | Same sections in the same order. The sync-screen switch, "How the sync screen knows the member" and "Only paths through members who agreed to share" are greyed out (locked); in Founderhall they can be changed. Extra Community parts: "Replace the keys", "Who can introduce", and the fill-in agreement radios. Some words differ (see the report). |
| admin-village | 390 | pairs/admin-village-390.jpg | As at 1280. |
| admin-village-nudged | 1280 | pairs/admin-village-nudged-1280.jpg | Flash "Nudge sent." and the "Nudge sent … next one allowed from …" note match. The demo has nobody "not allowing asks", so that second button is missing (data). |
| admin-village-nudged | 390 | pairs/admin-village-nudged-390.jpg | Shows the state after the nudge without the flash: only one nudge could be sent, and it was sent at 1280. |
| admin-first-village-not-connected | 1280 | pairs/admin-first-village-not-connected-1280.jpg | Matches, apart from the locked sync switches and the extra parts noted for admin-village. Service email is left blank instead of being pre-filled with you+village@ (engine default). The data-region hint says "your community" because this database's name was never saved through Settings. |
| admin-first-village-not-connected | 390 | pairs/admin-first-village-not-connected-390.jpg | As at 1280. |
| admin-import | 1280 | pairs/admin-import-1280.jpg | Matches. Two hints differ to fit the engine: invite links wait on Sign-in links, and consent is saved for the whole community. |
| admin-import | 390 | pairs/admin-import-390.jpg | As at 1280. |
| admin-signin-links | 1280 | pairs/admin-signin-links-1280.jpg | Rows match (invites only; emailed sign-in links are left out on purpose, a safety stop). An extra sentence explains that Copy makes a new link. |
| admin-signin-links | 390 | pairs/admin-signin-links-390.jpg | As at 1280. |
| admin-first-signin-links | 1280 | pairs/admin-first-signin-links-1280.jpg | Founderhall shows every link in a field under its row; Community shows a link only after Copy, because it stores invite tokens scrambled. The admin's own sign-in link row is missing (safety stop). Rows are newest first. |
| admin-first-signin-links | 390 | pairs/admin-first-signin-links-390.jpg | As at 1280. |
| admin-first-invites-mail-off | 1280 | pairs/admin-first-invites-mail-off-1280.jpg | Not this area's page: /admin/invites goes to Members, which has its own invite form (area 6). Nothing from this area appears on it. |
| admin-first-invites-mail-off | 390 | pairs/admin-first-invites-mail-off-390.jpg | As at 1280. |
| admin-integrations | 1280 | pairs/admin-integrations-1280.jpg | Matches except data. The sample post links to /asks, not to one ask. |
| admin-integrations | 390 | pairs/admin-integrations-390.jpg | Matches except data. |
| admin-perks | 1280 | pairs/admin-perks-1280.jpg | Matches. The Status line is the demo's own ("Demo: members see a made-up list of deals…"). |
| admin-perks | 390 | pairs/admin-perks-390.jpg | As at 1280. |
| admin-perks-error | 1280 | pairs/admin-perks-error-1280.jpg | Matches; the flash and field error are the same. |
| admin-perks-error | 390 | pairs/admin-perks-error-390.jpg | As at 1280. |
| admin-perks-on | 1280 | pairs/admin-perks-on-1280.jpg | One difference: after saving, Founderhall empties the code box (placeholder plus "Saved address"); Community keeps the pasted code in the box. |
| admin-perks-on | 390 | pairs/admin-perks-on-390.jpg | As at 1280. |
| admin-first-perks-off | 1280 | pairs/admin-first-perks-off-1280.jpg | Matches except data. |
| admin-first-perks-off | 390 | pairs/admin-first-perks-off-390.jpg | Matches except data. |
| admin-audit | 1280 | pairs/admin-audit-1280.jpg | The rows look the same. Community records only admin and module actions, not sign-ins or most privacy changes, so the list is short. The subtitle and the Set up row still say "every admin action, sign-in and privacy change". |
| admin-audit | 390 | pairs/admin-audit-390.jpg | As at 1280. |

Features and Reports (Community-only, no Founderhall shot): built from the foundation's sheets, switch rows and
segmented tabs, and consistent with the other pages.

Old addresses: /admin/email → /admin/mail, /admin/audit-log → /admin/audit, /admin/chat → /admin/integrations and
/admin/credits → /admin/village all answer 308, and the query string is kept.

Shell, seen on every page (not this area's): a count badge on the "Set up" menu item (2 on the demo, 4–5 fresh);
"Partner report · Invites · Job board" links above Sign out at 390; and the 390 bottom tab bar sits at the first
screen's bottom in a full-page picture, where Founderhall's sits at the end of the page.

## Re-check after the repairs (same day)
Only what failed was checked again, on a fresh install at 390 px:
- Settings: a long community name now wraps in the Preview; the page is 390 px wide, no sideways scroll (was 681 px).
- Settings, refused colour: the field keeps its normal border, as in Founderhall; the error line says what is wrong.
- Perks, after saving a code: the code box is empty and "Saved address" shows, as in Founderhall.
- Mail log: the test email's kind reads "test".
- Audit log words: Community records admin actions and members' privacy choices but not sign-ins, so the Set up row
  and the Settings card now say "Every admin action, newest first: invites, settings, members and privacy changes."
  instead of promising sign-ins. A deliberate difference, so the page never claims more than it records.

Left on purpose, for the owner:
- Village's sync-screen settings stay locked on. Turning "Only paths through members who agreed to share" off would
  weaken members' privacy, and the signed-token way for the sync screen to know a member is not built. A safety stop.
- "Searches and path lookups together" (not "About 6 searches"): Community's daily limit counts calls, not credits.
- The contrast hint on a refused colour keeps the last good colour's ratio (8.5 : 1) where Founderhall shows 9.6 : 1.
