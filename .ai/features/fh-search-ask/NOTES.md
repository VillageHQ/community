# How Search and asking for an intro work today

## Search
- Page `src/app/(app)/search/page.tsx` (network module) renders `SearchScreen` (`src/modules/network/components/`). The
  words and scope live in the address (`/search?q=cto&scope=network`); the search runs from the browser through
  `POST /api/network/search` `{ prompt, scope }` and can take two minutes (`SearchWaiting`, and the shell's
  `SearchReadyNotice` toast when the member browses away).
- `searchMemberNetwork` (`service.ts`): one search, then one bulk paths call for the outside people
  (`readVillagePathsBulk`, credit kind `paths_bulk`, 3 credits, not a daily lookup; a failure costs the page its paths,
  never the search). The bulk paths are saved as the member's cached paths (`member_path_result`, "Title, Company" as the
  person's headline), so the one-step ask and the create read them. Each person's ways in go through the same rules as
  before (sharing members only, chosen introducers, declined connectors dropped); `direct` = a degree-1 path for a
  member who joined. The answer is kept 10 minutes in memory per member, scope and words (`isCached`,
  "· from the last 10 minutes"); `forgetSavedSearches()` clears it in tests.
- "Member" rows: `reads-member-matches.ts`, words that start a name, role, company, "can help with" or tag, plus the
  members Village found. Without Village keys the route answers member profiles only (`isProfilesOnly`).
- Scope: the admin's search scope is the default; the segmented control picks per search.

## The intro ask pages (shell, so network and intros stay apart)
- `/search/ask?target=<slug>&via=<member>&back=<search>` (`src/app/(app)/search/ask/page.tsx`, network-owned, 404 when
  intros are off): `readOneStepAsk` finds the connector in the member's cached paths; the note is
  `draftShortNote` from the asker's profile; it sends a path ask.
- `/intros/new?via=<member>` (intros-owned): `readIntroConnectorCard` (paused, blocked, chosen introducers →
  "has paused intro asks"), `draftNoteParts`; it sends a named ask with name, role and company (role and company are
  optional now; they become the intro's target headline).
- Both go to `/intros/<id>?m=asked` (area 3 shows the flash). Forms: `src/shell/intro-ask-forms.tsx`; the allowance is
  the shared weekly one (`readAskAllowance`). The rail says Community's own days (`INTRO_LIFETIME_DAYS`, 14).
- `ConnectorAsk` (the slot on other paths, e.g. "See who else can help") links to `/search/ask` instead of a dialog; the
  profile's `AskMemberIntro` links to `/intros/new`.

## The guided ask
`src/app/(app)/ask/page.tsx` + `src/shell/guided-ask.tsx`. Each step is an address (`need`, `who`, `company`, then
`via` + `target`). The path step runs the same search (In our network) inside a Suspense boundary. "Post it as an ask"
opens the Asks composer with the words.

## My network
`src/app/(app)/me/network/page.tsx` + `my-network-screen.tsx`, from `networkStatusQuery`. Community joins = shares, so
the sharing box must be ticked to connect (Founderhall lets a member connect without sharing; that needs engine work the
owner decides on). Connect records consent, then opens Village's sync window. The admin's last Village check of the
member and the LinkedIn/leave settings are here now.

## The connector's email
`renderAskedEmail` in `src/modules/intros/email.ts`: Founderhall's plain words, with the note. The answer links open the
intro signed in with `?a=yes|not_now|dont_know` (area 3 can switch them to links that need no sign-in). A YES reply may
put the person's address alone on the next line (`email-replies.ts`).

## Demo
`src/platform/demo/village-answers.ts` answers searches by their words: Founderhall's story people
(`DEMO_SEARCH_PEOPLE`: Alex Kim and Dana Morris known first-hand by Sam, Rosa through Marcus, Tom Becker and Jonas Lind
through Ada), else the other made-up people, else nobody; and the bulk paths call.
