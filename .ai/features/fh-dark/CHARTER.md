# Charter: a dark version of Founderhall's look

Approved scope (the owner's pick, from the build brief; Founderhall itself has no dark mode).

## Direction
Keep a dark mode, designed as a dark version of Founderhall's look: calm, warm, paper-like, a tool for founders and
VCs, never high-contrast or "gamey".

In:
1. Only the token layer changes: the dark block in `src/app/globals.css` and the fund colour's dark mapping in
   `src/platform/design/accent.ts`. No per-page dark overrides unless a part truly needs one; each one is listed in NOTES.md.
2. A warm near-black base (not pure black), raised sheets one step lighter, hairline borders, muted text tiers that
   mirror the light tiers, the fund colour adjusted to pass 4.5:1 on the dark base, readable avatars, logos, chips and pills.
3. Every text/background pair meets WCAG AA (4.5:1 body, 3:1 large text and UI parts); a contrast table in NOTES.md.
4. The dark-mode switch stays where the foundation put it (a row on Your data); it follows the system setting by default.

Out: light mode (unchanged), page layouts, any screen's markup.

## Proof
The parts page and 6 key screens (Today, Search with paths, Intros, Directory, Admin home, Sign-in) at 390 and
1280 px, light beside dark, in `reports/`.

## Acceptance (a verifier who did not build it)
Every screen above is readable in dark, nothing invisible or clashing; the contrast table checks out on a sample of
10 pairs measured from the screenshots; light mode is unchanged (pixel-compare 3 screens); tests, lint and typecheck green.

Migration: none.
