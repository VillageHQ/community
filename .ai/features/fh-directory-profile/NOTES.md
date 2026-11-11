# How Directory, profiles, My profile and Your data work today

## Pages
- `src/app/(app)/directory/page.tsx` + `modules/members/components/member-directory.tsx`: the directory. Filters live in
  the URL (`q`, `stage`, `sector`, `city`, `cohort`, `fresh`; `updated` still reads). `reads-directory.ts` shows the
  member's own role, company and city, else the filled-in ones; "fresh as of" is `member_profile.updated_at`, else
  when they joined. One page holds 60; past that a quiet Earlier / More pair.
- `src/app/(app)/people/[memberId]/page.tsx`: a member's profile. The intro button links to `/intros/new?via=<id>` (the
  search-and-ask area builds that page).
- `src/app/(app)/me/page.tsx`: My profile. `own-words-sheet.tsx` edits one field at a time and saves through
  `/api/profile` with only that field; `contract-own-words.ts` holds the field keys (a server page must not read
  constants from a client file: they arrive as undefined). `filled-lines-sheet.tsx` renders on the server; its buttons
  are `filled-line-actions.tsx`. `privacy-sheet.tsx` saves "accept intro asks" only when the member changes it.
  `src/shell/my-network-sheet.tsx` reads the network link; Stop sharing leaves the group.
- `src/app/(app)/me/data/page.tsx`: Your data. `your-data-switches.tsx` saves privacy and the lookup choice with one
  Save; `your-data-actions.tsx` exports and asks to delete.
- `src/app/(app)/me/email/page.tsx` + `src/shell/email-settings.ts`: the rows. Intro emails show only for a member who
  switched them off before; the connect reminder only for a member with no network.
- `src/app/(app)/members/*`: permanent redirects to the new addresses, query kept (`legacy-query.ts`).

## Data
- Past roles: the `past_roles` filled-in line holds the work history as JSON (`readPastRoles`, `toRoleYears`);
  `network/rules-fill-in.ts` writes it from Village's `work_history`. It hides and shows as one line.
- "Who can message me" has `default` (the column's default now): `readEffectiveMessagePolicy` turns it into the
  community's default, which is "anyone" until a setting exists.
- `member_deletion_request`: one row per member who asked; `service-deletion-request.ts` queues the
  `deletion_request` email to every other admin in the same transaction, once. The real delete removes the row. The
  member's instant delete (`/api/profile/delete`) is still there, with no button.

## Words
Founderhall's words, from `fh-reference/copy/`. Where Founderhall's sentence would be untrue here, Community's truth
stays: Your data says admins see intro counts, not names.
