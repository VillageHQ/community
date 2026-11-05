import { auditLogBodySchema } from "@/modules/admin/contract";
import { readAuditLog } from "@/modules/admin/reads-audit";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute(
  "admin-audit-log",
  auditLogBodySchema,
  async ({ database }, { page }) => Response.json(await readAuditLog(database, page)),
  { adminOnly: true },
);
