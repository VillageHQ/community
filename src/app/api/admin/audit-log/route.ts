import { auditLogBodySchema } from "@/modules/admin/contract";
import { readAuditLog } from "@/modules/admin/reads-audit";
import { adminRoutes } from "@/modules/admin/routes";

export const POST = adminRoutes.member(
  "admin-audit-log",
  auditLogBodySchema,
  async ({ database }, { page }) => Response.json(await readAuditLog(database, page)),
  { adminOnly: true },
);
