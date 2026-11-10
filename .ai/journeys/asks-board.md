# Journey: the asks board

> ⚠ RECONSTRUCTED from code on 2026-11-10 — needs confirmation
> Sources: `src/modules/asks/AGENTS.md`, `.ai/features/asks-helpers/SPEC.md`, `src/modules/asks/components/`.
> The Asks module is on by default and works without Village.

Who: a member with a need (the asker), members who can help (helpers), and the admin.

1. The asker opens `/asks` and posts one line, optionally naming who they want to reach, or posts an update (a win).
   Asks use the shared weekly allowance; updates don't.
2. The app finds helpers: members on a path to the named person (who agreed to share), and at most 5 members whose
   "can help with" shares a word → each gets one email, and the ask shows on Today for members whose words match
   ("Why you're seeing this first"). Known gap: a helper can be emailed and still not see it on Today
   (`.ai/bugs.md`; the fix is open in PR #22).
3. A helper taps "I know someone" → an intro starts with them as the connector; or "What worked for you?" → a public
   answer under the ask; or sends a private note to the asker.
4. The asker closes the ask when it is answered, or renews it; an open ask lists for 30 days.
5. Any member can report an ask or an answer; the admin resolves it in the report queue (`/admin/reports`).

Tests: `src/modules/asks/asks.test.ts`, `src/modules/asks/asks-helpers.test.ts`, `src/modules/asks/components/asks-ui.test.ts`.
