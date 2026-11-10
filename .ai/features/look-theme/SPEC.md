# The look

What members and admins see, after the merged look (approved from phone mocks).

- Type: headings in Source Serif 4 (self-hosted from `@fontsource-variable/source-serif-4`, `--font-serif`, the
  `type-display`/`type-h1..h3`/`type-serif` utilities); body text in Figtree at regular weight.
- Surfaces: flat sheets with a hairline edge (`--rule`, `--elevation-panel`), small even corners (`--radius-*`).
  Buttons have no glow and no pill; the primary keeps the contrast-checked accent and its brand edge.
- Members see only the fund's name: no "Network by Village" anywhere in the app or on sign-in style pages. The Village
  mark stays only on the first-run setup page, and only while network search is on.
- Sign-in style pages: no colour band; a small logo tile in the fund's colour over a hairline (phones), a quiet side
  panel with the network picture (desktop).
- Every page ends with "<fund name> · Source code (AGPL-3.0)". Where messages fill the screen, the source link moves
  to the desktop sidebar; an open thread on a phone has no footer (it takes the whole screen).
- Today: a "Who do you want to meet?" box on top while the member's network is ready. It sends `?q=` to network
  search, which runs those words once and drops them from the address. The navigation entry for search reads "Meet".
  The asks board keeps its own entry.
- Search: plain header; in a path, one primary ask, with "message them" and "see their profile" as quiet links.
- Ask dialog: the path and the reason on top, one note, the preview folded under "See exactly what <name> gets".
- Partner report: "This quarter, in one line" on top (`readReportSummary`), hairline table rows.
