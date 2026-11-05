import { introReportBodySchema } from "@/lib/admin/admin-api";
import { reportIntroNote } from "@/lib/admin/reports";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("intro-report", introReportBodySchema, async (context, { introId }) => {
  return Response.json({ message: await reportIntroNote(context, introId) });
});
