import { reportAsk } from "@/modules/admin/service-reports";
import { askIdBodySchema } from "@/modules/asks/contract";
import { asksRoutes } from "@/modules/asks/routes";

export const POST = asksRoutes.member("asks-report", askIdBodySchema, async (context, { askId }) =>
  Response.json({ message: await reportAsk(context, askId) }),
);
