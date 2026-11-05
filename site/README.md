# Community landing page

The public marketing page for Community. Plain HTML, CSS and a little JavaScript, with no framework and no build step. It loads nothing from third parties.

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

## Keeping it in step with the app

- Claims come from the root `README.md`, `SECURITY.md` and `src/`. Change the page when they change.
- The deploy button URLs match the root README exactly. Change both together.
- The colors, radii and type come from `docs/design/tokens.md`. The sample people come from `docs/design/mockup.html`.

## How it stays out of the app

- `eslint.config.mjs` ignores `site/**`.
- `site/.ignore` stops Tailwind from scanning this folder for class names, so nothing here reaches the app's CSS. It also hides the folder from tools that honor `.ignore`, like ripgrep. Use `rg --no-ignore` to search it.
- `tsc` and Vitest only look at TypeScript files and `src/`. Vercel and DigitalOcean build from the repo root with `next build`, which never reads this folder.

## Third-party assets

- Figtree, from `@fontsource-variable/figtree`, under the SIL Open Font License: `assets/fonts/OFL.txt`.
- Icons from Lucide, under the ISC license, inlined in `index.html`.
- `assets/product-feed.png` is `docs/screenshots/feed.png`, with fictional people.
