import { introReportBodySchema } from "@/modules/admin/contract";
import { reportIntroNote } from "@/modules/admin/service-reports";
import { introsRoutes } from "@/modules/intros/routes";

export const POST = introsRoutes.member("intro-report", introReportBodySchema, async (context, { introId }) => {
  return Response.json({ message: await reportIntroNote(context, introId) });
});
