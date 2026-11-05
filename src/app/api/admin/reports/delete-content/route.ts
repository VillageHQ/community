import { reportActionBodySchema } from "@/lib/admin/admin-api";
import { deleteReportedContent } from "@/lib/admin/reports";
import { logAdminAction } from "@/platform/observability/route-logging";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute(
  "admin-report-delete-content",
  reportActionBodySchema,
  async (context, body) => {
    await deleteReportedContent(context, body);
    logAdminAction("reported_content_deleted", context.member.id, body.reportId);
    return Response.json({ message: "Deleted. A copy stays in the audit log." });
  },
  { adminOnly: true },
);
