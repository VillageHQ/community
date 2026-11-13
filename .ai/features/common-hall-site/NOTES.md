# Common Hall landing page: how the motion is built

All of it lives in `site/assets/site.js`; the source design is business-builder run 2026-11-13-founderhall-v2,
design v15 (one inline HTML file with GSAP from a CDN), ported here into separate files under the site's CSP.

## Load order and the motion class
- `boot.js` runs synchronously in `<head>`: it adds `html.js`, and `html.motion` unless the visitor prefers reduced
  motion. CSS hides the pre-animation states only under `html.motion` (`.motion .pre { visibility: hidden }`: the
  plan and the stamp). If `window.gsap` is still missing after 4 s, it removes `motion` so nothing stays hidden.
- `vendor/gsap.min.js`, `vendor/ScrollTrigger.min.js` and `site.js` load with `defer`, in that order. `site.js` sets
  up the form, Copy, the founders' labels and the sticky bar first (they never need GSAP), then the pen.
- Under the CSP (`script-src 'self'; style-src 'self'`) there are no inline scripts, inline event handlers or `style=`
  attributes. Script writes styles through the CSSOM (`el.style.x = …`, which the CSP allows), and GSAP does the same.
  The copy fallback uses a `.copy-buffer` textarea class instead of inline styles.

## The pen
- One SVG layer (`#pen`, absolute, page-tall) holds the sheet frames, built by `build()`. Strokes inside the sheets
  are tagged in the markup: `.pen` for SVG strokes (the key plans' hatches, the door walls and swings) and `.pen-r`
  for CSS rules (the schedule's dimension line and row rules, the ledger rules), which draw by `--p` on `scaleX`.
- Every stroke gets a key range `[k0, k1]` on one scroll axis. The tip is `scroll + 65% of the viewport`, scrubbed
  (ScrollTrigger `start: 0, end: 'max', scrub: .45`). `key(y)` lays each sheet's own height onto the tip's travel from
  "sheet top at 65% of the screen" to "sheet at rest (its top at the top of the screen)", so a sheet is fully drawn
  the moment it rests. Short strokes draw over at least `LEAD` = 70 px of scroll.
- Frame route per sheet: top (left → right), both sides, bottom (right → left), then down the gap into the next
  sheet: one line from the top of the page to the last door. On phones, sheets 2 and 3 (`.barred`) close their frame
  72 px above their bottom so the line ends above the sticky bar.
- A Forest nib rides the newest frame stroke while it is part-drawn and fades out once it finishes.
- On load, `state.load` goes 0 → 1 over 2.2 s, which pulls the tip from above the page down to its scroll position:
  that draws sheet 1's frame while the plan draws itself (walls, doors, dimension lines, the table and chairs, the
  labels typing in, the room icons), the facts rise and the stamp lands (scale 1.6 → 1, −14° → −6°).
- `build()` re-runs on every ScrollTrigger refresh (resize, fonts loaded, the form's confirmation changing the page
  height). Without motion it runs once with `render(1e9)`: every stroke drawn, no dashes.

## The founders
- Six `.fm` markers in the plan SVG (focusable `role="button"` groups with full aria-labels, `data-name`,
  `data-line`). Their HTML positions are their resting rooms, so reduced motion and no-JS show them seated.
- `PLACES` maps each room to resting spots and a route from the hub (the corridor junction at 240, 142.5) through
  the corridors and door openings. A walk is the reversed route out of the current spot plus the route into the next,
  with collinear and repeated points dropped (`simplify`). Speed is about 40 px a second on screen (from the plan's
  rendered width), eased `sine.inOut` per trip.
- At most two walk at once; each rests 6–10 s after a trip. Arriving in Asks blinks a "?"; arriving in Intros while
  the other Intros spot is taken draws a short line between the two. The first two trips are fixed (Priya to Intros
  beside Marcus, then Tomás from Feed to a chair) so every opening shows them.
- The pause rule: every walk tween and timer goes through `track()`. A ScrollTrigger on the plan
  (`top bottom` → `bottom top`) calls `setAlive`, which pauses or resumes them all, so nothing walks off-screen.
  The loop starts 3 s into the opening timeline and is killed when the reduced-motion media query flips on.
- Labels: hover (mouse) or focus shows the tip; a tap toggles it (the state is read on `pointerdown`, because a tap
  focuses the marker before its click); a click elsewhere or Escape hides it. The tip follows a walking founder.

## Vendored files
- `assets/vendor/gsap.min.js` and `ScrollTrigger.min.js`: copied unchanged from `npm pack gsap@3.13.0` (`dist/`),
  notices kept. They are under GreenSock's Standard "No Charge" License, not an open-source licence; the terms are in
  `assets/vendor/LICENSE-gsap.txt`. To update: `npm pack gsap@<version>`, copy the two `dist` files, update the
  licence file and the version in `site/README.md`.
- Fonts: `figtree-latin-variable.woff2` and `figtree-latin-variable-italic.woff2` (`@fontsource-variable/figtree`,
  `files/figtree-latin-wght-*.woff2`), `jetbrains-mono-latin.woff2` (`@fontsource-variable/jetbrains-mono`,
  `files/jetbrains-mono-latin-wght-normal.woff2`), each under the OFL text beside it.
- `assets/og.png` was rendered from the first screen with reduced motion, at a 1440 × 756 viewport scaled to
  1200 × 630.
