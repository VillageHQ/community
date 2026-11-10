# Where the data is kept, and whom to ask: how it works today

- Stored in `instance_settings` under `data_location`, `data_contact_name` and `data_contact_email` (empty = unset).
  No migration.
- `src/platform/settings/data-home-api.ts`: the body's checks (zod, client-safe) and `toDataHome`, which turns the
  stored strings into `{ location, contact }` (a contact exists only with an email).
- `src/platform/settings/data-home.ts`: `readDataHome`, and `saveDataHomeAsAdmin`, which writes the three keys and
  the `data_home_saved` audit entry in one admin transaction.
- `POST /api/admin/data-home` (admin module, admins only). The form: `modules/admin/components/data-home-form.tsx`,
  on the Settings page's "Where your data is kept" card.
- Your data (`src/app/(app)/members/data/page.tsx`, `DataHomeFacts`) shows it inside the "What is stored, and
  where" panel, only when something is set.
- Demo: `DEMO_DATA_HOME` in `src/platform/demo/people.ts`, written by the demo seed.
- The test: `src/app/(app)/members/data/data-home.test.ts`.
