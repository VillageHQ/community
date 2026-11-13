# Common Hall landing page: CHARTER (approved)

Approved by Absi on 2026-11-13 in Telegram topic 75190: the business-builder run's decision pages (results page
zsE7Q9KCgSwToo4BwkCMKw → round 2 kTUInA6etnEmePYStpavlA → round 3 1OEH9jei7X0B91MCPIYyFQ, each replaced by the next and
settled in chat) and the build question on page 1X6JCFUhFm7m44-4CNjUuw ("Qareen builds it by PR"). Per the
business-builder rules the kickoff and these picks are the approved page for this stage; no new alignment page.

## Direction (Absi's words)
"Ok I love this." on the blueprint page (design v13, "The plans are public", simplified); name **Common Hall**; "make the
main button 'Schedule call' and 'GitHub' with the GitHub logo"; "add icons on Asks, Intros… in the hero section, and make
that section a bit more interactive, like founders from different companies moving between rooms." Earlier: bold yet
neat and professional like chamomail.ai, more animation, more simplicity that brings trust; square and simple.

**In:** replace `site/` (the public landing page of this repo) with design v15 from
`~/.business-builder/runs/2026-11-13-founderhall-v2/design/v15/`, ported to this repo's site rules.
**Out:** renaming the product in the app, README and docs (a roadmap line); a server for the form; publishing or
deploying the page; buying a domain; a dark mode for the new look (roadmap line).

## Deciding facts (lead's calls, reversible)
1. The site keeps its Content Security Policy (`default-src 'none'; script-src 'self'; style-src 'self'; …`) and loads
   nothing from third parties: the motion is the page's own script, no library (the lead's call on 2026-11-13: GSAP's
   licence is not open source, and this repo is AGPL); Figtree stays self-hosted; JetBrains Mono is added as a latin woff2 subset under its OFL; no inline styles or
   scripts; the page is split into `index.html`, `assets/site.css`, `assets/site.js`.
2. One form only, the existing contract: `#signup-form` with `data-endpoint` (empty = nothing sent, the page says so),
   fields `name`, `email`, `community`, `members`, `plan` (= "managed"), `website` robot trap; 201 `{ok, emailSent, next}`
   or 400 `{errors}`. "Schedule call" scrolls to that form, titled "Schedule a call". No calendar link is invented.
3. The self-host entrance shows the install line (copy button) and links the self-host guide; no second form.
4. Every claim is true of the app on `main`: room stamps Built / Partly / Coming are checked against `src/modules`;
   WhatsApp, Telegram, Signal and chat → portal stay "Coming" (the owner's stated promise); prices as on the current page.
5. Light look only (the blueprint is a paper drawing); `color-scheme: light`. Dark mode is a roadmap line.
6. The page title and lockups say "Common Hall by Village"; the app's own name is untouched in this build.
7. `assets/og.png` is re-rendered from the new look; `site/README.md` is rewritten for the new page.

## Journeys and tests
No app journey changes. Tests on this page: `.ai/features/one-site/reports/check-site.mjs` (serves the folder, shoots
320/390/1280, fails on outside requests, console errors, overflow, missing anchors; ~2 min), plus a form test (empty
endpoint → nothing sent, the page says so). Then an independent verifier drives the real page (buttons, founders'
motion, reduced motion, phone widths, honesty strings).

## Proof and estimate
Proof: phone and desktop screenshots and a ≤ 10 s clip of the served page. Build ~1.5 h, tests ~20 min.

## Roll back
A revert of the merge restores the Founderhall page.
