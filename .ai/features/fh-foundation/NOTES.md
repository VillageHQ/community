# How the Founderhall foundation works today

The base every transplant area builds on: Founderhall's look, its shared parts and its shell, on Community's engine.

## Where things are
- **Tokens** — `src/app/globals.css`. Founderhall's names (`--ink`, `--paper`, `--leaf`, `--vellum`, `--side`, `--rule`,
  `--graphite`, `--spine`, `--ribbon`, their tints, `--fund*`, `--r`, `--r-sm`, `--shadow`, `--sans/--serif/--mono`)
  and Community's older semantic names (`--background`, `--card`, `--muted`…) set to the same values, so screens not
  yet transplanted already look right. Tailwind gets them as `bg-leaf`, `text-graphite`, `border-rule`, `bg-fund`….
  One breakpoint: `lg` = 1000 px.
- **Type** — `type-h1` (serif 28/34 → 34/42), `type-h2` (serif 22/28), `type-h3` (sans 600 16/22), `type-name`,
  `type-small`, `type-label`, `type-hint`, `type-micro`, `type-tab`; body 15/22 IBM Plex Sans. Fonts self-hosted in
  `src/app/_fonts/` (IBM Plex, and Founderhall's Source Serif 4 files, which keep the optical-size axis); wired in `src/app/fonts.ts`.
- **Founderhall's part styles** — `src/app/parts.css`, generated from Founderhall's `public/app.css` by
  `.ai/features/fh-foundation/port-css.mjs`. Every class carries the `fh-` prefix (`fh-sheet`, `fh-r`, `fh-titem`…);
  bare element rules and font faces are dropped. It sits in the `components` layer, so Tailwind utilities win. Do not
  edit it by hand: rerun the script, or override in `globals.css`.
- **The fund colour** — `deriveFundColors()` in `src/platform/design/accent.ts`: Founderhall's rule (×0.92 steps to
  4.5:1 on Leaf; deep ×0.75; tint 84 % to white). `renderAccentCss()` writes `--fund`, `--fund-deep`, `--fund-tint`
  and the older `--primary`/`--accent` names for light; dark mode uses `deriveDarkFundColors()` (see `.ai/features/fh-dark/NOTES.md`).

## The parts (use these; a missing part goes back to the foundation)
| Part | File |
|---|---|
| Page head, back link, section head | `components/page-header.tsx` (`PageHeader` with `eyebrow`, `back`, `action` under the lede) |
| Buttons: primary, ink, secondary, quiet, sm, block; button row | `components/ui/button.tsx` (`variant`, `size="sm"`, `width="block"`, `ButtonRow`) |
| Chips, chip count, chip row, example chips | `components/ui/chip.tsx` |
| Segmented control (interactive / links / static) | `components/ui/segmented.tsx`, `segmented-static.tsx` |
| Pill (made, open, declined, needs, plain) | `components/ui/pill.tsx` |
| Tag, tags, source badge, warmth | `components/ui/tag.tsx` |
| Avatar (serif initials, 4 tints, outside person), avatar stack | `components/ui/avatar.tsx` |
| Company logo | `components/company-name.tsx` |
| Fund mark (sidebar, top bar, public) | `components/logo-tile.tsx` (`FundMark`, `LogoTile`) |
| Input, textarea, select, field with label/hint/error | `components/ui/input.tsx`, `textarea.tsx`, `select.tsx`, `components/form-field.tsx` (`Field`) |
| Switch, setting row | `components/ui/switch.tsx`, `components/ui/rows.tsx` (`SetRow`) |
| Option card (radio/checkbox, "Recommended") | `components/ui/checkbox-card.tsx` (`OptionCard`) |
| Note, consent line, quote box, "Why you" box, code | `components/ui/note.tsx`; `components/ui/alert.tsx` keeps the old API |
| Flash | `components/flash.tsx` (`useFlash()` inside the app shell; `FlashNote` anywhere) |
| Sheet (card) and its head | `components/ui/card.tsx` (`Card`, `SheetHead`) |
| Rows, row, Set up rows, history list, field block | `components/ui/rows.tsx` |
| KV tiles, ledger, meter, breakdown, status checklist | `components/ui/figures.tsx` |
| Stepper (intro tracker), step dots | `components/ui/stepper.tsx`, `components/step-pills.tsx`, `components/progress-track.tsx` |
| Launch-list row | `components/step-row.tsx` |
| Search box, strip line, allowance pips | `components/ui/search-box.tsx` |
| Empty state (dashed) | `components/empty-state.tsx` |
| Public page (sign-in, invite, yes/no, opt-out) | `components/public-page.tsx`; `split-layout.tsx` and `centered-page.tsx` now render it |
| Footers | `components/source-code-link.tsx` (`SourceLine`, `ProductCredit`, `SiteFooter`) |

Larger, screen-specific pieces (Today item, post, composer, search result, report, mail preview, messages, intro
log, need cards) have their Founderhall classes in `parts.css` and a worked example on the parts page
(`src/app/parts/parts-gallery.tsx`). The area that owns the screen turns its example into a component.

## The shell (`src/shell/`)
- `app-shell.tsx` — Founderhall's `page()`: sidebar (fund mark, the admin's Console | View as a founder switch, menu,
  member + Sign out, footer line), phone top bar (fund mark + avatar → My profile), founder-view strip, `main` with the
  flash slot and the phone foot, phone tab bar. No account menu.
- `navigation.ts` — the two menus (member and console) in Founderhall's order; module entries show only while their
  module is on, and take their address from the module's manifest, so a renamed route follows.
- `navigation-rules.ts` — which item and which phone tab a page lights (`readMemberKey`, `readConsoleKey`…). The console
  is every page under `/admin` for an admin; elsewhere an admin sees the founder view.
- `admin-tabs.tsx` — Community-only console pages (Settings, Email, Village check, Credits, Slack and Discord, Perks,
  Features, Reports, Audit log; Weekly email beside Asks) as a chip row under the title, until area 7 builds the Set up
  list and area 6 the Asks & digest page.
- Intro log (`/admin/intros`) and Invites (`/admin/invites`) forward to the partner report and Members until area 6
  builds them. Set up points at `/admin/settings` until the Set up list exists.
- Count badges stay on menu items and tabs (Founderhall shows none); the owner decides.
- Dark mode: the account menu is gone; its switch is a row on Your data (`DarkModeRow`). The owner kept it; its look is in `.ai/features/fh-dark/NOTES.md`.

## The parts page
`/parts`, a test page that answers 404 unless `SHOW_PARTS_PAGE=true`. It reads Founderhall's crops from
`.ai/features/fh-foundation/crops/` and shows each beside Community's part. Four of Founderhall's crops caught a
neighbouring element (helpers strip, KV tiles, status checklist, moderation row, table); the page says so and shows both.
- Phones: the menu items with no phone tab (Jobs, Perks; in the console the Partner report, Invites, Job board) are
  listed as small links in the phone foot, so nothing becomes unreachable. Founderhall reaches them from its pages;
  the area that adds those links removes them here (`PhoneMoreLinks` in `src/shell/shell-chrome.tsx`).
