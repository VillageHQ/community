import { partnerReportSendBodySchema } from "@/modules/admin/contract-partner-report";
import { sendPartnerReport } from "@/modules/admin/service-partner-report";
import { adminRoutes } from "@/modules/admin/routes";

export const POST = adminRoutes.member(
  "admin-partner-report-send",
  partnerReportSendBodySchema,
  async (context, body) => Response.json(await sendPartnerReport(context, body)),
  { adminOnly: true },
);
