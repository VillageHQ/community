import { auditLogBodySchema } from "@/lib/admin/admin-api";
import { readAuditLog } from "@/lib/admin/audit";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute(
  "admin-audit-log",
  auditLogBodySchema,
  async ({ database }, { page }) => Response.json(await readAuditLog(database, page)),
  { adminOnly: true },
);
