# Journey: ask for an intro

> ⚠ RECONSTRUCTED from code on 2026-11-10 — needs confirmation
> Sources: `src/modules/intros/AGENTS.md`, `src/modules/intros/components/ask-intro-dialog.tsx`,
> `src/modules/network/AGENTS.md`, `src/modules/asks/AGENTS.md`. Needs the Network and Intros modules (and Village).

Who: a member (the asker) who needs to reach someone.

1. The asker types who they need in Today's "Who do you want to meet?" box, or opens "Meet" (`/network`) → results show people with a path, named
   only through members who agreed to share ("1 way in"). A search that finds nobody offers to post it as an ask.
2. They open a person's paths and tap "Ask <connector> for an intro" (message and profile are quiet links below it)
   → one dialog: the path on top (You → connector → person, and why they know each other), one note starting from a
   short draft, the full preview folded under "See exactly what <connector> gets", and the promise "<connector> reads your note first. <person> hears nothing unless they say yes."
3. They send → the intro appears on `/intros` as waiting; the connector is told by email. It uses one ask from the
   shared weekly allowance (default 5), and a connector gets at most 10 asks a week.
4. They follow it on `/intros/<id>`: waiting on the connector, then on the person asked. A no from either side shows
   only as a kind decline; they never learn who said no or why. They can withdraw while it is open.
5. Other ways in: on the asks board a helper's "I know someone", or "ask a helper for an intro" on their own ask.

Tests: `src/modules/intros/intros.test.ts`, `src/modules/intros/intro-state.test.ts`, `src/modules/intros/components/intros-ui.test.ts`.
