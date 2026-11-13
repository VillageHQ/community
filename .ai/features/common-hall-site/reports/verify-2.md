# Independent re-verification: Common Hall landing page (site/), round 2

Verifier: independent agent (not the builder), 2026-11-13. Commit `8f48d05` ("print state, frame redraw after form
errors, install line wrap, 24 px founder hit areas"). Scope: the two defects and two notes in `verify.md`, plus a
regression sweep. `site/` was served by a local Node static server on 127.0.0.1 and driven with playwright-core +
Chromium. Scripts, logs and every screenshot are outside the repo in `C:/ai/code/.workspace/verify/common-hall-site-2/`
(below, `V2/`). The repo's working tree was left untouched (`git status` clean after all runs).

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Print before any scroll | PASS | Fresh load, 4 s, no scroll, at 1280 and 390. Under `emulateMedia({media:'print'})`: 0 of 37 reveal targets below opacity 1 (ledger rows, revision triangles, 10 room stamps, 10 room hatches, stamp, facts, plan doors, markers), was 37 on screen just before; 0 of 55 inner strokes with a dash offset, was 16; 0 of 23 `.rule` dividers short of full width, was 23; both door leaves at `matrix(0.906, -0.423, 0.423, 0.906)` = open 25 degrees, hinge corner unchanged (left 12.4 px, bottom 41.6 px in the 1280 svg); `#pen` hidden, sheet frames drawn by `::before` (1 px). `page.pdf()` fires `beforeprint` (count 1) and gives the same numbers. Read: `V2/p1-1280-print-emulated-part1..3.png`, `V2/p1-390-print-emulated-part1..3.png`, `V2/p1-1280-print.pdf` (Record ledger with all 5 changes and 5 counts, Built/Partly/Coming stamps, hatches, "10 rooms, 10 modules" rule, open doors). Same view as the normal scrolled screen: `V2/p1c-1280-scrolled-{rooms,record,doors}.png`. Before/after: the first round's `C:/ai/code/.workspace/verify/common-hall-site/d-print.pdf` page 5 shows a blank ledger box, page 4 no stamps or hatches. Printing during the opening (0.5 s): `V2/p1-1280-print-at-0.5s.pdf` also complete (0 hidden, 0 undrawn, all 10 room labels typed in after `beforeprint`). |
| 2 | Form frame on a 390 x 844 phone | PASS | Measured from the `#pen` frame paths. Before submit: frame bottom y 3367.5, lowest content (price text) 3315. Empty submit: 4 errors shown, 4 `.is-invalid`; the sheet grows to 3408 and the frame is rebuilt: bottom y **3399.5**, sides `V3399.5`, price text bottom 3374, so the line sits **25.5 px below** the text (first round: line 3367.5 through text ending at 3374). Pen height follows the page (3840 px = scrollHeight). Shot `V2/p2-390-after-empty-submit-bottom.png`. Filled submit: 0 requests, confirmation "Thanks, Sam. Nothing was sent. ... Nobody will write to sam@example.com."; sheet back to 3376, frame bottom 3367.5, price text 3279 (88.5 px clear), bottom stroke drawn (dash offset 0) at the page bottom. Shots `V2/p2-390-nothing-sent.png`, `V2/p2-390-nothing-sent-bottom.png`. |
| 3 | Desktop install line | PASS | At 1280: `white-space: normal`, `overflow-x: visible`, scrollWidth 428 = clientWidth 428, the full command on two lines broken after a slash: "curl -fsSL https://raw.githubusercontent.com/VillageHQ/" / "community/main/install.sh \| sudo bash" (`V2/p3-1280-install.png`). Also 1024 (3 lines) and 900 (4 lines), each break after a slash, no scrollbar (`V2/p3-1024-install.png`, `V2/p3-900-install.png`). Copy still copies `data-full` (unchanged, no `<wbr>` in it). Phones keep the short line. |
| 4 | Founder tap targets | PASS | Clickable `g.fm` box = its `.fm-hit` circle, all 6 founders: **24.7 x 24.7 px at 320**, 28 x 28 at 360, 29.8 x 29.8 at 390, 33.8 x 33.8 at 1280 (the visible dot is 10.8 / 12.3 / 13.1 / 14.8 px). Hit circle fill `rgba(0,0,0,0)`, pointer-events auto; `elementFromPoint` 0.9 R from centre in 4 directions lands on the right founder 24 of 24 times at every width. Touch taps outside the dot but inside the hit circle open the right label for 6 of 6 founders at 320, 360, 390 (reduced motion) and at 320 with the founders walking; mouse clicks the same at 1280 (`V2/p4b-taps.mjs`, `V2/p4-390-tap-offcentre.png`, `V2/p4-390-tap-motion.png`). |
| 5 | Regression sweep | PASS | 0 console errors or page errors, 0 failed requests, 0 outside requests on 18 page loads (7 local requests each). No horizontal overflow: scrollWidth = innerWidth at 360/390/1280 after scrolling the whole page down and back. Opening still plays: wall dash-offset sum 2358.9 at 0.3 s, 160-199 at 1.5 s, 0 at 3.5 s (all widths). Founders walk: 4 / 4 / 3 markers at different positions at t = 2 s vs t = 14 s (360/390/1280). Reduced motion: class `js pen-on` (no `motion`), markers identical at 1 s and 6 s, 0 dashed strokes, 0 reveal targets below opacity 1, door leaves open via CSS (`V2/p5-390-reduced.png`). `one-site/reports/check-site.mjs` (run with its output dir pointed outside the repo): exit 0, "requests: 7 outside this site: none", "problems: none", print hides skip link, bar and pen (`V2/check-site.log`). `common-hall-site/reports/form-test.mjs` (run from a copy in `V2/` so its screenshot does not overwrite the tracked one; only the site path changed): exit 0, `PASS`, 4 invalid on empty submit, 0 requests sent, 0 console errors (`V2/form-test.log`). |

## Still broken

Nothing from the first report. One older print fault, outside this round's scope (it was in `31f6fa4` too, the same in
the first round's `d-print.pdf`):

1. **The printed page opens with two near-empty A4 pages.** Page 1 holds only the header ("Common Hall by Village",
   "Two ways in"). Page 2 holds only sheet 1's empty frame and its "Sheet 1 of 4 Plan" tag. The plan and heading start
   on page 3 without the top of their frame (`V2/p1-1280-print.pdf` pages 1 to 3). Cause: at A4 print width (794 px)
   sheet 1 is 1126 px tall (its `.hero-grid` 1066 px), which is more than one A4 page (1123 px). `@media print { .sheet { break-inside: avoid } }`
   pushes the sheet to page 2, and then the grid moves on to page 3. Possible fix: let sheet 1 break
   (`#plan { break-inside: auto }`), or cap the plan drawing's height in print so sheet 1 fits on one page.

## Notes (not failures)

- Under `emulateMedia('print')` alone, which fires no `beforeprint`, at 0.5 s into the opening the 10 room labels are
  still empty. Script types them in, and CSS can't do that. A real print (and `page.pdf()`) fires `beforeprint`, and
  the handler fills them in.
- After "Nothing was sent", the page scrolls the confirmation into view at scrollY 2434, with sheet 4's top 98 px
  below the top of the screen. Within about 0.3 s the scroll pen undraws sheet 4's side lines there, leaving only its
  top line and tag until the reader scrolls on (`V2/p2b-390-just-after-confirm.png`). This is the pen working as
  designed (only a resting sheet is guaranteed fully drawn), and it behaved the same before this commit. The frame's
  position is correct.
