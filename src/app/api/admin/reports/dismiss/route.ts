import { reportActionBodySchema } from "@/modules/admin/contract";
import { dismissReport } from "@/modules/admin/service-reports";
import { logAdminAction } from "@/platform/observability/route-logging";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute(
  "admin-report-dismiss",
  reportActionBodySchema,
  async (context, body) => {
    await dismissReport(context, body);
    logAdminAction("report_dismissed", context.member.id, body.reportId);
    return Response.json({ message: "Report dismissed. Nothing else changed." });
  },
  { adminOnly: true },
);
