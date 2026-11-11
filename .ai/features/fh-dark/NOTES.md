# How the dark version of Founderhall's look works today

Founderhall has no dark mode; the owner chose to keep one, designed as a dark version of Founderhall's look: calm,
warm, paper-like. Only the token layer changed. Light mode is untouched (pixel-identical to main on 14 screenshots,
`reports/light-unchanged.txt`).

## Where things are
- **Tokens** — the `.dark { … }` block in `src/app/globals.css`. Founderhall's names (`--ink`, `--paper`, `--leaf`…)
  and Community's older semantic names get the dark values; `--shadow` gets a dark shadow.
- **Founderhall's literal colours** — `parts.css` is generated from Founderhall's CSS and holds a few literal colours
  (placeholder, chip hover, switch off, dashed edges, declined bar, mail header, logo tile, row hover). The dark block
  names them `--fh-placeholder`, `--fh-chip-hover`, `--fh-switch-off`, `--fh-dash`, `--fh-declined`, `--fh-scrollbar`,
  `--fh-mail-head`, `--fh-logo-tile`, and a short list of `.dark …` rules at the end of `globals.css` applies them.
- **The fund colour** — `deriveDarkFundColors()` in `src/platform/design/accent.ts`, the dark twin of Founderhall's rule:
  - *tint*: a dark wash of the fund's hue (OKLCH lightness 0.30, chroma at most 0.03), the "Why you" box and helpers strip;
  - *fund*: the admin's colour, same hue, chroma calmed to at most 0.13, lightened until it reads at 4.5:1 on Leaf,
    Paper, Vellum and its own tint. The primary button is the fund with dark Leaf words (the same 4.5:1);
  - *deep*: the fund lifted one more step (+0.07 lightness), for hover and text on the tint.
  `renderAccentCss()` writes these under `:root.dark`. The older `deriveAccentTokens()` is no longer used by the app.
- **The switch** — stays a row on Your data (`DarkModeRow`). With no choice saved, the page follows the system setting
  (`SYSTEM_THEME_SCRIPT` in `src/platform/design/theme.ts`).

## The palette
| Token | Light (Founderhall) | Dark | Role |
|---|---|---|---|
| `--paper` | `#f6f2e9` | `#1a1915` | the page: warm charcoal, not black |
| `--side` | `#efe9dd` | `#151410` | the sidebar, one step below the page |
| `--leaf` | `#fffdf8` | `#23211c` | sheets and fields, one step above the page |
| `--vellum` | `#ece6d8` | `#2f2c25` | chips, tags, notes, fills, one step above sheets |
| `--rule` | `#dad2c1` | `#3a362f` | hairlines |
| `--ink` | `#1b2420` | `#e6dfd0` | text: warm paper, not white |
| `--graphite` | `#59625d` | `#aaa395` | secondary text |
| `--spine` / tint | `#2c4a3e` / `#dce7e0` | `#9fc5ae` / `#243329` | made, ok |
| `--ribbon` / tint | `#9c4e22` / `#f2e2d6` | `#e7a57e` / `#3d2a1f` | needs you, warnings |
| avatar tints | `#d3e3e2` `#d3e2d8` `#e6d8c2` `#dcdccf` | `#2c3c3b` `#2b3b31` `#40372a` `#38372e` | initials faces |
| fund (demo teal `#24525a`) | `#24525a` / deep `#1b3e44` / tint `#dce3e5` | `#6e9da5` / deep `#83b3bb` / tint `#1b3236` | the fund's accent |

Light raises a part by going whiter; dark raises it by going lighter, so the order is kept: side < paper < leaf < vellum.
Two parts swap their two layers so the selected piece still looks raised: the segmented control (track Leaf,
selected segment Vellum) and the composer's Ask/Update choice.

## Contrast table (dark)
Computed with `contrastRatio()` (WCAG 2.x) for the demo teal; the fund pairs hold for every colour (the sweep in
`accent.test.ts`). 4.5:1 for text, 3:1 for UI parts.

| Text / part | on | Ratio | Needs | Where |
|---|---|---|---|---|
| `--ink` #e6dfd0 | `--paper` #1a1915 | 13.26 | 4.5 ✓ | body text on the page |
| `--ink` #e6dfd0 | `--leaf` #23211c | 12.12 | 4.5 ✓ | body text on a sheet |
| `--ink` #e6dfd0 | `--vellum` #2f2c25 | 10.50 | 4.5 ✓ | chip, tag, note text |
| `--ink` #e6dfd0 | `--side` #151410 | 13.89 | 4.5 ✓ | sidebar links |
| `--ink` #e6dfd0 | `--fh-chip-hover` #3a362e | 9.06 | 4.5 ✓ | chip on hover |
| `--paper` #1a1915 | `--ink` #e6dfd0 | 13.26 | 4.5 ✓ | ink button, selected chip, badges (Paper on Ink) |
| `--graphite` #aaa395 | `--paper` #1a1915 | 7.02 | 4.5 ✓ | secondary text on the page |
| `--graphite` #aaa395 | `--leaf` #23211c | 6.42 | 4.5 ✓ | secondary text, hints on a sheet |
| `--graphite` #aaa395 | `--vellum` #2f2c25 | 5.56 | 4.5 ✓ | secondary text on a chip or note |
| `--graphite` #aaa395 | `--side` #151410 | 7.36 | 4.5 ✓ | sidebar group label |
| `--graphite` #aaa395 | `--fund-tint` #1b3236 | 5.39 | 4.5 ✓ | secondary text in a "Why you" box |
| `--fh-placeholder` #8f897c | `--leaf` #23211c | 4.62 | 4.5 ✓ | placeholder in a field |
| `--spine` #9fc5ae | `--spine-tint` #243329 | 7.01 | 4.5 ✓ | "made" pill, ok note |
| `--spine` #9fc5ae | `--leaf` #23211c | 8.48 | 4.5 ✓ | success text |
| `--ink` #e6dfd0 | `--spine-tint` #243329 | 10.02 | 4.5 ✓ | ok note body |
| `--ribbon` #e7a57e | `--ribbon-tint` #3d2a1f | 6.51 | 4.5 ✓ | "needs" pill and note |
| `--ribbon` #e7a57e | `--leaf` #23211c | 7.72 | 4.5 ✓ | warning text |
| `--ribbon` #e7a57e | `--paper` #1a1915 | 8.44 | 4.5 ✓ | warning text on the page |
| `--ink` #e6dfd0 | `--ribbon-tint` #3d2a1f | 10.22 | 4.5 ✓ | needs note body |
| `--ink` #e6dfd0 | `--tint-a` #2c3c3b | 8.71 | 4.5 ✓ | avatar initials |
| `--ink` #e6dfd0 | `--tint-b` #2b3b31 | 8.93 | 4.5 ✓ | avatar initials |
| `--ink` #e6dfd0 | `--tint-c` #40372a | 8.80 | 4.5 ✓ | avatar initials |
| `--ink` #e6dfd0 | `--tint-d` #38372e | 9.02 | 4.5 ✓ | avatar initials |
| `--fund` #6e9da5 | `--leaf` #23211c | 5.38 | 4.5 ✓ | links, quiet buttons on a sheet |
| `--fund` #6e9da5 | `--paper` #1a1915 | 5.89 | 4.5 ✓ | links on the page |
| `--fund` #6e9da5 | `--vellum` #2f2c25 | 4.66 | 4.5 ✓ | links in a note |
| `--leaf` #23211c | `--fund` #6e9da5 | 5.38 | 4.5 ✓ | primary button words (dark Leaf on the fund) |
| `--fund` #6e9da5 | `--fund-tint` #1b3236 | 4.52 | 4.5 ✓ | quiet button hover, warm pill |
| `--fund-deep` #83b3bb | `--fund-tint` #1b3236 | 5.87 | 4.5 ✓ | text on the fund tint |
| `--leaf` #23211c | `--fund-deep` #83b3bb | 6.99 | 4.5 ✓ | primary button hover |
| `--ink` #e6dfd0 | `--fh-mail-head` #2a2822 | 11.11 | 4.5 ✓ | mail preview header |
| `--input` #8a8477 | `--leaf` #23211c | 4.33 | 3 ✓ | field and secondary-button border (UI part) |
| `--input` #8a8477 | `--vellum` #2f2c25 | 3.75 | 3 ✓ | field border on a fill |
| `--fh-switch-off` #8a8477 | `--leaf` #23211c | 4.33 | 3 ✓ | switch track, off |
| `--leaf` #23211c | `--fh-switch-off` #8a8477 | 4.33 | 3 ✓ | switch knob on the off track |
| `--fh-dash` #7a7466 | `--leaf` #23211c | 3.46 | 3 ✓ | example-chip dashed edge |
| `--fh-declined` #7d827e | `--leaf` #23211c | 4.11 | 3 ✓ | declined bar |
| `--fund` #6e9da5 | `--paper` #1a1915 | 5.89 | 3 ✓ | focus ring |

Guarded by `src/platform/design/tokens.test.ts` (the token pairs in both themes, the dark literal colours) and
`src/platform/design/accent.test.ts` (the dark fund for a sweep of 216 colours).

## Dark-only part rules (each is a part, not a page)
All at the end of `src/app/globals.css`:
1. Phone top bar and report action bar: their see-through Paper, dark.
2. Mail preview header: `--fh-mail-head`.
3. Placeholders: `--fh-placeholder`.
4. Chip hover: `--fh-chip-hover`.
5. Switch: off track `--fh-switch-off`, knob dark Leaf (reads on both the off track and the light fund).
6. Example chips and empty state: dashed edge `--fh-dash`; stepper nodes the same.
7. Declined bars: `--fh-declined`.
8. Row hover band: a Vellum band instead of the light one.
9. Ink button hover: near-white instead of black.
10. Segmented control and composer choice: the swapped layers above.
11. Company logo tiles: a warm off-white tile (`--fh-logo-tile`), so logos made for white stay readable.
12. Demo band: keeps its Ribbon fill (was already there).
No page has its own dark rule.

## Proof
`reports/`: the parts page and Today, Search with a path open, Intros, Directory, Admin home and Sign-in at 390 and
1280 px, light beside dark (JPEG). `light-unchanged.txt`: the light pixel comparison against main.
