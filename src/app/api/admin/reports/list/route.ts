import { reportListBodySchema } from "@/lib/admin/admin-api";
import { readReports } from "@/lib/admin/reports";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute(
  "admin-report-list",
  reportListBodySchema,
  async ({ database }, { filter, page }) => Response.json(await readReports(database, filter, page)),
  { adminOnly: true },
);
