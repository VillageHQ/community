import { askIdBodySchema } from "@/modules/asks/contract";
import { asksRoutes } from "@/modules/asks/routes";
import { reopenAsk } from "@/modules/asks/service";
import { isAdminMember } from "@/platform/auth/roles";

export const POST = asksRoutes.member("asks-reopen", askIdBodySchema, async (context, { askId }) => {
  await reopenAsk(context, askId, isAdminMember(context.member));
  return Response.json({ message: "The ask is open again, for another 30 days." });
});
