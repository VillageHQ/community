import { reportActionBodySchema } from "@/lib/admin/admin-api";
import { dismissReport } from "@/lib/admin/reports";
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
