# One marketing site: Founderhall by Village

Approved scope (from the owner's build plan, item 8 of the Founderhall → Community merge).

## Direction
One marketing page for the merged product, in `site/`, still plain static HTML, CSS and a little JavaScript with no
third-party loads. The name is **Founderhall by Village**. It carries Founderhall's message and sections (the
fund-first story, Today, double opt-in intros, the partner report, the trust points) on top of Community's page, in
the approved quiet look: serif headings, hairline edges, no glow.

**In:** the page copy and sections, the look of `site/`, a self-hosted serif font, the site README.
**Out:** the app itself, any deploy or publish, any form that needs a server (waitlist, contact, managed sign-up).

## Rules
- Every product claim is true of the app on main today; the verifier maps each claim to a file.
- No Google or Microsoft sign-in, SSO or groups claims. No prices, no competitor prices, no private research.
- Link the source code (AGPL-3.0). No personal names, emails or PC paths.

## Proof and tests
- Screenshots at 390 and 1280 px, light and dark, into `reports/`.
- A separate verifier: claim → file table, forbidden words, network log (no third-party requests), every link.

## Follow-ups (not built here)
- A managed-plan sign-up or contact form needs a server; `site/` has none.
