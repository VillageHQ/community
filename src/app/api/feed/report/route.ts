import { feedReportBodySchema } from "@/modules/feed/contract";
import { reportFeedContent } from "@/modules/admin/service-reports";
import { feedRoutes } from "@/modules/feed/routes";

export const POST = feedRoutes.member("feed-report", feedReportBodySchema, async (context, body) => {
  return Response.json({ message: await reportFeedContent(context, body) });
});
