# Perks

The community's BuiltFirst perks marketplace, framed inside the app. Toggleable, off by default.

- `contract.ts`: paths, `parsePerksEmbed` and `readBuiltfirstUrl` (pure), the frame's sandbox and sources.
- `service.ts`: read, save and remove the marketplace address (setting `perks_embed_url`), audit-logged.
- `components/perks-form.tsx`: the admin form. `components/perks-frame.tsx`: the sandboxed iframe. `components/shared/perks-card.tsx`: the Today card.
- `components/demo-perks-list.tsx`: in demo mode `/perks` lists the made-up deals in `src/platform/demo/perks.ts`, labelled demo, and never frames BuiltFirst.
- Pages: `src/app/(app)/perks/page.tsx` and `src/app/(app)/admin/perks/page.tsx`.

Rules:

- Pasted code is never stored or rendered. Only the first iframe's src is kept, and only when it's https on builtfirst.com or a subdomain, with no login part or port. It's checked again when read.
- `/perks` and `/admin/perks` have their own Content-Security-Policy in `next.config.mjs` (`frame-src` BuiltFirst only). Never widen the site-wide policy for this.
- Today shows the card only while the module is on and a marketplace is saved.
