# The merged look (approved)

The owner approved the look exactly as mocked (phone mocks of six screens). This build puts it into the real product,
on Community's own tokens and components.

## In
1. Serif headings (Source Serif 4, self-hosted from an npm font package like Figtree; no third-party font load),
   regular-weight body text.
2. Flat sheets with a hairline edge instead of floating, heavily rounded cards; buttons without glow or pill shape.
3. "Network by Village" removed from every member screen, sign-in included. Members see only the fund's name (serif in
   the top bar). Sign-in: no big colour band; a small logo tile in the fund's colour over a hairline.
4. Today: a "Who do you want to meet?" search box at the top (it opens network search with the words filled in),
   replacing the ask card at the bottom. The navigation entry "Network" reads "Meet".
5. The owner's pick: the asks board stays its own entry where it is today. Open asks are not folded into "Meet".
6. Search: plain header (no hero band, no example chips). In an open path, one primary button ("Ask <name> for an
   intro"), with Message and Profile as quiet text links.
7. Ask dialog: the path on top (You → connector → target, with why they know each other), then one note box; the full
   preview of what the connector gets folds into one "See exactly what <name> gets" line.
8. Intros: serif headings, one shorter line under the title ("Each one needs a yes from both people before it happens").
9. Partner report: a one-line serif summary at the top, built from the real counts of this quarter, hairline table rows.
10. A footer on every screen, phones included: "<fund name> · Source code (AGPL-3.0)" linking to the source.

## Kept as today
The fund's contrast-safe accent colour, dark mode, faces, initials and "Say hi", the asks sections and their wording,
the privacy line under every ask, the intro flow, every report number, the bottom tab bar, the admin screens' structure.

## Small calls taken in the build
- The desktop sign-in side panel also loses its full colour fill (the same "no big colour band" rule): a quiet panel
  with a hairline edge; the picture of the network and the note stay.
- The sidebar entry reads "Meet" too, so phone and desktop name it the same way. The admin feature switch still says
  "Network" (it names the feature, not the place).

## Proof
After-screens at 390 px and 1280 px for the six mocked screens plus the asks board, light and dark, next to copies of
the mocks, in `reports/`. Tests: existing tests that assert removed text are updated; new tests only for the Today
search box and the report summary line.

## Acceptance
A separate agent clicks every member and admin screen at 390 and 1280, light and dark: each mocked screen matches its
mock; "Network by Village" shows on no member screen; the asks board is reachable from the same place as on main;
nothing overlaps, clips or loses contrast; the source link shows on every phone screen.

Migration: none.
