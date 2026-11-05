import { reportListBodySchema } from "@/modules/admin/contract";
import { readReports } from "@/modules/admin/service-reports";
import { adminRoutes } from "@/modules/admin/routes";

export const POST = adminRoutes.member(
  "admin-report-list",
  reportListBodySchema,
  async ({ database }, { filter, page }) => Response.json(await readReports(database, filter, page)),
  { adminOnly: true },
);
