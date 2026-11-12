# Charter: feed, weekly email, jobs on profile and the website (fix build)

Approved scope: the owner's brief for this fix build, after the 2026-11-12 feature parity audit of Founderhall and
Community (216 rows). Evidence: `.workspace/scratch/founderhall-vs-community/parity-2026-11-12/` (comparison,
results, spot check). Founderhall is the reference for how each missing behaviour looks and reads. Two other fix
builds run beside this one (accounts and privacy; intros and reports); this one stays in its own area.

## Direction
Five items, each reproduced first (a failing test or a recorded failing step), then fixed.

1. **The feed is unreachable** (FEED-01 to FEED-06). A redirect sends `/feed` to Today. Remove it and keep the feed
   ON by default (the owner's decision): members open it from the menu, post, reply, react, edit and delete; admins
   pin; members report. It is drawn with Founderhall's foundation parts, since Founderhall has no feed screen.
2. **Every weekly-digest reply code** (TODAY-06). Lines filled in from public profiles get a number in the weekly
   email with Founderhall's RIGHT / HIDE / FIX codes and links, next to HELP / SKIP / YES / NO.
3. **Digest link page feedback** (TODAY-05). After pressing a link's button, the page says what was done, like
   Founderhall's "Done…".
4. **Jobs on a hiring founder's profile** (PROF-15). The member's profile shows the company's open jobs.
5. **Website sign-up form and prices** (SITE-02, SITE-03). Community's `site/` gets Founderhall's sign-up form and
   price table in its words and look. The form posts to a placeholder that sends nothing to real people. Nothing is
   deployed or published.

## Decisions in force
- Admins see who asked whom in the app; a join from the emailed invite link confirms the email; the members' job
  board starts on where no admin chose; the feed stays a Community feature and is ON.
- On by default means: on where no admin chose; an admin's earlier "off" is kept (the job board's rule).

## Proof
Typecheck, lint and the full suite on a throwaway Postgres. A separate checker that built nothing re-runs each audit
row in the running app with made-up people and fake services, retakes changed screens at 390 and 1280 px beside
Founderhall's, and tries to break them. Proof in `reports/`.

## Out
Deploying or publishing the site; anything in the other two builds' areas (invites, onboarding consent, sign-in
limits, email switches, intros, the investor report, Village warnings).
