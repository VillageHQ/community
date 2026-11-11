import type { ReactNode } from "react";

import { PageHeader } from "@/components/page-header";
import { getDatabase } from "@/platform/database/client";
import { readAdminTabFacts } from "@/shell/admin-badges";

import { AdminTabs } from "./admin-tabs";
import { VillageTroubleNotice } from "./village-trouble-notice";

type AdminSectionProps = { title: string; description?: ReactNode; action?: ReactNode; back?: { href: string; label: string }; children: ReactNode };

export async function AdminSection({ title, description, action, back, children }: AdminSectionProps) {
  const facts = await readAdminTabFacts(getDatabase(), process.env);
  return (
    <>
      <PageHeader title={title} description={description} action={action} back={back} />
      <AdminTabs facts={facts} />
      {facts.villageTrouble ? <VillageTroubleNotice health={facts.villageTrouble} /> : null}
      {children}
    </>
  );
}
