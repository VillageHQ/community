# Faces and logos: how it works today

- `src/modules/members/reads-pictures.ts`: the SQL pieces every read adds next to a member id. `filledFaceColumn`,
  `shownFaceColumns` + `toShownFaceUrl` (uploaded photo first), `companyLogoColumn` (the logo rule),
  `shownCompanyColumn` (own words, else the filled-in company), `logoOfCompanyColumn` (job board). They are correlated
  subqueries on aliased tables; `fromAlias` writes `table alias`, because drizzle prints only the alias's name.
- `rules-fill-in.ts` `isFilledLogoShown` is the same logo rule in TypeScript (profile card, the card page's "not
  shown" note, the export). Change both together.
- `src/components/company-name.tsx`: `CompanyLogo` (16 px, no referrer) and `CompanyName`. Asks use
  `asks/components/member-line.tsx`.
- Network: `rules-paths.ts` `readPersonImageUrl` (a member's own face wins, else Village's picture through
  `readSafeImageUrl`). Contracts carry `imageUrl` on search people and path people, `imageUrl`/`throughImageUrl` on
  connectors, `targetImageUrl` on paths. Paths cached before this change have no pictures until they refresh.
- `network/rules-fill-in.ts`: `readSafeImageUrl` (https, or `/demo/<a-z0-9->/….svg|png|jpg|webp`),
  `readCompanyDomain`. Migration 0027 adds `company_domain` to the fill-in field check.
- Demo: `src/platform/demo/pictures.ts` maps a name or company to its file; `village-answers.ts` answers enrich for
  demo members; `shell/demo-seed.ts` `seedFillIn`. `src/proxy.ts` skips `/demo/` so pictures don't hit the database.
  `src/platform/demo/pictures.test.ts` fails if a made-up person or company has no drawing.
- Under `next dev` the demo's fetch guard doesn't catch Village calls (search says unavailable); `next start` works.
