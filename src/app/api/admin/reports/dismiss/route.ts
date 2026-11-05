import { reportActionBodySchema } from "@/lib/admin/admin-api";
import { dismissReport } from "@/lib/admin/reports";
import { logAdminAction } from "@/lib/route-logging";
import { createMemberRoute } from "@/lib/village/member-route";

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
