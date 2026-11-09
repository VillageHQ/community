import { partnerReportPreviewBodySchema } from "@/modules/admin/contract-partner-report";
import { previewPartnerReport } from "@/modules/admin/service-partner-report";
import { adminRoutes } from "@/modules/admin/routes";

export const POST = adminRoutes.member(
  "admin-partner-report-preview",
  partnerReportPreviewBodySchema,
  async (context, body) => Response.json(await previewPartnerReport(context, body)),
  { adminOnly: true },
);
