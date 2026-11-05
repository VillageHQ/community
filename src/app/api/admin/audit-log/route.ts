import { auditLogBodySchema } from "@/lib/admin/admin-api";
import { readAuditLog } from "@/lib/admin/audit";
import { createMemberRoute } from "@/lib/village/member-route";

export const POST = createMemberRoute(
  "admin-audit-log",
  auditLogBodySchema,
  async ({ database }, { page }) => Response.json(await readAuditLog(database, page)),
  { adminOnly: true },
);
