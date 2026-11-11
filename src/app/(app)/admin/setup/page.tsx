import type { Metadata } from "next";

import { Pill } from "@/components/ui/pill";
import { SetupRows } from "@/components/ui/rows";
import { requireAdmin } from "@/platform/auth/session";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { getDatabase } from "@/platform/database/client";
import { modulePage } from "@/platform/modules/module-page";
import { adminManifest } from "@/modules/admin/manifest";
import { AdminSection } from "@/shell/admin-section";
import { readSetupPage, SETUP_ROW_STATES, type SetupRowState } from "@/shell/admin-setup-rows";

export const metadata: Metadata = { title: PAGE_TITLES.adminSetup };

function RowState({ state }: { state: SetupRowState }) {
  if (state.kind === SETUP_ROW_STATES.done) return <Pill tone="made">Set up</Pill>;
  if (state.kind === SETUP_ROW_STATES.todo) return <Pill tone="open">Not yet</Pill>;
  if (state.kind === SETUP_ROW_STATES.needs) return <Pill tone="needs">{state.text}</Pill>;
  return <small className="fh-muted">{state.text}</small>;
}

// Set up: the plumbing pages in one place, each with one plain line and whether it is set up yet. Community's setup
// checklist is a part for the console's Home (src/shell/setup-checklist.tsx).
export default modulePage(adminManifest, async function AdminSetupPage() {
  await requireAdmin();
  const { lede, rows } = await readSetupPage(getDatabase(), process.env);
  return (
    <AdminSection title="Set up" description={lede}>
      <SetupRows rows={rows.map(({ key, title, href, description, state }) => ({ key, title, href, description, status: <RowState state={state} /> }))} />
    </AdminSection>
  );
});
