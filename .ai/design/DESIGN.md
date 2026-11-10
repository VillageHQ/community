# Design system

> ⚠ RECONSTRUCTED from code on 2026-11-10 — needs confirmation
> Sources: `docs/design/tokens.md`, `src/app/globals.css`, `README.md` (Design).

The design system's rules live with the code, not here:
- **Tokens and rules:** `docs/design/tokens.md` (the accent input and its six contrast-safe tokens, light and dark).
- **CSS variables:** `src/app/globals.css`; the fund's accent is written per theme by the server.
- **Components:** shared components under `src/components/` (shadcn primitives in `src/components/ui/`) and each module's `components/`.
- **Fonts:** self-hosted through `next/font/local` (no font network).

Changing: the merged product's quieter look (serif headings, hairline edges, no "Network by Village" on member
screens) is being built as the `look-theme` build (roadmap, open). When it lands, its rules update
`docs/design/tokens.md`, and this page keeps pointing there.
