import { feedReportBodySchema } from "@/lib/admin/admin-api";
import { reportFeedContent } from "@/lib/admin/reports";
import { createMemberRoute } from "@/lib/village/member-route";

export const POST = createMemberRoute("feed-report", feedReportBodySchema, async (context, body) => {
  return Response.json({ message: await reportFeedContent(context, body) });
});
