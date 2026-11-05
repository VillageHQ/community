import type { ReactNode } from "react";

import { PageHeader } from "@/components/page-header";
import { getDatabase } from "@/platform/database/client";
import { readAdminTabFacts } from "@/shell/admin-badges";

import { AdminTabs } from "./admin-tabs";

type AdminSectionProps = { title: string; description?: string; action?: ReactNode; children: ReactNode };

export async function AdminSection({ title, description, action, children }: AdminSectionProps) {
  const facts = await readAdminTabFacts(getDatabase(), process.env);
  return (
    <>
      <PageHeader title={title} description={description} action={action} />
      <AdminTabs facts={facts} />
      {children}
    </>
  );
}
