# One marketing site: Founderhall by Village

What it does now.

- `site/` is one static page (`index.html`, `assets/site.css`, `assets/site.js`) that sells the app in this repo as
  **Founderhall by Village**. No framework, no build step, no forms, no cookies, no analytics, and a Content Security
  Policy that allows only this site's own files. Nothing loads from a third party.
- Sections: hero (the Today sketch), fund first, Today and the weekly email, double opt-in intros (with the consent
  page sketch), the partner report (sketch using the app's own rows), trust points and the consent text, optional
  switches, set up (deploy buttons, the install command, the setup checklist), what you pay for (no prices),
  control, questions, closing.
- Look: Source Serif 4 headings, Figtree body text, hairline edges, no shadows; light and dark follow the visitor's
  system setting. Works from 320 px. Printing hides buttons and opens every answer.
- Every product claim maps to code on `main`; the sketches copy the app's own wording. People, fund and numbers are
  made up.
- `.ai/features/one-site/reports/check-site.mjs` serves the folder locally, screenshots it at 320/390/1280 px in
  light and dark, and fails on outside requests, console errors, horizontal overflow or a missing anchor.

Not here: deploying or publishing the page, a managed-plan sign-up or contact form (needs a server).
