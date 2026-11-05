import { reportListBodySchema } from "@/modules/admin/contract";
import { readReports } from "@/modules/admin/service-reports";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute(
  "admin-report-list",
  reportListBodySchema,
  async ({ database }, { filter, page }) => Response.json(await readReports(database, filter, page)),
  { adminOnly: true },
);
