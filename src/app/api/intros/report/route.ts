import { introReportBodySchema } from "@/modules/admin/contract";
import { reportIntroNote } from "@/modules/admin/service-reports";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("intro-report", introReportBodySchema, async (context, { introId }) => {
  return Response.json({ message: await reportIntroNote(context, introId) });
});
