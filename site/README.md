# Founderhall by Village: landing page

The public marketing page for the app in this repo, under the name Founderhall by Village. Plain HTML, CSS and a little JavaScript, with no framework and no build step. It loads nothing from third parties.

## Preview

```sh
cd site
python3 -m http.server 8080
```

Then open http://127.0.0.1:8080. Any static file server works.

## Host it

Point any static host at this repo with **root directory `site`**. There's no build command, and the publish directory is `site` itself.

## Before you publish

- Set `og:image` in `index.html` to an absolute URL, and add `og:url`. Social networks ignore relative image paths, and the page has no public address yet.
- Confirm `install.sh` is on `main`. The page shows it as the third deploy path.
- Recheck the status note under the deploy options. It says the one-click buttons haven't run end to end on a live host, which is what the root README says today.
- The GitHub links point at `VillageHQ/community`. Change them if the repository is renamed.
- The sign-up form sends nothing until `data-endpoint` on `#signup-form` is set to a server that takes the JSON
  (`name`, `email`, `community`, `members`, `plan`, `website` as a robot trap) and answers 201 `{ ok, emailSent, next }`
  or 400 `{ errors: { field: message } }`, as Founderhall's site server does. Empty, the page says nothing was sent.
- The prices and plan rows are Founderhall's offer, word for word (except sign-in, which says what this app has).
  Confirm them with Village before publishing.

## Keeping it in step with the app

- Every product claim must be true of the app on `main`. Claims come from `src/` first, then the root `README.md` and `SECURITY.md`. Change the page when they change.
- Prices only as Village sets them (the Pricing section, from Founderhall's offer); no competitor prices, and no sign-in
  methods the app doesn't have (it signs in by email link or password).
- The deploy button URLs match the root README exactly. Change both together.
- The look is the quiet one: Source Serif 4 headings, Figtree body text, hairline edges, no shadows. Light and dark follow the visitor's system setting.
- The product sketches are HTML, not screenshots. Their wording copies the app's own (email subjects, the consent page, the consent text). The people and the fund are made up.
- One form, the sign-up form at the end. This folder has no server, so it posts only to the address in `data-endpoint`
  and shows only when the script runs.

## How it stays out of the app

- `eslint.config.mjs` ignores `site/**`.
- `@source not "../../site"` in `src/app/globals.css` stops Tailwind from scanning this folder for class names, so nothing here reaches the app's CSS.
- `tsc` and Vitest only look at TypeScript files and `src/`. Vercel and DigitalOcean build from the repo root with `next build`, which never reads this folder.

## Third-party assets

- Figtree, from `@fontsource-variable/figtree`, under the SIL Open Font License: `assets/fonts/OFL-figtree.txt`.
- Source Serif 4, by Adobe, under the SIL Open Font License: `assets/fonts/OFL-source-serif-4.txt`.
- `assets/og.png` is rendered from the page's own fonts and mark.
