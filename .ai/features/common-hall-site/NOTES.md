# Common Hall landing page: how the motion is built

All of it lives in `site/assets/site.js`, the page's own script with no library. The source design is
business-builder run 2026-11-13-founderhall-v2, design v15 (one inline HTML file that used an animation library from a
CDN); this port keeps its timings and easings and rebuilds the motion in plain JavaScript under the site's CSP. The
lead ruled out the library on 2026-11-13: its licence is not open source, and this repo is AGPL.

## Load order and the motion class
- `boot.js` runs synchronously in `<head>`: it adds `html.js`, and `html.motion` unless the visitor prefers reduced
  motion. CSS hides the pre-animation states only under `html.motion` (`.motion .pre { visibility: hidden }` for the
  plan and the stamp, `.motion .facts li { opacity: 0 }`). If `site.js` has not drawn the page (`html.pen-on`) after
  4 s, boot.js removes `motion` so nothing stays hidden.
- `site.js` loads with `defer`. It sets up the form, Copy, the founders' labels and the sticky bar first (they never
  need motion), then builds the pen, then (only with motion) the opening, the reveals and the walks.
- Under the CSP (`script-src 'self'; style-src 'self'`) there are no inline scripts, inline event handlers or `style=`
  attributes. Script writes styles through the CSSOM (`el.style.x = …`), which the CSP allows. The copy fallback uses
  a `.copy-buffer` textarea class instead of inline styles.

## The engine
- `tween({ delay, duration, ease, apply, done })` adds a tween to one `requestAnimationFrame` loop; `apply(v)` gets
  the eased progress from 0 to 1. Tweens can be paused, resumed and killed; the loop sleeps when nothing runs. Frame
  steps are capped at 0.1 s, so a background tab doesn't jump.
- `each(elements, { at, stagger, … })` is the same tween on a list, each starting `stagger` seconds later.
- Easings: `power2` = cubic, `power3` = quartic, `sineInOut`, `power1Out`, as the design names them.
- Every element the motion styles goes into `touched`; if reduced motion switches on while the page is open, all
  tweens stop, those inline styles are cleared, the labels and door leaves are set to their final state, the founders
  go back to their rooms and the pen redraws in full.

## The pen
- One SVG layer (`#pen`, absolute, page-tall) holds the sheet frames, built by `build()`. Strokes inside the sheets
  are tagged in the markup: `.pen` for SVG strokes (the key plans' hatches, the door walls and swings) and `.pen-r`
  for CSS rules (the schedule's dimension line and row rules, the ledger rules), which draw by `--p` on `scaleX`.
- Every stroke gets a key range `[k0, k1]` on one scroll axis. The tip is `scroll + 65% of the viewport`. `key(y)`
  lays each sheet's own height onto the tip's travel from "sheet top at 65% of the screen" to "sheet at rest (its top
  at the top of the screen)", so a sheet is fully drawn the moment it rests. Short strokes draw over at least 70 px.
- The scroll the tip follows is smoothed: a scroll listener sets the target, and a `requestAnimationFrame` loop moves
  the followed value toward it with a 0.15 s time constant (it catches up in about half a second, like a scrub of
  0.45), snapping when within half a pixel. At rest the followed value equals `scrollY`, so resting frames are exact.
- Frame route per sheet: top (left → right), both sides, bottom (right → left), then down the gap into the next
  sheet: one line from the top of the page to the last door. On phones, sheets 2 and 3 (`.barred`) close their frame
  72 px above their bottom so the line ends above the sticky bar.
- A Forest nib rides the newest frame stroke while it is part-drawn and fades out once it finishes.
- On load, `pen.load` goes 0 → 1 over 2.2 s, which pulls the tip from above the page down to its scroll position:
  that draws sheet 1's frame while the plan draws itself (walls, doors, dimension lines, the table and chairs, the
  labels typing in, the room icons), the facts rise and the stamp lands (scale 1.6 → 1, −14° → −6°, quartic out).
- `refreshPen()` re-measures on resize, when the fonts are ready, and whenever `main` changes size (a
  ResizeObserver: the form's field errors, a server error, the confirmation), so the frame never cuts through text. Without motion the pen is built once and drawn in full.

## The reveals
- One IntersectionObserver per section, with a bottom margin standing in for "element top at N% of the screen":
  rooms at 88% (each row lights its room and its stamp lands), the ledger at 82% (rows rule in, revision triangles
  place; the sample figures stay still, as the design's fix round set them), the Entrances at 55% (both door leaves
  swing open 25°; a leaf is drawn closed in the markup and opened by a CSS `rotate(-25deg)` about its hinge, so
  reduced motion and print show it open without script). Each plays once.
- An observer never sees an element a jump skipped (the "Two ways in" link, a fast fling), so a scroll listener also
  plays any pending reveal whose element is already above 12% of the screen.

## Printing
- Under `@media print`, `site.css` forces every reveal and stroke to its final state with `!important` (opacity 1,
  no transforms, no dashes, the stamp at −6°, the door leaves open), so a page printed before it was scrolled is
  complete. A `beforeprint` handler also plays every pending reveal and runs every tween except the founders' to its
  end (the room labels finish typing).

## The founders
- Six `.fm` markers in the plan SVG (focusable `role="button"` groups with full aria-labels, `data-name`,
  `data-line`), each with a transparent 32-unit hit circle (at least 24 px on screen from 320 px wide) around its
  14 px dot. Their HTML positions are their resting rooms, so reduced motion and no-JS show them seated.
- `PLACES` maps each room to resting spots and a route from the hub (the corridor junction at 240, 142.5) through
  the corridors and door openings. A walk is the reversed route out of the current spot plus the route into the next,
  with collinear and repeated points dropped. The polyline is written into the founder's own hidden `path.route`, and
  the marker moves along it with `SVGPathElement.getPointAtLength`, about 40 px a second on screen (from the plan's
  rendered width), eased sine in-out per trip.
- At most two walk at once; each rests 6–10 s after a trip. Arriving in Asks blinks a "?"; arriving in Intros while
  the other Intros spot is taken draws a short line between the two. Destinations pick a room first, then a free spot
  in it, so the long table's seven chairs don't take every visit. The first two trips are fixed (Priya to Intros
  beside Marcus, then Tomás from Feed to a chair) so every opening shows them; the loop starts 3.2 s in.
- The pause rule: every walk, blink and timer goes through `track()`. An IntersectionObserver on the plan pauses or
  resumes them all, so nothing walks off-screen; on return, resting founders wait at least 1.5 s before a new trip.
- Labels: hover (mouse) or focus shows the tip; a tap toggles it (the state is read on `pointerdown`, because a tap
  focuses the marker before its click); a click elsewhere or Escape hides it. The tip follows a walking founder.

## Third-party files
- Fonts: `figtree-latin-variable.woff2` and `figtree-latin-variable-italic.woff2` (`@fontsource-variable/figtree`,
  `files/figtree-latin-wght-*.woff2`), `jetbrains-mono-latin.woff2` (`@fontsource-variable/jetbrains-mono`,
  `files/jetbrains-mono-latin-wght-normal.woff2`), each under the OFL text beside it. No script is third-party.
- `assets/og.png` was rendered from the first screen with reduced motion, at a 1440 × 756 viewport scaled to
  1200 × 630.
