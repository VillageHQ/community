# Common Hall landing page

What it does now (since 2026-11-13; replaces the Founderhall page in [one-site](../one-site/SPEC.md)).

- `site/` is one static page (`index.html`, `assets/site.css`, `assets/boot.js`, `assets/site.js`) that sells the app
  in this repo as **Common Hall by Village**. No framework, no build step, no cookies, no analytics, and the same
  Content Security Policy as before: only this site's own files load. The motion is the page's own script, no
  library; the fonts (Figtree, JetBrains Mono) are files in `site/assets/`.
- The page is a drawing set of four sheets, each one screen tall, with a sheet tag ("Sheet N of 4"):
  1. **Plan** — "Read every room *before* you move in.", one sub-line, the **Schedule call** button (to the form) and
     an outlined **GitHub** button with the GitHub mark (to `VillageHQ/community`), the round AGPL 3.0 stamp, the
     floor plan of the ten modules (walls, doors, the long table, room labels and line icons) with six made-up
     founders, and three facts.
  2. **Rooms** — a room schedule: each module with a key plan, a **Built** / **Partly** / **Coming** stamp and one
     line, checked against `src/modules/` (Perks and Chat are Partly; WhatsApp, Telegram and Signal are Coming).
  3. **Record** — a ledger of five merged pull requests (#11, #17, #18, #20, #21, each linked) and a partners'
     quarter marked "Sample".
  4. **Entrances** — "Village runs it": the sign-up form titled **Schedule a call**; "Your own server": the install
     line with a Copy button and a link to `docs/self-host-vps.md`. Then the price line.
  A footer title block (project, drawn by, licence, sample client, sheets) and, on phones, a sticky "Schedule call"
  bar between the opening's buttons and the Entrances sheet.
- The form keeps the site's one contract: `#signup-form` with `data-endpoint`, fields `name`, `email`, `community`,
  `members`, `plan` (always `"managed"`) and the `website` robot trap; 201 `{ ok, emailSent, next }` or 400
  `{ errors }`. With an empty endpoint nothing is sent and the page says "Nothing was sent". The price line under
  "Schedule a call" follows the member count (Managed, Managed Growth above 500, a quote above 2,000). Setting an
  endpoint also needs a `connect-src` in the CSP (see `site/README.md`).
- Motion: the pen draws every sheet's frame and inner strokes as the page scrolls, so each sheet is fully drawn when
  it rests; the plan draws itself on load and the stamp lands; rooms light up, ledger rows rule in, the door leaves
  swing open. The founders walk between rooms along the corridors while the plan is on screen and pause when it is
  not; hover, focus or tap shows a founder's name, company and one line. Reduced motion or no JavaScript:
  everything is drawn and still.
- Light look only (`color-scheme: light`). Works from 320 px. Printing hides the bar, the pen layer and the tooltip.
- `.ai/features/one-site/reports/check-site.mjs` serves the folder, opens it at 320/390/1280 px with motion (waits
  for the opening, scrolls the page) and with reduced motion (full-page shots in `reports/`), and fails on outside
  requests, console errors, horizontal overflow or a missing anchor.

Not here: renaming the app, README and docs to Common Hall; a dark version; a server for the form; publishing or
deploying the page; a calendar link (roadmap lines for the first two).
