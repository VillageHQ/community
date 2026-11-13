# Common Hall by Village: landing page

The public page for the app in this repo, under the name Common Hall by Village. It is drawn as a paper drawing set:
four sheets (Plan, Rooms, Record, Entrances), one screen tall each, with a pen line that draws every sheet's frame as you
scroll and six made-up founders walking between the rooms of the floor plan. Plain HTML, CSS and JavaScript, with no
framework, no script library and no build step. It loads nothing from third parties: the fonts are files in this folder.

## Preview

```sh
cd site
python3 -m http.server 8080
```

Then open http://127.0.0.1:8080. Any static file server works. Opened straight from disk the page runs, but the
browser blocks the font preload there and logs an error, so check it over http.

## Host it

Point any static host at this repo with **root directory `site`**. There's no build command, and the publish
directory is `site` itself.

## Before you publish

- Set `og:image` in `index.html` to an absolute URL, and add `og:url`. Social networks ignore relative image paths,
  and the page has no public address yet.
- The sign-up form ("Schedule a call") sends nothing until `data-endpoint` on `#signup-form` is set to a server that
  takes the JSON (`name`, `email`, `community`, `members`, `plan` = `"managed"`, `website` as a robot trap) and
  answers 201 `{ ok, emailSent, next }` or 400 `{ errors: { field: message } }`. Empty, the page says nothing was
  sent. **The Content Security Policy blocks every request the page makes (`default-src 'none'`)**, so when you set
  the endpoint, add `connect-src` for its origin to the CSP meta in `index.html` (for example
  `connect-src https://signup.example.com`), or the form shows "We could not reach the server".
- "Schedule call" leads to that form. No calendar is linked: Village answers by email with a time.
- The prices are Village's offer, as on the page before this one: self-host free; Managed $1,000 a month billed
  yearly or $1,200 month-to-month, up to 500 members, 7,500 Village credits a month; Managed Growth $2,500 a month
  up to 2,000 members (shown when the form's member count is above 500). Confirm them with Village before publishing.
- The GitHub links, the install line and the five pull request numbers in the record point at
  `VillageHQ/community`. Change them if the repository is renamed.
- The page says "Common Hall"; the app, the root README and the docs still use the old names. Renaming them is a
  roadmap line.

## Keeping it in step with the app

- Every product claim must be true of the app on `main`. Check the room schedule (sheet 2) against `src/modules/`
  when a module changes: each room's stamp is **Built**, **Partly** or **Coming**, and its one line says only what the
  code does. Today: Perks is Partly (it shows the fund's own BuiltFirst marketplace in a frame), Chat is Partly (asks
  post out to Slack and Discord; WhatsApp, Telegram and Signal are Coming), and there is no gaps view.
- The record (sheet 3) lists merged pull requests by number. Only add rows for merged changes, each linked.
- The quarter's numbers (42 asked, 24 introduced, 9 declined, 9 no answer, 1 lead investor found) are labelled
  "Sample". The founders, their companies and the fund (Fieldstone Ventures) are made up; emails use example.com.
- The install line matches the root `README.md` exactly; the self-host link goes to `docs/self-host-vps.md`.
- Light look only (`color-scheme: light`); a dark version is a roadmap line.

## How it is built

- `index.html` is markup only: no `style=` attributes, no inline scripts, no `<style>`. The floor plan, the key plans,
  the stamp and the founders are inline SVG with classes and presentation attributes.
- `assets/site.css` holds every style. `assets/boot.js` runs in the head and adds `html.motion` (the pre-animation
  states) unless the visitor prefers reduced motion; it removes the class again if `site.js` has not drawn the page after 4 s.
- `assets/site.js` holds every behaviour: the form, the Copy button, the founders' labels, the phone's sticky bar,
  the pen and the founders' walks. The motion is the page's own script, no library: a small requestAnimationFrame
  tween loop, a scroll listener for the pen and IntersectionObservers for the reveals. How the motion works: `.ai/features/common-hall-site/NOTES.md`.
- Without JavaScript the page still reads: every stroke is drawn, the founders sit in their rooms, and the form's
  place says it needs JavaScript. With reduced motion nothing moves.

## How it stays out of the app

- `eslint.config.mjs` ignores `site/**`.
- `@source not "../../site"` in `src/app/globals.css` stops Tailwind from scanning this folder for class names, so
  nothing here reaches the app's CSS.
- `tsc` and Vitest only look at TypeScript files and `src/`. Vercel and DigitalOcean build from the repo root with
  `next build`, which never reads this folder.

## Check it

`node .ai/features/one-site/reports/check-site.mjs` (needs `playwright-core`, local or global) serves this folder,
opens it at 320, 390 and 1280 px, waits for the opening and scrolls the page, and fails on outside requests, console
errors (CSP violations included), horizontal overflow or a missing anchor. It saves full-page shots under
`.ai/features/common-hall-site/reports/`.

## Third-party assets

- Figtree (roman and italic), from `@fontsource-variable/figtree`, under the SIL Open Font License:
  `assets/fonts/OFL-figtree.txt`.
- JetBrains Mono (latin subset, variable weight), from `@fontsource-variable/jetbrains-mono`, under the SIL Open Font
  License: `assets/fonts/OFL-jetbrains-mono.txt`. It is used only for drawing labels.
- The GitHub mark in the "GitHub" button is GitHub's logo, used to link to the repository.
- `assets/og.png` (1200 × 630) is rendered from the page's own first screen; `assets/favicon.svg` is the page's mark.
