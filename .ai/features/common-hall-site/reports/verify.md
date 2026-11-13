# Independent verification: Common Hall landing page (site/)

Verifier: independent agent, 2026-11-13. Branch `absi-agent/common-hall-site` at `31f6fa4`. The `site/` folder was served
by a local Node static server on 127.0.0.1 and driven with playwright-core 1.63 + Chromium at 390 x 844, 360 x 780 and
1280 x 800. Scripts and every screenshot: `C:/ai/code/.workspace/verify/common-hall-site/` (outside the repo; below,
`V/` = that folder). Nothing was pointed at a real account; the form's endpoint stayed empty.

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Loads with no console errors, no outside requests | PASS | 7 requests per load at every width, all to 127.0.0.1 (index, site.css, boot.js, site.js, 3 woff2). 0 outside hosts. 0 console errors or warnings, 0 page errors, 0 failed requests (a-load.mjs output; repeated in every later run). |
| 2 | CSP meta, no violations, no inline styles/scripts | PASS | Meta is exactly `default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'`. 0 CSP messages in console. `grep -c 'style=' index.html` = 0, no `<style>`, both `<script>` tags have `src` and no body. |
| 3 | First screen | PASS | Lockup "Common Hall" + "by Village"; h1 lines "Read every room" / "before you" / "move in." with one `<em>` ("before"); one `.btn-p` "Schedule call", rgb(31,107,78); "GitHub" with an SVG path, href https://github.com/VillageHQ/community, target _blank, rel noopener; 10 room labels + 10 `.ric` icons; 3 fact lines. The whole first screen fits (390: facts bottom 815 < 844; 360: 772 < 780; 1280: 702 < 800). Shots `V/a-390-first.png`, `V/a-360-first.png`, `V/a-1280-first.png`. Clicking "Schedule call" lands on `#door-managed`, h3 "Schedule a call", form top at 77 px (`V/c-390-after-schedule-click.png`). |
| 4 | Motion: plan draws, founders walk, labels, off-screen pause | PASS | Sum of wall `stroke-dashoffset`: 2359.0 at 0.3 s, 355-387 at 1.5 s, 0.0 at 3.5 s; labels type in ("As\|In" at 1.5 s, all 10 at 3.5 s) (`V/a-390-t300.png`, `V/a-390-t1500.png`, `V/a-390-first.png`). Markers moved between t = 2 s and t = 14 s: 4 (390), 4 (360), 3 (1280). Max moving at once over 52 samples every 250 ms: 2 at every width. Hover (desktop) shows "Ruth · Fieldnote / Offering: CFO office hours"; touch taps (390) on six founders in a row show each one's name, company and line; tapping the same founder twice closes it; keyboard focus shows the label and Escape closes it (`V/c-1280-hover.png`, `V/c-390-tap.png`). At the page bottom for 6 s: 0 markers moved; back at the top, 4-5 moved within 12 s. |
| 5 | Every sheet top is a fully drawn resting frame; phone bar never covers a heading | PASS | At each sheet's top (after a wheel scroll, 1.6 s rest): 0 pen paths, 0 `main .pen` strokes and 0 `.pen-r` rules in view with dashoffset > 0.5 or `--p` < 1, and 0 reveal targets below opacity 1, at all three widths; same after 30 rapid wheel flicks. Only exception: at `#plan`'s own top (scrollY 58, under the header) the next sheet's frame peeks 49 px in at the bottom, fully undrawn (dashoffset = full length, not half-drawn); sheet 1's real resting frame is scrollY 0, where that frame is off screen. Bar on at Rooms and Record (top 783 at 390, 719 at 360), off at Plan and Entrances; 0 headings under the bar. Shots `V/b-390-{plan,rooms,record,doors}.png`, `V/b-360-*.png`, `V/b-1280-*.png`. |
| 6 | Reduced motion | PASS | `html` class is `js pen-on` (no `motion`); marker transforms identical at 1 s and 6 s, all at home spots with opacity 1; all 10 labels full; 0 strokes with dashoffset > 0; stamp opacity 1; 0 elements below opacity 1 in Rooms, Record, Entrances (390 and 1280). Shots `V/c-390-reduced-1s.png`, `V/c-1280-reduced-*.png`. |
| 7 | Form | PASS | `data-endpoint=""`. Empty submit marks name, community, email, members (`.is-invalid`), focus goes to Name (`V/c-390-form-empty.png`). Filled submit: 0 new requests (also after a second submit and a honeypot submit); confirmation "Thanks, Sam. Nothing was sent. ... Nobody will write to sam@example.com." (`V/c-390-form-sent.png`, `V/c-390-form-sent-twice.png`). site.js `readValues()` sends `{name, email, community, members, plan, website}`, plan from the hidden input `value="managed"`. Price line: 800 members shows Managed Growth $2,500, 3000 shows "Village quotes a plan". |
| 8 | Honesty strings | PASS | "Sample" tag on the quarter header; stamps: 8 Built, 2 Partly (Perks, Chat), 1 Coming; "WhatsApp, Telegram, Signal" occurs once, right after the Coming stamp. No SSO, single sign-on, free trial, one click, encrypted (the only "sso" substring is inside `crossorigin`). No Founderhall, Longtable or Peerbook anywhere in `site/`. The only email is sam@example.com. Install line equals root README line 37 exactly. Footer: every person, fund and company is made up. |
| 9 | Layout, legibility, keyboard | PASS (2 notes) | scrollWidth = innerWidth at 360/390/1280, also after resizing 390 > 1280 > 390. Tab order: Skip link, lockup, Two ways in, Schedule call, GitHub, the 6 founders (focusable `g[tabindex=0]`, role button, aria-label with name and company), Read the merge history, PR links. The phone bar's link gets tabindex 0 only while shown. Notes: founder initials are SVG text at 5.3 user units (about 4.8 px on a 390 phone) and the marker tap target is 14 x 14 px, below the 24 px of WCAG 2.5.8 (the name is in the label, so the initials are decoration). Room labels render about 8.5 px on phones. |
| 10 | Try to break it | FAIL (2 defects) | Resize mid-animation, rapid scroll, anchor jump ("Two ways in"), fast taps, double submit: no defects (`V/d-resize-1280-mid.png`, `V/d-resize-back-390.png`, `V/d-rapid-record.png`, `V/d-after-resize-bottom.png`). Printing and the form's error state are broken: see below. |

## Broken

1. **Printing before scrolling the page loses most of sheets 2 to 4.** Printed (`page.pdf` and print-media emulation)
   after the opening but before scrolling: the Record ledger is a blank white box (all 12 rows invisible), the ten room
   stamps (Built / Partly / Coming) and lit room hatches are missing, the "10 rooms, 10 modules" dimension rule and the
   row rules are missing, and the door plans show no walls and a closed leaf. 32 reveal targets have opacity < 1 in
   print. Evidence: `V/d-print-emulated.png`, `V/d-print.pdf`. Cause: site.js sets the reveal pre-states as inline
   styles (`opacity: 0` / transforms on `.ledger .lg`, `.ledger .tri`, `.rm-top .stp`, `.room .lit`; `--p: 0` on the
   `.pen-r` rules; `stroke-dashoffset` on the `main .pen` strokes; door `.leaf` x2/y2 attributes at 0 degrees), and they
   stay until each section scrolls into view. The `@media print` block in `site.css` hides `#pen` and draws the frame
   with `::before`, but resets none of those states. Fix: `!important` print resets for those selectors (opacity 1,
   transform none, `--p: 1`, `stroke-dashoffset: 0`) plus a `beforeprint` handler that plays the pending reveals (the
   leaves are attributes, which CSS can't reach).

2. **The form's error messages push text through the Entrances frame on phones.** At 390, after an empty submit the
   doors sheet grows by 32 px (sheet bottom 3376 to 3408), but the pen's bottom frame line stays at y = 3367.5 while the
   price text now ends at 3374: the frame line runs through "month included on Managed."
   (`V/f-390-after-empty-submit-bottom.png`, measured by `V/f-form-frame.mjs`). Not visible at 1280 (the sheet has spare
   height). Cause: `refreshPen()` runs only on resize, `document.fonts.ready`, `showConfirm` and "Change something and
   send again"; `check()`/`mark()` (and the 400 `errors` path) change the page height without calling it, and nothing
   watches the sheet's size. Fix: call `refreshPen()` after `check()` and after the 400 path marks fields, or a
   `ResizeObserver` on `main` that calls it.

Minor, not failures: the desktop install line (`.install code`) is clipped mid-word ("…/VillageHQ/communi") with its
scrollbar hidden; it scrolls sideways and Copy copies the whole line, but nothing shows there is more text. The founder
markers' 14 px tap targets (check 9).
