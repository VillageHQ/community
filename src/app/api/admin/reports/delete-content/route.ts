import { reportActionBodySchema } from "@/modules/admin/contract";
import { deleteReportedContent } from "@/modules/admin/service-reports";
import { logAdminAction } from "@/platform/observability/route-logging";
import { adminRoutes } from "@/modules/admin/routes";

export const POST = adminRoutes.member(
  "admin-report-delete-content",
  reportActionBodySchema,
  async (context, body) => {
    await deleteReportedContent(context, body);
    logAdminAction("reported_content_deleted", context.member.id, body.reportId);
    return Response.json({ message: "Deleted. A copy stays in the audit log." });
  },
  { adminOnly: true },
);
