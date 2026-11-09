# Charter: switch the licence to AGPL-3.0

Approved by the owner on 2026-11-09 as step 1 of the plan that merges Founderhall's features into Community. The
maintainer agreed to the licence switch.

## Goal
Community becomes open source under the GNU Affero General Public License v3.0 (AGPL-3.0-only) instead of MIT, so
nobody can run a changed copy as a closed hosted service. Village keeps the right to release the project under other
licences later.

## In scope
- `LICENSE` holds the AGPL-3.0 text; `package.json` says `AGPL-3.0-only`.
- README, CONTRIBUTING and the landing site (`site/`) say AGPL-3.0 instead of MIT.
- CONTRIBUTING: contributors agree that Village may also release their work under other licences (so the project
  can change its licence later as one whole).
- A "Source code (AGPL-3.0)" link in the app (sidebar footer and the centered pages: sign-in, setup, join), pointing
  at `NEXT_PUBLIC_SOURCE_CODE_URL` or the public repo, as AGPL section 13 asks of network services.
- `.ai/.gitignore` so the project-memory scratch folder is never committed.

## Out of scope
No feature changes. Copies taken before this change stay under MIT.

## Proof and checks
Lint, typecheck, the architecture tests and the build pass; the link renders on the sign-in page.
