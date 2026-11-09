import { z } from "zod";

import { markPartnerReportShared } from "@/modules/admin/service-partner-report";
import { adminRoutes } from "@/modules/admin/routes";

export const POST = adminRoutes.member("admin-partner-report-shared", z.object({}), async (context) => Response.json(await markPartnerReportShared(context)), {
  adminOnly: true,
});
