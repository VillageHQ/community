import { introReportBodySchema } from "@/lib/admin/admin-api";
import { reportIntroNote } from "@/lib/admin/reports";
import { createMemberRoute } from "@/lib/village/member-route";

export const POST = createMemberRoute("intro-report", introReportBodySchema, async (context, { introId }) => {
  return Response.json({ message: await reportIntroNote(context, introId) });
});
