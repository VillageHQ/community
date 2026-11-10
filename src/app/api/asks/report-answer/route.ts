import { reportAskAnswer } from "@/modules/admin/service-reports";
import { answerIdBodySchema } from "@/modules/asks/contract";
import { asksRoutes } from "@/modules/asks/routes";

export const POST = asksRoutes.member("asks-report-answer", answerIdBodySchema, async (context, { answerId }) =>
  Response.json({ message: await reportAskAnswer(context, answerId) }),
);
