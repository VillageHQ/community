# Design system

> ⚠ RECONSTRUCTED from code on 2026-11-10 — needs confirmation
> Sources: `docs/design/tokens.md`, `src/app/globals.css`, `README.md` (Design).

The design system's rules live with the code, not here:
- **Tokens and rules:** `docs/design/tokens.md` (the accent input and its six contrast-safe tokens, light and dark).
- **CSS variables:** `src/app/globals.css`; the fund's accent is written per theme by the server.
- **Components:** shared components under `src/components/` (shadcn primitives in `src/components/ui/`) and each module's `components/`.
- **Fonts:** self-hosted through `next/font/local` (no font network).

The merged look (serif headings, hairline edges, plain buttons, only the fund's name for members) is in
`docs/design/tokens.md`; what it changed on each screen is in `.ai/features/look-theme/SPEC.md`.
